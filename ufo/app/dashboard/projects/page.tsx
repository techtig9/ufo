import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';

export default async function ProjectsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, project_type, created_at, is_favorite')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Projects</h1>
        <Link href="/dashboard/ai-designer">
          <Button>+ New Project</Button>
        </Link>
      </div>

      {!projects?.length ? (
        <Panel className="text-center text-white/50">
          No projects yet.{' '}
          <Link href="/dashboard/ai-designer" className="text-studio-coral hover:underline">
            Generate your first one
          </Link>
          .
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
              <Panel className="h-full">
                <div className="flex items-start justify-between">
                  <div className="aspect-video w-full rounded-lg bg-gradient-to-br from-studio-citron/20 to-studio-coral/10" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="truncate font-medium">{p.name}</p>
                  {p.is_favorite && <span className="text-studio-indigo">{'\u2605'}</span>}
                </div>
                <p className="text-xs capitalize text-white/40">{p.project_type}</p>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
