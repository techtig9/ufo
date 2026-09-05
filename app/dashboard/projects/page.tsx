import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectSearch } from '@/components/projects/project-search';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, project_type, created_at, is_favorite, tags, archived_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-studio-citron">Workspace</p>
          <h1 className="font-display text-2xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-white/40">Generate, refine, prototype and share your products.</p>
        </div>
        <Link href="/dashboard/ai-designer">
          <Button>+ New Project</Button>
        </Link>
      </div>

      {!projects?.length ? (
        <EmptyState
          title="Your workspace is empty"
          description="Generate your first AI prototype to get started."
          action={<Link href="/dashboard/ai-designer"><Button>Open AI Designer</Button></Link>}
        />
      ) : (
        <ProjectSearch projects={projects} />
      )}
    </div>
  );
}

