import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await request.json();
  const ids = Array.isArray(body.screenIds) ? body.screenIds.map(String) : [];
  if (!ids.length) return NextResponse.json({ error: 'screenIds is required' }, { status: 400 });

  const { data: ownedScreens } = await supabase
    .from('screens')
    .select('id')
    .eq('project_id', params.id);

  const owned = new Set((ownedScreens ?? []).map((s) => s.id));
  if (ids.length !== owned.size || ids.some((id: string) => !owned.has(id))) {
    return NextResponse.json({ error: 'Invalid screen order' }, { status: 400 });
  }

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from('screens')
      .update({ order_index: i })
      .eq('id', ids[i])
      .eq('project_id', params.id);
    if (error) return NextResponse.json({ error: 'Could not reorder screens' }, { status: 500 });
  }

  const { data: screens } = await supabase
    .from('screens')
    .select('*')
    .eq('project_id', params.id)
    .order('order_index');

  return NextResponse.json({ screens: screens ?? [] });
}
