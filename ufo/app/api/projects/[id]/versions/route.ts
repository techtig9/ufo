import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getOwnedProject(supabase: ReturnType<typeof createClient>, projectId: string, userId: string) {
  return supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).single();
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: project } = await getOwnedProject(supabase, params.id, user.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const screenId = new URL(request.url).searchParams.get('screenId');
  if (!screenId) return NextResponse.json({ error: 'screenId is required' }, { status: 400 });

  const { data: screen } = await supabase
    .from('screens')
    .select('id')
    .eq('id', screenId)
    .eq('project_id', params.id)
    .single();

  if (!screen) return NextResponse.json({ error: 'Screen not found' }, { status: 404 });

  const { data: versions, error } = await supabase
    .from('screen_versions')
    .select('id, code, created_at')
    .eq('screen_id', screenId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: 'Could not load versions' }, { status: 500 });
  return NextResponse.json({ versions: versions ?? [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: project } = await getOwnedProject(supabase, params.id, user.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { screenId, versionId } = await request.json();
  if (!screenId || !versionId) {
    return NextResponse.json({ error: 'screenId and versionId are required' }, { status: 400 });
  }

  const { data: screen } = await supabase
    .from('screens')
    .select('*')
    .eq('id', screenId)
    .eq('project_id', params.id)
    .single();
  if (!screen) return NextResponse.json({ error: 'Screen not found' }, { status: 404 });

  const { data: version } = await supabase
    .from('screen_versions')
    .select('id, code')
    .eq('id', versionId)
    .eq('screen_id', screenId)
    .single();
  if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

  await supabase.from('screen_versions').insert({ screen_id: screenId, code: screen.code });

  const { data: restored, error } = await supabase
    .from('screens')
    .update({ code: version.code })
    .eq('id', screenId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Could not restore version' }, { status: 500 });
  return NextResponse.json({ screen: restored });
    }
