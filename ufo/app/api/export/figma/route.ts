import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canUseFeature } from '@/lib/credits';

// Real Figma REST API integration is Phase 2 (needs OAuth app review — see
// Hard Constraint 4 in the build command doc). This route is fully wired up
// end to end — auth, plan gate, credit deduction, DB update — it just
// doesn't call Figma yet.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { projectId } = await request.json();
  const admin = createAdminClient();

  const [{ data: profile }, { data: subscription }, { data: project }] = await Promise.all([
    supabase.from('users').select('role').eq('id', user.id).single(),
    supabase.from('subscriptions').select('plan, credits_remaining').eq('user_id', user.id).single(),
    supabase.from('projects').select('id, user_id').eq('id', projectId).single(),
  ]);

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!subscription) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
  }

  const gate = canUseFeature(
    { role: (profile?.role as 'user' | 'admin') ?? 'user', plan: subscription.plan, creditsRemaining: subscription.credits_remaining },
    'export_figma'
  );
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason }, { status: 402 });
  }

  await admin.from('projects').update({ figma_export_status: 'queued' }).eq('id', projectId);

  if (profile?.role !== 'admin' && gate.creditsRequired) {
    await admin
      .from('subscriptions')
      .update({ credits_remaining: subscription.credits_remaining - gate.creditsRequired })
      .eq('user_id', user.id);
  }

  return NextResponse.json({ status: 'queued' });
}
