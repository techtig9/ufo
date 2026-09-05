import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { PublicPrototype } from '@/components/prototype-viewer/public-prototype';
import { GridField } from '@/components/ui/grid-field';

async function loadShare(slug: string) {
  const supabase = await createClient();
  const { data: share } = await supabase
    .from('shares')
    .select('id, project_id, is_public')
    .eq('slug', slug)
    .single();
  if (!share || !share.is_public) return null;

  const { data: project } = await supabase.from('projects').select('name, user_id').eq('id', share.project_id).single();
  return { share, project };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadShare(slug);
  if (!data?.project) return { title: 'Prototype not found' };

  const title = `${data.project.name} — Prototype`;
  const description = `An interactive prototype built with ufo. View screens, click through the flow, and leave feedback.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
    robots: { index: false, follow: false },
  };
}

export default async function PublicProtoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadShare(slug);
  if (!data) notFound();
  const { share, project } = data;

  const [{ data: { user } }, { data: screens }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('screens').select('*').eq('project_id', share.project_id).order('order_index'),
  ]);

  if (!screens?.length) notFound();

  const { data: comments } = await supabase
    .from('comments')
    .select('id, author_name, body, created_at, screen_id, x, y, resolved, parent_id')
    .eq('share_id', share.id)
    .order('created_at', { ascending: false });

  const isOwner = !!user && user.id === project?.user_id;

  return (
    <div className="relative min-h-screen px-6 py-12">
      <GridField strength="subtle" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-wide text-fg-faint">Prototype</p>
          <h1 className="font-display text-2xl font-semibold">{project?.name}</h1>
          <p className="mt-1 text-xs text-fg-faint">Built with ufo</p>
        </div>

        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
          <PublicPrototype
            shareId={share.id}
            screens={screens}
            comments={comments ?? []}
            isOwner={isOwner}
          />
        </div>
      </div>
    </div>
  );
}
