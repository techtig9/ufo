import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('users').select('role').eq('id', user.id).single(),
    supabase.from('subscriptions').select('plan, credits_remaining').eq('user_id', user.id).single(),
  ]);

  return NextResponse.json({
    role: profile?.role ?? 'user',
    plan: subscription?.plan ?? 'free',
    creditsRemaining: subscription?.credits_remaining ?? 0,
  });
}
