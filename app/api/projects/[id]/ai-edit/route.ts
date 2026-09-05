import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateComponent } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';
import { canUseFeature, PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import { reserveCredits, refundCredits } from '@/lib/credits-server';
import { sendLowCreditsEmail } from '@/lib/email';

// `routeContext`, not `context` — this handler already uses `context` further
// down for the AI prompt it builds.
export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const params = await routeContext.params;
  // Correlates the reservation, the provider attempts and any refund.
  const requestId = crypto.randomUUID().slice(0, 8);
  const supabase = await createClient();
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

  // Credit gate — this route calls the same generation backend as /api/generate
  // and was once ungated (a real bug: unlimited free AI edits). Gated on
  // `update_screen` (cost in lib/credits.ts). The gate is an early, friendly
  // rejection; reserveCredits() below is what actually enforces the balance.
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

  // Reserve before the work, refund if it fails. The previous read-modify-write
  // here had the same double-spend race as /api/generate: two concurrent edits
  // both read the balance and both wrote `balance - cost`, charging once for
  // two edits.
  const cost = profile?.role === 'admin' ? 0 : (gate.creditsRequired ?? 0);
  let reserved = false;

  if (cost > 0) {
    const reservation = await reserveCredits(user.id, cost, 'update_screen', requestId);
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

  async function refund(reason: string) {
    if (!reserved) return;
    reserved = false;
    await refundCredits(user!.id, cost, 'update_screen', requestId, reason);
  }

  let cleanCode: string;
  try {
    const code = await generateComponent(context, screen.code, {
      requestId,
      userId: user.id,
      signal: request.signal,
    });
    cleanCode = code.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();

    // An edit that returns nothing usable is a failed edit, not a screen the
    // user should be charged for and then asked to apply.
    if (!cleanCode) throw new Error('the model returned an empty screen');
  } catch (error) {
    console.error('AI edit failed', { requestId, error: String(error) });
    await refund('refund_ai_edit_failed');
    return NextResponse.json(
      { error: 'AI editing failed — no credits were charged. Please try again.', requestId },
      { status: 502 }
    );
  }

  if (cost > 0) {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from('subscriptions')
      .select('credits_remaining, plan')
      .eq('user_id', user.id)
      .maybeSingle();

    const planTotal = PLAN_MONTHLY_CREDITS[sub?.plan as keyof typeof PLAN_MONTHLY_CREDITS];
    const balanceNow = sub?.credits_remaining ?? 0;
    const threshold = planTotal * 0.1;

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

  return NextResponse.json({
    requestId,
    code: cleanCode,
    changes: [
      'Applied the requested visual/design change',
      'Preserved the existing screen structure where possible',
      'Kept the UFO HTML/Tailwind output format',
    ],
  });
}
