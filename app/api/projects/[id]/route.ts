import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function getOwnedProject(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, userId: string) {
  return supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).single();
}

/** Rename, favorite/unfavorite, or archive/unarchive a project the caller owns. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: project } = await getOwnedProject(supabase, params.id, user.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: 'Project name cannot be empty' }, { status: 400 });
    if (name.length > 120) return NextResponse.json({ error: 'Project name is too long' }, { status: 400 });
    update.name = name;
  }
  if (typeof body.isFavorite === 'boolean') {
    update.is_favorite = body.isFavorite;
  }
  if (typeof body.archived === 'boolean') {
    update.archived_at = body.archived ? new Date().toISOString() : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, name, project_type, created_at, is_favorite, tags, archived_at')
    .single();

  if (error) return NextResponse.json({ error: 'Could not update the project' }, { status: 500 });
  return NextResponse.json({ project: updated });
}

/**
 * Delete a project the caller owns, plus everything that references it.
 * There's no ON DELETE CASCADE in the schema (by design, to keep destructive
 * behavior explicit), and there's no owner-delete RLS policy on `comments`,
 * so this runs the cascade server-side with the admin client — but only
 * after confirming ownership with the caller's own session first.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: project } = await getOwnedProject(supabase, params.id, user.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const admin = createAdminClient();

  const { data: screens } = await admin.from('screens').select('id').eq('project_id', params.id);
  const screenIds = (screens ?? []).map((s) => s.id);

  if (screenIds.length) {
    const { error: commentsError } = await admin.from('comments').delete().in('screen_id', screenIds);
    if (commentsError) return NextResponse.json({ error: 'Could not delete project comments' }, { status: 500 });

    const { error: versionsError } = await admin.from('screen_versions').delete().in('screen_id', screenIds);
    if (versionsError) return NextResponse.json({ error: 'Could not delete project history' }, { status: 500 });
  }

  const { error: screensError } = await admin.from('screens').delete().eq('project_id', params.id);
  if (screensError) return NextResponse.json({ error: 'Could not delete project screens' }, { status: 500 });

  const { error: sharesError } = await admin.from('shares').delete().eq('project_id', params.id);
  if (sharesError) return NextResponse.json({ error: 'Could not delete project share links' }, { status: 500 });

  const { error: projectError } = await admin.from('projects').delete().eq('id', params.id).eq('user_id', user.id);
  if (projectError) return NextResponse.json({ error: 'Could not delete the project' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
