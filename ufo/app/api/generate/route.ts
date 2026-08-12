import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canUseFeature } from '@/lib/credits';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateFullProject, importAndRedesign } from '@/lib/ai';
import { generateRequestSchema } from '@/lib/schemas';
import { hashGenerationRequest, getCachedGeneration, storeCachedGeneration } from '@/lib/generation-cache';
import { sendLowCreditsEmail } from '@/lib/email';
import { PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import type { ProjectType } from '@/lib/types';

function randomSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fair Usage Policy: cap generation requests independent of credit
  // balance, so a script burning through credits fast can't also hammer
  // the AI providers faster than a human would.
  const rateLimit = await checkRateLimit(user.id, 'generate', 20, 600, { mode: undefined });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many generation requests — please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  const parsed = generateRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }
  const { mode, projectName, answers, description, importSource, importInstruction } = parsed.data;

  const admin = createAdminClient();

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('users').select('role').eq('id', user.id).single(),
    supabase.from('subscriptions').select('plan, credits_remaining').eq('user_id', user.id).single(),
  ]);

  if (!subscription) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
  }

  const gate = canUseFeature(
    {
      role: (profile?.role as 'user' | 'admin') ?? 'user',
      plan: subscription.plan,
      creditsRemaining: subscription.credits_remaining,
    },
    mode === 'scratch' ? 'generate_full_project' : 'import_redesign'
  );

  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason }, { status: 402 });
  }

  const requestHash = hashGenerationRequest(
    mode === 'scratch'
      ? { mode, projectName, description: description ?? '', answers }
      : { mode, projectName, importSource: importSource ?? '', importInstruction: importInstruction ?? '', answers }
  );

  let generated = await getCachedGeneration(user.id, requestHash);
  let servedFromCache = !!generated;

  if (!generated) {
    try {
      generated =
        mode === 'scratch'
          ? await generateFullProject(projectName, description ?? '', answers)
          : await importAndRedesign(importSource ?? '', importInstruction ?? '', answers);
    } catch (err) {
      console.error('Generation failed', err);
      return NextResponse.json(
        { error: 'Generation failed — no credits were charged. Please try again.' },
        { status: 502 }
      );
    }

    if (!generated?.screens?.length) {
      return NextResponse.json(
        { error: 'The generator returned an empty result — no credits were charged. Please try again.' },
        { status: 502 }
      );
    }

    storeCachedGeneration(user.id, requestHash, generated).catch((err) =>
      console.error('Failed to cache generation result', err)
    );
  }

  const { data: project, error: projectError } = await admin
    .from('projects')
    .insert({
      user_id: user.id,
      name: projectName,
      project_type: answers.projectType as ProjectType,
      design_style: answers.designStyle,
      color_theme: generated.tokens.colors,
      font_pairing: generated.tokens.fonts.body,
    })
    .select()
    .single();

  if (projectError || !project) {
    console.error(projectError);
    return NextResponse.json({ error: 'Could not save the project' }, { status: 500 });
  }

  const screenRows = generated.screens.map((s) => ({
    project_id: project.id,
    name: s.name,
    order_index: s.orderIndex,
    code: s.code,
  }));

  await admin.from('screens').insert(screenRows);
  await admin.from('shares').insert({ project_id: project.id, slug: randomSlug(), is_public: false });

  if (!servedFromCache && profile?.role !== 'admin' && gate.creditsRequired) {
    const newBalance = subscription.credits_remaining - gate.creditsRequired;
    await admin
      .from('subscriptions')
      .update({ credits_remaining: newBalance })
      .eq('user_id', user.id);

    const planTotal = PLAN_MONTHLY_CREDITS[subscription.plan as keyof typeof PLAN_MONTHLY_CREDITS];
    const threshold = planTotal * 0.1;
    if (subscription.credits_remaining > threshold && newBalance <= threshold) {
      admin
        .from('users')
        .select('notify_low_credits')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.notify_low_credits !== false) {
            sendLowCreditsEmail(user.email!, newBalance, subscription.plan).catch(() => {});
          }
        });
    }
  }

  return NextResponse.json({ projectId: project.id });
}
