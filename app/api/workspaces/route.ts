import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Workspaces the caller belongs to, and creating one.
 *
 * Reads go through the caller's session so the RLS policies in migration 010
 * scope them. The create path uses the service role for one specific reason:
 * a workspace and its owner membership row must both exist or neither should,
 * and a client-side insert cannot guarantee the second write.
 */

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Membership drives the list, not ownership: a workspace you were invited to
  // is as much "yours" as one you created.
  const { data: memberships, error } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name, owner_id, created_at)')
    .eq('user_id', user.id);

  if (error) {
    console.error('[workspaces] list failed', error.message);
    return NextResponse.json({ workspaces: [] });
  }

  const workspaces = (memberships ?? [])
    .filter((m) => m.workspace)
    .map((m) => ({
      ...(m.workspace as unknown as { id: string; name: string; owner_id: string; created_at: string }),
      role: m.role,
    }));

  return NextResponse.json({ workspaces });
}

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

  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid workspace name' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: workspace, error } = await admin
    .from('workspaces')
    .insert({ name: parsed.data.name, owner_id: user.id })
    .select('id, name, owner_id, created_at')
    .single();

  if (error || !workspace) {
    console.error('[workspaces] create failed', error?.message);
    return NextResponse.json({ error: 'Could not create the workspace' }, { status: 500 });
  }

  const { error: memberError } = await admin
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });

  if (memberError) {
    // Roll back rather than leave a workspace nobody — not even its creator —
    // can see, since visibility comes from membership.
    await admin.from('workspaces').delete().eq('id', workspace.id);
    console.error('[workspaces] owner membership failed', memberError.message);
    return NextResponse.json({ error: 'Could not create the workspace' }, { status: 500 });
  }

  await admin.from('workspace_activity').insert({
    workspace_id: workspace.id,
    actor_id: user.id,
    action: 'workspace.created',
    detail: workspace.name,
  });

  return NextResponse.json({ workspace: { ...workspace, role: 'owner' } });
}
