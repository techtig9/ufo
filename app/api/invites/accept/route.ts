import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashInviteToken } from '@/lib/workspaces';
import { checkAnonymousRateLimit, clientIpFrom } from '@/lib/rate-limit';
import { withObservability } from '@/lib/observability';

/**
 * Accept a workspace invitation.
 *
 * Runs entirely with the service role, because the accepting user is by
 * definition not yet a member and so cannot satisfy any workspace policy — but
 * every authorisation decision is still made here explicitly:
 *
 *   * the caller must be signed in, so an invite cannot be redeemed anonymously;
 *   * the token is looked up BY HASH, so a database leak yields no usable link;
 *   * the invite must be unexpired and unaccepted;
 *   * the invite's email must match the signed-in account, so a forwarded link
 *     cannot be redeemed by whoever happens to receive it.
 */
async function handlePOST(request: Request) {
  // Rate limited by IP: the token is high-entropy, but an unthrottled endpoint
  // that reports whether a token exists is still worth closing.
  const rate = await checkAnonymousRateLimit(clientIpFrom(request.headers), 'invite-accept', 20, 600);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again shortly.' }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in with the invited email address to accept this invitation.' },
      { status: 401 }
    );
  }

  let token: string | undefined;
  try {
    ({ token } = (await request.json()) as { token?: string });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from('workspace_invites')
    .select('id, workspace_id, email, role, expires_at, accepted_at')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle();

  // One message for every failure mode, so this cannot be used to probe which
  // tokens exist.
  const invalid = NextResponse.json(
    { error: 'This invitation is not valid, has expired, or has already been used.' },
    { status: 404 }
  );

  if (!invite || invite.accepted_at) return invalid;
  if (new Date(invite.expires_at).getTime() < Date.now()) return invalid;

  if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invitation was sent to a different email address. Sign in as ${invite.email} to accept it.` },
      { status: 403 }
    );
  }

  const { error: memberError } = await admin
    .from('workspace_members')
    .upsert(
      { workspace_id: invite.workspace_id, user_id: user.id, role: invite.role },
      { onConflict: 'workspace_id,user_id' }
    );

  if (memberError) {
    console.error('[invites] accept failed', memberError.message);
    return NextResponse.json({ error: 'Could not join the workspace' }, { status: 500 });
  }

  await admin
    .from('workspace_invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq('id', invite.id);

  await admin.from('workspace_activity').insert({
    workspace_id: invite.workspace_id,
    actor_id: user.id,
    action: 'member.joined',
    detail: invite.role,
  });

  const { data: workspace } = await admin
    .from('workspaces')
    .select('id, name')
    .eq('id', invite.workspace_id)
    .maybeSingle();

  return NextResponse.json({ ok: true, workspace, role: invite.role });
}

/**
 * Wrapped for observability: each request gets a correlation id (honouring an
 * upstream `x-request-id`), is timed and logged with its status, and a thrown
 * error becomes a 500 carrying only that id — never the exception's message,
 * which can contain a connection string or schema detail.
 */
export const POST = withObservability('invites.accept', handlePOST);
