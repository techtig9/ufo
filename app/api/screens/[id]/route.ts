import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function getOwnedScreen(supabase: Awaited<ReturnType<typeof createClient>>, screenId: string, userId: string) {
  return supabase
    .from('screens')
    .select('*, projects!inner(user_id)')
    .eq('id', screenId)
    .eq('projects.user_id', userId)
    .single();
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: current, error: currentError } = await getOwnedScreen(supabase, params.id, user.id);
  if (currentError || !current) return NextResponse.json({ error: 'Screen not found' }, { status: 404 });

  const body = await request.json();
  const patch: Record<string, string> = {};

  if (typeof body.code === 'string') {
    if (body.code.length > 1_000_000) {
      return NextResponse.json({ error: 'Screen code is too large' }, { status: 413 });
    }
    patch.code = body.code;
  }
  if (typeof body.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 120);
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  if (typeof body.code === 'string' && body.code !== current.code) {
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim().slice(0, 1200) : null;
    const source = body.source === 'ai' ? 'ai' : 'manual';
    const { error: versionError } = await supabase
      .from('screen_versions')
      .insert({ screen_id: params.id, code: current.code, instruction, source });

    if (versionError) {
      console.error('Could not create version snapshot', versionError);
      return NextResponse.json(
        { error: 'Could not create a version snapshot. Your changes were not saved. Please apply the latest Supabase migration and try again.' },
        { status: 500 }
      );
    }
  }

  const { data: screen, error } = await supabase
    .from('screens')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Could not save screen' }, { status: 500 });
  return NextResponse.json({ ok: true, screen });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: current } = await getOwnedScreen(supabase, params.id, user.id);
  if (!current) return NextResponse.json({ error: 'Screen not found' }, { status: 404 });

  const { count } = await supabase
    .from('screens')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', current.project_id);

  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'A project must keep at least one screen' }, { status: 400 });
  }

  // Same reasoning as project delete (app/api/projects/[id]/route.ts): no ON DELETE
  // CASCADE in the schema, and `comments` has no owner-delete RLS policy, so this has
  // to cascade explicitly with the admin client — ownership was already verified above
  // with the caller's own session.
  const admin = createAdminClient();

  const { error: commentsError } = await admin.from('comments').delete().eq('screen_id', params.id);
  if (commentsError) return NextResponse.json({ error: 'Could not delete screen comments' }, { status: 500 });

  const { error: versionsError } = await admin.from('screen_versions').delete().eq('screen_id', params.id);
  if (versionsError) return NextResponse.json({ error: 'Could not delete screen history' }, { status: 500 });

  const { error } = await admin.from('screens').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Could not delete screen' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
