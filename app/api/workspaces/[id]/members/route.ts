import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isInvitableRole, roleAtLeast, type WorkspaceRole } from '@/lib/workspaces';

/**
 * The workspace roster.
 *
 * Role changes and removals are authorised in the app AND by RLS. The app check
 * exists to return a useful 403 instead of a silent no-op — RLS filters rows
 * rather than raising, so without it a forbidden update would look like success.
 */

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

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, role, created_at, member:users(id, name, email)')
    .eq('workspace_id', id)
    .order('created_at');

  if (error) {
    console.error('[members] list failed', error.message);
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  // RLS returns an empty set rather than an error for a non-member.
  if (!data.length) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  return NextResponse.json({ members: data });
}

const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.string(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success || !isInvitableRole(parsed.data.role)) {
    // Ownership is not granted through the roster endpoint; transferring it is
    // a separate, deliberate action.
    return NextResponse.json({ error: 'Role must be admin, editor or viewer' }, { status: 400 });
  }

  const role = await callerRole(supabase, id, user.id);
  if (!roleAtLeast(role, 'admin')) {
    return NextResponse.json({ error: 'Only admins can change roles' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', parsed.data.userId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // The owner's role is not an admin's to change — otherwise any admin could
  // demote the owner and take the workspace.
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'The workspace owner’s role cannot be changed' }, { status: 403 });
  }

  const { error } = await admin
    .from('workspace_members')
    .update({ role: parsed.data.role })
    .eq('workspace_id', id)
    .eq('user_id', parsed.data.userId);

  if (error) return NextResponse.json({ error: 'Could not update the role' }, { status: 500 });

  await admin.from('workspace_activity').insert({
    workspace_id: id,
    actor_id: user.id,
    action: 'member.role_changed',
    detail: `${parsed.data.userId} → ${parsed.data.role}`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const targetId = new URL(request.url).searchParams.get('userId');
  if (!targetId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const role = await callerRole(supabase, id, user.id);
  // Leaving is always allowed; removing someone else needs admin.
  const isSelf = targetId === user.id;
  if (!isSelf && !roleAtLeast(role, 'admin')) {
    return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', targetId)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // A workspace without an owner has nobody who can delete it or manage
  // billing, so the owner cannot be removed or walk out on it.
  if (target.role === 'owner') {
    return NextResponse.json(
      { error: 'The workspace owner cannot be removed. Transfer ownership first.' },
      { status: 403 }
    );
  }

  const { error } = await admin
    .from('workspace_members')
    .delete()
    .eq('workspace_id', id)
    .eq('user_id', targetId);

  if (error) return NextResponse.json({ error: 'Could not remove the member' }, { status: 500 });

  await admin.from('workspace_activity').insert({
    workspace_id: id,
    actor_id: user.id,
    action: isSelf ? 'member.left' : 'member.removed',
    detail: targetId,
  });

  return NextResponse.json({ ok: true });
}
