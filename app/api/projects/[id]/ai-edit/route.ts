import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateComponent } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';
import { canUseFeature, PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import { sendLowCreditsEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const rateLimit = await checkRateLimit(user.id, 'ai-edit', 10, 600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many AI edits. Please wait a moment.' }, { status: 429 });
  }

  const body = await request.json();
  const screenId = String(body.screenId ?? '');
  const instruction = String(body.instruction ?? '').trim();

  if (!screenId || !instruction) {
    return NextResponse.json({ error: 'screenId and instruction are required' }, { status: 400 });
  }
  if (instruction.length > 1200) {
    return NextResponse.json({ error: 'Instruction is too long' }, { status: 400 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, design_style, color_theme, font_pairing')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: screen } = await supabase
    .from('screens')
    .select('*')
    .eq('id', screenId)
    .eq('project_id', params.id)
    .single();

  if (!screen) return NextResponse.json({ error: 'Screen not found' }, { status: 404 });

  // Credit gate — this route calls the same Gemini/Claude generation backend as
  // /api/generate and was previously ungated (a real bug: unlimited free AI edits).
  // Gated on `update_screen` (existing cost in lib/credits.ts), same pattern as
  // /api/generate: check → generate → deduct only after a real success.
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
    'update_screen'
  );

  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason }, { status: 402 });
  }

  const context = `Project: ${project.name}
Design style: ${project.design_style ?? 'not specified'}
Color tokens: ${JSON.stringify(project.color_theme ?? {})}
Font pairing: ${project.font_pairing ?? 'not specified'}

User request: ${instruction}

Preserve the existing information architecture and working data-hotspot attributes unless the user explicitly asks to change navigation. Keep the existing design language coherent. Return the complete updated HTML only.`;

  let cleanCode: string;
  try {
    const code = await generateComponent(context, screen.code);
    cleanCode = code.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
  } catch (error) {
    console.error('AI edit failed', error);
    return NextResponse.json({ error: 'AI editing failed — no credits were charged. Please try again.' }, { status: 502 });
  }

  if (profile?.role !== 'admin' && gate.creditsRequired) {
    const admin = createAdminClient();
    const newBalance = subscription.credits_remaining - gate.creditsRequired;
    await admin.from('subscriptions').update({ credits_remaining: newBalance }).eq('user_id', user.id);

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

  return NextResponse.json({
    code: cleanCode,
    changes: [
      'Applied the requested visual/design change',
      'Preserved the existing screen structure where possible',
      'Kept the UFO HTML/Tailwind output format',
    ],
  });
}
