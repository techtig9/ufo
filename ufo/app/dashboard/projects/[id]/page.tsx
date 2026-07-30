import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProjectWorkspace } from '@/components/editor/project-workspace';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single();

  if (!project) notFound();

  const [{ data: screens }, { data: share }] = await Promise.all([
    supabase.from('screens').select('*').eq('project_id', project.id).order('order_index'),
    supabase.from('shares').select('slug, is_public').eq('project_id', project.id).single(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm capitalize text-white/40">{project.project_type}</p>
      </div>
      <ProjectWorkspace
        project={project}
        screens={screens ?? []}
        shareSlug={share?.slug ?? ''}
        isPublic={share?.is_public ?? false}
      />
    </div>
  );
}
