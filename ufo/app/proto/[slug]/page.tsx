import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PrototypeViewer } from '@/components/prototype-viewer/prototype-viewer';
import { CommentsPanel } from '@/components/prototype-viewer/comments-panel';
import { GridField } from '@/components/ui/grid-field';

export default async function PublicProtoPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: share } = await supabase
    .from('shares')
    .select('id, project_id, is_public')
    .eq('slug', params.slug)
    .single();

  if (!share || !share.is_public) notFound();

  const [{ data: project }, { data: screens }] = await Promise.all([
    supabase.from('projects').select('name').eq('id', share.project_id).single(),
    supabase.from('screens').select('*').eq('project_id', share.project_id).order('order_index'),
  ]);

  if (!screens?.length) notFound();

  const { data: comments } = await supabase
    .from('comments')
    .select('id, author_name, body, created_at, screen_id')
    .eq('share_id', share.id)
    .order('created_at', { ascending: false });

  const firstScreen = screens[0];

  return (
    <div className="relative min-h-screen px-6 py-12">
      <GridField strength="subtle" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-wide text-white/40">Prototype</p>
          <h1 className="font-display text-2xl font-semibold">{project?.name}</h1>
          <p className="mt-1 text-xs text-white/30">Built with ufo</p>
        </div>

        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
          <PrototypeViewer screens={screens} />
          <CommentsPanel
            shareId={share.id}
            screenId={firstScreen.id}
            initialComments={(comments ?? []).filter((c) => c.screen_id === firstScreen.id)}
          />
        </div>
      </div>
    </div>
  );
}
