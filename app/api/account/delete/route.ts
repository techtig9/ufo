import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelPaddleSubscription } from '@/lib/paddle-api';

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('paddle_subscription_id')
    .eq('user_id', user.id)
    .single();

  if (subscription?.paddle_subscription_id) {
    await cancelPaddleSubscription(subscription.paddle_subscription_id);
  }

  const { data: projects } = await admin.from('projects').select('id').eq('user_id', user.id);
  const projectIds = (projects ?? []).map((p) => p.id);

  if (projectIds.length) {
    const { data: screens } = await admin.from('screens').select('id').in('project_id', projectIds);
    const screenIds = (screens ?? []).map((s) => s.id);

    const { data: shares } = await admin.from('shares').select('id').in('project_id', projectIds);
    const shareIds = (shares ?? []).map((s) => s.id);

    if (shareIds.length) await admin.from('comments').delete().in('share_id', shareIds);
    if (screenIds.length) await admin.from('screen_versions').delete().in('screen_id', screenIds);
    await admin.from('shares').delete().in('project_id', projectIds);
    await admin.from('screens').delete().in('project_id', projectIds);
    await admin.from('projects').delete().in('id', projectIds);
  }

  await admin.from('payments').delete().eq('user_id', user.id);
  await admin.from('referrals').delete().or(`referrer_id.eq.${user.id},referred_id.eq.${user.id}`);
  await admin.from('subscriptions').delete().eq('user_id', user.id);
  await admin.from('users').delete().eq('id', user.id);

  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error('Auth user deletion failed', authError);
    return NextResponse.json(
      { error: 'Your data was deleted but the login record needs manual cleanup — contact support.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
