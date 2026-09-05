/**
 * Publishing: the publish log, and prototype view analytics.
 *
 * Scope, stated plainly because the Master Command's publishing list is
 * conditional on real hosting: UFO does not host anything. Publishing makes a
 * share link live at /proto/<slug> on UFO's own domain. Custom domains, SSL,
 * subdomains and deployment rollback belong to infrastructure that does not
 * exist here — they are labelled unavailable in the product, not stubbed.
 */

/** What UFO can actually tell a user about a published prototype. */
export interface PublishStatus {
  state: 'draft' | 'live' | 'expired' | 'locked';
  label: string;
  detail: string;
}

/**
 * How the caller knows whether a password is set.
 *
 * A union rather than two optional fields, so a caller cannot supply both and
 * leave the answer to a precedence rule. That matters here: reporting "Live"
 * for a link that is actually gated is merely confusing, but reporting
 * "password required" for one that is open would tell an owner their link is
 * protected when anyone can read it.
 *
 * The editor holds only the boolean — the hash never reaches the browser — and
 * server-side callers hold the row.
 */
type PasswordState = { hasPassword: boolean } | { password_hash: string | null };

export function publishStatus(
  share: {
    is_public: boolean;
    expires_at: string | null;
    published_at: string | null;
  } & PasswordState
): PublishStatus {
  const hasPassword = 'hasPassword' in share ? share.hasPassword : !!share.password_hash;

  if (!share.is_public) {
    return {
      state: 'draft',
      label: 'Not published',
      detail: 'The link returns a 404 for everyone until you publish.',
    };
  }

  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return {
      state: 'expired',
      label: 'Expired',
      detail: 'The link has passed its expiry date and no longer opens for anyone.',
    };
  }

  if (hasPassword) {
    return {
      state: 'locked',
      label: 'Live — password required',
      detail: 'Anyone with the link and the password can open it.',
    };
  }

  return {
    state: 'live',
    label: 'Live',
    detail: 'Anyone with the link can open it.',
  };
}

/** Coarse device bucket. Deliberately not the user agent string. */
export function deviceBucket(userAgent: string | null): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  if (/mozilla|webkit|chrome|safari|firefox|edge/.test(ua)) return 'desktop';
  return 'unknown';
}

/**
 * The referrer's HOST only — never the full URL, which can carry a path and
 * query the referring site did not intend to share.
 */
export function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname;
    return host ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

/**
 * Record a view of a published prototype.
 *
 * Never throws and never blocks the page: analytics failing is not a reason for
 * a client not to see their prototype.
 */
export async function recordShareView(input: {
  shareId: string;
  projectId: string;
  userAgent: string | null;
  referrer: string | null;
}): Promise<void> {
  try {
    // Imported lazily, like the AI router's telemetry sink: it needs the
    // service-role key, and the pure helpers above must stay importable (and
    // unit-testable) without any Supabase environment.
    const { createAdminClient } = await import('./supabase/admin');
    const admin = createAdminClient();
    await admin.from('share_views').insert({
      share_id: input.shareId,
      project_id: input.projectId,
      device: deviceBucket(input.userAgent),
      referrer_host: referrerHost(input.referrer),
    });
  } catch (e) {
    console.error('[publishing] view not recorded', e instanceof Error ? e.message : 'unknown');
  }
}

/** Append to the publish log. Service-role only — the table has no write policy. */
export async function recordPublishEvent(input: {
  shareId: string;
  projectId: string;
  actorId: string | null;
  action: 'published' | 'unpublished' | 'settings_changed';
  hadPassword: boolean;
  expiresAt: string | null;
  allowComments: boolean;
}): Promise<void> {
  try {
    const { createAdminClient } = await import('./supabase/admin');
    const admin = createAdminClient();
    await admin.from('share_publish_events').insert({
      share_id: input.shareId,
      project_id: input.projectId,
      actor_id: input.actorId,
      action: input.action,
      had_password: input.hadPassword,
      expires_at: input.expiresAt,
      allow_comments: input.allowComments,
    });
  } catch (e) {
    console.error('[publishing] event not recorded', e instanceof Error ? e.message : 'unknown');
  }
}
