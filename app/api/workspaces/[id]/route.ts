import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { roleAtLeast, type WorkspaceRole } from '@/lib/workspaces';

/** A single workspace: read it, rename it, delete it. */

async function membership(
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

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, owner_id, created_at')
    .eq('id', id)
    .maybeSingle();

  // RLS hides a workspace the caller is not in, so "no row" and "does not
  // exist" are the same answer — deliberately, so this cannot enumerate
  // workspaces.
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const role = await membership(supabase, id, user.id);
  return NextResponse.json({ workspace: { ...workspace, role } });
}

const patchSchema = z.object({ name: z.string().trim().min(1).max(80) });

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
  if (!parsed.success) {
    return NextResponse.json({ error: 'A workspace name of 1–80 characters is required' }, { status: 400 });
  }

  const role = await membership(supabase, id, user.id);
  if (!roleAtLeast(role, 'admin')) {
    return NextResponse.json({ error: 'Only admins can rename the workspace' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: workspace, error } = await admin
    .from('workspaces')
    .update({ name: parsed.data.name })
    .eq('id', id)
    .select('id, name, owner_id, created_at')
    .single();

  if (error || !workspace) {
    return NextResponse.json({ error: 'Could not rename the workspace' }, { status: 500 });
  }

  await admin.from('workspace_activity').insert({
    workspace_id: id,
    actor_id: user.id,
    action: 'workspace.renamed',
    detail: parsed.data.name,
  });

  return NextResponse.json({ workspace: { ...workspace, role } });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const role = await membership(supabase, id, user.id);
  // Deleting is the owner's alone. An admin can manage people; they cannot
  // dissolve the workspace they were invited into.
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only the workspace owner can delete it' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Projects are deliberately NOT cascaded away with the workspace:
  // `projects.workspace_id` is ON DELETE SET NULL, so every project reverts to
  // a personal project of its own creator rather than being destroyed by an
  // action that reads as "close the shared space".
  const { error } = await admin.from('workspaces').delete().eq('id', id);
  if (error) {
    console.error('[workspaces] delete failed', error.message);
    return NextResponse.json({ error: 'Could not delete the workspace' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
