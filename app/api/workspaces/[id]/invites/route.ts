import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
  isInvitableRole,
  roleAtLeast,
  type WorkspaceRole,
} from '@/lib/workspaces';
import { sendWorkspaceInviteEmail } from '@/lib/email';
import { withObservability } from '@/lib/observability';

/** Create, list and revoke workspace invitations. */

const createSchema = z.object({
  email: z.string().email().max(200),
  role: z.string(),
});

async function callerRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.role as WorkspaceRole) ?? null;
}

async function handleGET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Never selects token_hash: an admin listing invites has no need for the
  // credential, and not returning it means it cannot leak through this route.
  const { data, error } = await supabase
    .from('workspace_invites')
    .select('id, email, role, expires_at, accepted_at, created_at')
    .eq('workspace_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  return NextResponse.json({ invites: data ?? [] });
}

async function handlePOST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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

  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'A valid email is required' },
      { status: 400 }
    );
  }
  if (!isInvitableRole(parsed.data.role)) {
    return NextResponse.json({ error: 'Role must be admin, editor or viewer' }, { status: 400 });
  }

  const role = await callerRole(supabase, id, user.id);
  if (!roleAtLeast(role, 'admin')) {
    return NextResponse.json({ error: 'Only admins can invite people' }, { status: 403 });
  }

  const admin = createAdminClient();
  const email = parsed.data.email.toLowerCase().trim();

  // Someone already in the workspace does not need an invitation.
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    const { data: alreadyMember } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', id)
      .eq('user_id', existingUser.id)
      .maybeSingle();
    if (alreadyMember) {
      return NextResponse.json({ error: 'That person is already a member' }, { status: 409 });
    }
  }

  const token = generateInviteToken();
  const expiresAt = inviteExpiry();

  // Re-inviting the same address replaces the pending invite rather than
  // accumulating rows, matching the partial unique index in migration 010. The
  // old token stops working, which is the correct behaviour for a re-send.
  await admin
    .from('workspace_invites')
    .delete()
    .eq('workspace_id', id)
    .ilike('email', email)
    .is('accepted_at', null);

  const { data: invite, error } = await admin
    .from('workspace_invites')
    .insert({
      workspace_id: id,
      email,
      role: parsed.data.role,
      token_hash: hashInviteToken(token),
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, email, role, expires_at, created_at')
    .single();

  if (error || !invite) {
    console.error('[invites] create failed', error?.message);
    return NextResponse.json({ error: 'Could not create the invitation' }, { status: 500 });
  }

  const { data: workspace } = await admin
    .from('workspaces')
    .select('name')
    .eq('id', id)
    .maybeSingle();

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const acceptUrl = `${base}/invite?token=${encodeURIComponent(token)}`;

  await sendWorkspaceInviteEmail(email, {
    workspaceName: workspace?.name ?? 'a workspace',
    role: parsed.data.role,
    acceptUrl,
    expiresAt: expiresAt.toISOString(),
  });

  await admin.from('workspace_activity').insert({
    workspace_id: id,
    actor_id: user.id,
    action: 'member.invited',
    detail: `${email} as ${parsed.data.role}`,
  });

  // The raw token is returned exactly once, so an admin can copy the link if
  // the email does not arrive. It is never readable again from the database.
  return NextResponse.json({ invite, acceptUrl });
}

async function handleDELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const inviteId = new URL(request.url).searchParams.get('inviteId');
  if (!inviteId) return NextResponse.json({ error: 'inviteId is required' }, { status: 400 });

  const role = await callerRole(supabase, id, user.id);
  if (!roleAtLeast(role, 'admin')) {
    return NextResponse.json({ error: 'Only admins can revoke invitations' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('workspace_invites')
    .delete()
    .eq('id', inviteId)
    .eq('workspace_id', id);

  if (error) return NextResponse.json({ error: 'Could not revoke the invitation' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * Wrapped for observability: each request gets a correlation id (honouring an
 * upstream `x-request-id`), is timed and logged with its status, and a thrown
 * error becomes a 500 carrying only that id — never the exception's message,
 * which can contain a connection string or schema detail.
 */
export const GET = withObservability('workspaces.invites', handleGET);
export const POST = withObservability('workspaces.invites', handlePOST);
export const DELETE = withObservability('workspaces.invites', handleDELETE);
