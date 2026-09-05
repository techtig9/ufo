import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { canUseFeature } from '@/lib/credits';
import { reserveCredits, refundCredits } from '@/lib/credits-server';
import { route as routeAi } from '@/lib/ai/router';
import { parseAiJson } from '@/lib/ai/json';
import { AI_ACTIONS, isAiActionId, type ActionContext } from '@/lib/ai/actions';

/**
 * Runs one AI action against a project (Master Command 2.C).
 *
 * One route rather than ten near-identical ones: the actions differ in prompt,
 * output shape, price and plan gate, and all of that is data in
 * lib/ai/actions.ts. Everything else — ownership, rate limiting, the credit
 * reservation, the provider cascade, schema validation — is shared, so a new
 * action cannot accidentally ship without a credit gate or an ownership check.
 *
 * Analysis actions never write. An "audit" that silently rewrote your screens
 * would not be an audit, so the route returns findings and leaves the project
 * untouched; the caller decides whether to act on them.
 */
export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const params = await routeContext.params;
  const requestId = crypto.randomUUID().slice(0, 8);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const rateLimit = await checkRateLimit(user.id, 'ai-action', 20, 600);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many AI actions. Please wait a moment.' },
      { status: 429 }
    );
  }

  let body: { action?: unknown; screenId?: unknown; instruction?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!isAiActionId(body.action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  const def = AI_ACTIONS[body.action];

  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  if (def.needsInstruction && !instruction) {
    return NextResponse.json(
      { error: `"${def.label}" needs a short description of what you want.` },
      { status: 400 }
    );
  }
  if (instruction.length > 1200) {
    return NextResponse.json({ error: 'Instruction is too long' }, { status: 400 });
  }

  // Ownership, through the caller's own session so RLS applies.
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, design_style, color_theme, font_pairing')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: screens } = await supabase
    .from('screens')
    .select('id, name, code, order_index')
    .eq('project_id', params.id)
    .order('order_index');

  let targetScreen: { id: string; name: string; code: string } | undefined;
  if (def.needsScreen) {
    const screenId = typeof body.screenId === 'string' ? body.screenId : '';
    targetScreen = (screens ?? []).find((s) => s.id === screenId);
    if (!targetScreen) {
      return NextResponse.json(
        { error: 'Select a screen for this action.' },
        { status: 400 }
      );
    }
  }

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('users').select('role').eq('id', user.id).single(),
    supabase.from('subscriptions').select('plan, credits_remaining').eq('user_id', user.id).single(),
  ]);
  if (!subscription) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
  }

  const role = (profile?.role as 'user' | 'admin') ?? 'user';
  const gate = canUseFeature(
    { role, plan: subscription.plan, creditsRemaining: subscription.credits_remaining },
    def.credit
  );
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, action: def.id }, { status: 402 });
  }

  const cost = role === 'admin' ? 0 : (gate.creditsRequired ?? 0);
  let reserved = false;

  if (cost > 0) {
    const reservation = await reserveCredits(user.id, cost, def.credit, requestId);
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
    await refundCredits(user!.id, cost, def.credit, requestId, reason);
  }

  const ctx: ActionContext = {
    projectName: project.name,
    designStyle: project.design_style,
    colorTheme: project.color_theme,
    fontPairing: project.font_pairing,
    screenName: targetScreen?.name,
    screenCode: targetScreen?.code,
    allScreens: (screens ?? []).map((s) => ({ name: s.name, code: s.code })),
    instruction: instruction || undefined,
    tokens: project.color_theme,
  };

  try {
    const { text, provider } = await routeAi(
      [
        { role: 'system', content: def.system },
        { role: 'user', content: def.buildPrompt(ctx) },
      ],
      {
        requestId,
        task: def.id,
        userId: user.id,
        signal: request.signal,
        preferHighQuality: def.highQuality,
        jsonMode: def.kind !== 'screen_rewrite',
        maxTokens: def.kind === 'analysis' ? 3000 : 8000,
      }
    );

    if (def.kind === 'screen_rewrite') {
      const code = text
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      // An empty rewrite is a failed action, not a screen worth charging for.
      if (!code) throw new Error('the model returned an empty screen');

      // Proposed, not applied: the client previews it and saves through the
      // existing PATCH /api/screens/[id], which is what snapshots the version
      // history. Writing here would bypass that.
      return NextResponse.json({
        requestId,
        action: def.id,
        kind: def.kind,
        provider,
        screenId: targetScreen!.id,
        code,
      });
    }

    const parsed = def.schema ? parseAiJson(text, def.schema) : text;
    return NextResponse.json({
      requestId,
      action: def.id,
      kind: def.kind,
      provider,
      screenId: targetScreen?.id,
      result: parsed,
    });
  } catch (err) {
    console.error('[ai-action] failed', { requestId, action: def.id, error: String(err) });
    await refund('refund_ai_action_failed');
    return NextResponse.json(
      {
        error: `${def.label} failed — no credits were charged. Please try again.`,
        requestId,
      },
      { status: 502 }
    );
  }
}

/** The catalogue, so the UI can render exactly the actions that exist. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  return NextResponse.json({
    actions: Object.values(AI_ACTIONS).map((a) => ({
      id: a.id,
      kind: a.kind,
      label: a.label,
      description: a.description,
      needsScreen: a.needsScreen,
      needsInstruction: a.needsInstruction,
      credit: a.credit,
    })),
  });
}
