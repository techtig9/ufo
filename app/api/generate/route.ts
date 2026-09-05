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
import { reserveCredits, refundCredits } from '@/lib/credits-server';
import type { ProjectType } from '@/lib/types';

function randomSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export async function POST(request: Request) {
  // Correlates the credit reservation, every AI provider attempt, and any
  // refund for this generation. Surfaced to the client so a support request
  // can be traced end to end.
  const requestId = crypto.randomUUID().slice(0, 8);

  const supabase = await createClient();
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
  const servedFromCache = !!generated;

  // A cache hit is the same request again inside the dedup window — the
  // "duplicate requests return cached responses at no extra credit cost" rule.
  // Nothing is reserved for it.
  const action = mode === 'scratch' ? 'generate_full_project' : 'import_redesign';
  const cost = servedFromCache || profile?.role === 'admin' ? 0 : (gate.creditsRequired ?? 0);
  let reserved = false;

  if (cost > 0) {
    // Reserve BEFORE generating. Charging only on success lets two concurrent
    // requests both pass the affordability check and both generate, so one is
    // free. Reserving first makes the charge authoritative; the refunds below
    // keep "a failed generation costs nothing" true.
    const reservation = await reserveCredits(user.id, cost, action, requestId);
    if (!reservation.ok) {
      return NextResponse.json(
        {
          error: `You need ${cost.toLocaleString()} credits for this and have ${reservation.creditsRemaining.toLocaleString()} left this cycle.`,
          requestId,
        },
        { status: 402 }
      );
    }
    reserved = true;
  }

  /** Hands the credits back exactly once, whatever failure path we are on. */
  async function refund(reason: string) {
    if (!reserved) return;
    reserved = false;
    await refundCredits(user!.id, cost, action, requestId, reason);
  }

  if (!generated) {
    try {
      generated =
        mode === 'scratch'
          ? await generateFullProject(projectName, description ?? '', answers, {
              requestId,
              userId: user.id,
              signal: request.signal,
            })
          : await importAndRedesign(importSource ?? '', importInstruction ?? '', answers, {
              requestId,
              userId: user.id,
              signal: request.signal,
            });
    } catch (err) {
      console.error('Generation failed', { requestId, error: String(err) });
      await refund('refund_generation_failed');
      return NextResponse.json(
        { error: 'Generation failed — no credits were charged. Please try again.', requestId },
        { status: 502 }
      );
    }

    if (!generated?.screens?.length) {
      await refund('refund_empty_result');
      return NextResponse.json(
        {
          error: 'The generator returned an empty result — no credits were charged. Please try again.',
          requestId,
        },
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
    console.error('Failed to create project', { requestId, error: projectError?.message });
    await refund('refund_project_insert_failed');
    return NextResponse.json(
      { error: 'Could not save the project — no credits were charged.', requestId },
      { status: 500 }
    );
  }

  const screenRows = generated.screens.map((s) => ({
    project_id: project.id,
    name: s.name,
    order_index: s.orderIndex,
    code: s.code,
  }));

  const { error: screensError } = await admin.from('screens').insert(screenRows);
  if (screensError) {
    console.error('Failed to create generated screens', { requestId, error: screensError.message });
    await admin.from('projects').delete().eq('id', project.id);
    await refund('refund_screens_insert_failed');
    return NextResponse.json(
      {
        error: 'The project was created but its screens could not be saved. No credits were charged.',
        requestId,
      },
      { status: 500 }
    );
  }

  const { error: shareError } = await admin
    .from('shares')
    .insert({ project_id: project.id, slug: randomSlug(), is_public: false });

  if (shareError) {
    console.error('Failed to create project share record', { requestId, error: shareError.message });
    await admin.from('screens').delete().eq('project_id', project.id);
    await admin.from('projects').delete().eq('id', project.id);
    await refund('refund_share_insert_failed');
    return NextResponse.json(
      {
        error: 'The project could not be initialized completely. No credits were charged.',
        requestId,
      },
      { status: 500 }
    );
  }

  // Credits were already charged atomically by reserveCredits() above, before
  // the generation ran. All that remains is the low-balance courtesy email.
  if (cost > 0) {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('credits_remaining, plan')
      .eq('user_id', user.id)
      .maybeSingle();

    const planTotal = PLAN_MONTHLY_CREDITS[sub?.plan as keyof typeof PLAN_MONTHLY_CREDITS];
    const threshold = planTotal * 0.1;
    const balanceNow = sub?.credits_remaining ?? 0;

    // Only on the crossing, so the user is warned once per cycle rather than
    // on every generation once they are below the line.
    if (planTotal && balanceNow <= threshold && balanceNow + cost > threshold) {
      const { data: prefs } = await admin
        .from('users')
        .select('notify_low_credits')
        .eq('id', user.id)
        .maybeSingle();

      if (prefs?.notify_low_credits !== false) {
        sendLowCreditsEmail(user.email!, balanceNow, sub!.plan, user.id).catch(() => undefined);
      }
    }
  }

  return NextResponse.json({ projectId: project.id, requestId });
}
