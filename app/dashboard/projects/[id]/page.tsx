import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProjectWorkspace } from '@/components/editor/project-workspace';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  // No `.eq('user_id', ...)` filter: since migration 010 a project can also be
  // reached through workspace membership, and repeating the ownership test here
  // would 404 workspace collaborators on projects RLS grants them. RLS is the
  // single authority — an outsider still gets no row.
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: screens }, { data: share }] = await Promise.all([
    supabase
      .from('screens')
      .select('*')
      .eq('project_id', project.id)
      .order('order_index'),
    supabase
      .from('shares')
      .select('slug, is_public, published_at, expires_at, allow_comments, password_hash')
      .eq('project_id', project.id)
      .maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 pb-10">
      <ProjectWorkspace
        project={project}
        screens={screens ?? []}
        share={{
          slug: share?.slug ?? '',
          isPublic: share?.is_public ?? false,
          publishedAt: share?.published_at ?? null,
          expiresAt: share?.expires_at ?? null,
          // The hash itself is never sent to the browser — the UI only needs to
          // know whether one exists.
          hasPassword: !!share?.password_hash,
          allowComments: share?.allow_comments ?? true,
        }}
      />
    </div>
  );
}
