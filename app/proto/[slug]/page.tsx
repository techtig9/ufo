import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PublicPrototype } from '@/components/prototype-viewer/public-prototype';
import { SharePasswordGate } from '@/components/prototype-viewer/share-password-gate';
import { GridField } from '@/components/ui/grid-field';
import { verifyShareGrant, SHARE_GRANT_COOKIE_PREFIX } from '@/lib/share-access';
import { recordShareView } from '@/lib/publishing';

/**
 * Public prototype.
 *
 * Three states now, not one:
 *   * open        — public, unexpired, no password: read through the anon
 *                   client so RLS is what authorises it;
 *   * locked      — password set: nothing is fetched until a valid grant cookie
 *                   proves the visitor answered it;
 *   * gone        — unpublished or expired: 404, the same as a slug that never
 *                   existed, so an expired link reveals nothing.
 *
 * The locked path reads with the service role, because migration 010 removes
 * password-protected shares from the public key's reach entirely — the password
 * would be decorative if the anon client could still read the screens.
 */

interface ShareRow {
  id: string;
  project_id: string;
  is_public: boolean;
  expires_at: string | null;
  password_hash: string | null;
  allow_comments: boolean;
}

/** Looked up with the service role so the three states can be told apart. */
async function loadShare(slug: string): Promise<ShareRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('shares')
    .select('id, project_id, is_public, expires_at, password_hash, allow_comments')
    .eq('slug', slug)
    .maybeSingle();
  return (data as ShareRow) ?? null;
}

function isLive(share: ShareRow): boolean {
  if (!share.is_public) return false;
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) return false;
  return true;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const share = await loadShare(slug);
  if (!share || !isLive(share)) return { title: 'Prototype not found' };

  const admin = createAdminClient();
  const { data: project } = await admin
    .from('projects')
    .select('name')
    .eq('id', share.project_id)
    .maybeSingle();

  if (!project) return { title: 'Prototype not found' };

  // A password-protected prototype must not leak its name into link previews.
  if (share.password_hash) {
    return {
      title: 'Protected prototype',
      description: 'This prototype is password protected.',
      robots: { index: false, follow: false },
    };
  }

  const title = `${project.name} — Prototype`;
  const description =
    'An interactive prototype built with ufo. View screens, click through the flow, and leave feedback.';

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
  const share = await loadShare(slug);

  // Unpublished, expired or nonexistent all look identical from outside.
  if (!share || !isLive(share)) notFound();

  if (share.password_hash) {
    const jar = await cookies();
    const grant = jar.get(`${SHARE_GRANT_COOKIE_PREFIX}${share.id}`)?.value;
    if (!verifyShareGrant(grant, share.id)) {
      return <SharePasswordGate slug={slug} />;
    }
  }

  // Password-protected shares are unreadable via the anon key by design, so the
  // unlocked path reads with the service role. The grant above is what
  // authorises it.
  const db = share.password_hash ? createAdminClient() : await createClient();

  const [{ data: project }, { data: screens }, { data: comments }] = await Promise.all([
    db.from('projects').select('name, user_id').eq('id', share.project_id).maybeSingle(),
    db.from('screens').select('*').eq('project_id', share.project_id).order('order_index'),
    db
      .from('comments')
      .select('id, author_name, author_id, body, created_at, screen_id, x, y, resolved, parent_id, assigned_to')
      .eq('share_id', share.id)
      .order('created_at', { ascending: false }),
  ]);

  if (!screens?.length) notFound();

  // Ownership is read from the visitor's own session, never from the admin
  // client, so the moderation controls cannot be handed to the wrong person.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = !!user && user.id === project?.user_id;

  // Record the view. Deliberately not awaited into the render path beyond the
  // insert itself, never throws, and stores nothing identifying — no IP, no
  // user agent string, only a coarse device bucket and the referrer's host.
  // That is why prototype analytics needs no cookie and no consent entry.
  // The owner's own visits are excluded so the number means "someone else
  // looked at this", which is the question a designer is actually asking.
  if (!isOwner) {
    const requestHeaders = await headers();
    await recordShareView({
      shareId: share.id,
      projectId: share.project_id,
      userAgent: requestHeaders.get('user-agent'),
      referrer: requestHeaders.get('referer'),
    });
  }

  return (
    <div className="relative min-h-screen px-6 py-12">
      <GridField strength="subtle" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-wide text-fg-faint">Prototype</p>
          <h1 className="font-display text-2xl font-semibold">{project?.name}</h1>
          <p className="mt-1 text-xs text-fg-faint">Built with ufo</p>
          {share.expires_at && (
            <p className="mt-2 text-[11px] text-fg-faint">
              This link expires on {new Date(share.expires_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
          <PublicPrototype
            shareId={share.id}
            screens={screens}
            comments={comments ?? []}
            isOwner={isOwner}
            allowComments={share.allow_comments}
            viewerId={user?.id ?? null}
          />
        </div>
      </div>
    </div>
  );
}
