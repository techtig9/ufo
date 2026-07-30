'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TopnavProps {
  userName: string | null;
  plan: string;
  creditsRemaining: number;
}

export function Topnav({ userName, plan, creditsRemaining }: TopnavProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="panel sticky top-4 z-10 mx-4 mt-4 flex items-center justify-between rounded-panel px-5 py-3 md:mr-4 md:ml-0">
      <input
        type="search"
        placeholder="Search projects\u2026"
        className="w-64 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none focus:border-studio-citron"
      />
      <div className="flex items-center gap-4">
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
          {creditsRemaining.toLocaleString()} credits &middot; {plan}
        </span>
        <button className="text-white/50 hover:text-white" aria-label="Notifications">
          {'\u{1F514}'}
        </button>
        <div className="group relative">
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-studio-citron to-studio-indigo text-sm font-medium">
            {(userName ?? 'U').charAt(0).toUpperCase()}
          </button>
          <div className="panel invisible absolute right-0 mt-2 w-40 rounded-panel p-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
            <p className="truncate px-2 py-1 text-xs text-white/50">{userName}</p>
            <button
              onClick={handleLogout}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
