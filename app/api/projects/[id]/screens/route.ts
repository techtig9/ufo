import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
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
  const name = String(body.name ?? '').trim();
  const code = typeof body.code === 'string'
    ? body.code
    : `<main class="min-h-screen bg-white p-8 text-slate-900"><h1 class="text-3xl font-bold">${name || 'New screen'}</h1></main>`;

  if (!name) return NextResponse.json({ error: 'Screen name is required' }, { status: 400 });

  const { data: last } = await supabase
    .from('screens')
    .select('order_index')
    .eq('project_id', params.id)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: screen, error } = await supabase
    .from('screens')
    .insert({
      project_id: params.id,
      name,
      code,
      order_index: (last?.order_index ?? -1) + 1,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Could not create screen' }, { status: 500 });
  return NextResponse.json({ screen });
}
