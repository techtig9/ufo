import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProjectWorkspace } from '@/components/editor/project-workspace';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!project) notFound();

  const [{ data: screens }, { data: share }] = await Promise.all([
    supabase
      .from('screens')
      .select('*')
      .eq('project_id', project.id)
      .order('order_index'),
    supabase
      .from('shares')
      .select('slug, is_public, published_at')
      .eq('project_id', project.id)
      .maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 pb-10">
      <ProjectWorkspace
        project={project}
        screens={screens ?? []}
        shareSlug={share?.slug ?? ''}
        isPublic={share?.is_public ?? false}
        publishedAt={share?.published_at ?? null}
      />
    </div>
  );
}
