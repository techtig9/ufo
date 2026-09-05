import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashSharePassword } from '@/lib/share-access';
import { recordPublishEvent } from '@/lib/publishing';

/**
 * Publish settings for a project's share link.
 *
 * Beyond the original on/off this now carries the share permissions the Master
 * Command asks for (4.A): an expiry, an optional password, and whether visitors
 * may comment.
 *
 * The security-relevant half lives in the database, not here — migration 010
 * makes an expired or password-protected share unreadable through the public
 * key, so these settings hold even against someone querying PostgREST directly
 * rather than using the app.
 */
const schema = z.object({
  projectId: z.string().uuid(),
  isPublic: z.boolean(),
  /** ISO timestamp, or null to clear. */
  expiresAt: z.string().datetime().nullable().optional(),
  /** New password, '' to remove, or undefined to leave unchanged. */
  password: z.string().max(200).nullable().optional(),
  allowComments: z.boolean().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid publish settings' },
      { status: 400 }
    );
  }
  const { projectId, isPublic, expiresAt, password, allowComments } = parsed.data;

  // Ownership through the caller's own session, so RLS applies. A workspace
  // editor reaches the project through the workspace policies added in 010.
  const { data: project } = await supabase
    .from('projects')
    .select('id, workspace_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'The expiry date must be in the future' }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    is_public: isPublic,
    published_at: isPublic ? new Date().toISOString() : null,
  };
  if (expiresAt !== undefined) update.expires_at = expiresAt;
  if (allowComments !== undefined) update.allow_comments = allowComments;

  // '' or null clears the password; a value sets it. Undefined leaves it alone,
  // so toggling visibility does not silently drop protection.
  if (password !== undefined) {
    update.password_hash = password ? hashSharePassword(password) : null;
  }

  // The previous visibility, so the log can tell a genuine publish/unpublish
  // apart from a settings change that left visibility alone.
  const { data: before } = await supabase
    .from('shares')
    .select('is_public')
    .eq('project_id', projectId)
    .maybeSingle();

  const { data: share, error } = await supabase
    .from('shares')
    .update(update)
    .eq('project_id', projectId)
    .select('id, slug, is_public, published_at, expires_at, allow_comments, password_hash')
    .single();

  if (error || !share) {
    console.error('[shares] publish failed', error?.message);
    return NextResponse.json({ error: 'Could not update the share link' }, { status: 500 });
  }

  await recordPublishEvent({
    shareId: share.id,
    projectId,
    actorId: user.id,
    action:
      before?.is_public === isPublic
        ? 'settings_changed'
        : isPublic
          ? 'published'
          : 'unpublished',
    hadPassword: !!share.password_hash,
    expiresAt: share.expires_at,
    allowComments: share.allow_comments ?? true,
  });

  if (project.workspace_id) {
    const admin = createAdminClient();
    await admin.from('workspace_activity').insert({
      workspace_id: project.workspace_id,
      actor_id: user.id,
      project_id: projectId,
      action: isPublic ? 'project.published' : 'project.unpublished',
    });
  }

  // The hash never leaves the server; the client only needs to know whether a
  // password is set.
  const { password_hash, ...rest } = share;
  return NextResponse.json({ ...rest, hasPassword: !!password_hash });
}
