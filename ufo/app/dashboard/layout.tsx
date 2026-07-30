import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topnav } from '@/components/dashboard/topnav';
import { GridField } from '@/components/ui/grid-field';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, credits_remaining')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="relative flex min-h-screen">
      <GridField strength="subtle" className="fixed" />
      <Sidebar />
      <div className="relative flex-1">
        <Topnav
          userName={profile?.name ?? user.email ?? null}
          plan={subscription?.plan ?? 'free'}
          creditsRemaining={subscription?.credits_remaining ?? 0}
        />
        <main className="p-4 md:pl-0">{children}</main>
      </div>
    </div>
  );
}
