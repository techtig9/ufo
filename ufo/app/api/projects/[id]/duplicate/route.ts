import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: screens } = await supabase.from('screens').select('*').eq('project_id', project.id);

  const { data: newProject, error: insertError } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: `${project.name} (copy)`,
      project_type: project.project_type,
      design_style: project.design_style,
      color_theme: project.color_theme,
      font_pairing: project.font_pairing,
    })
    .select()
    .single();

  if (insertError || !newProject) {
    return NextResponse.json({ error: 'Could not duplicate the project' }, { status: 500 });
  }

  if (screens?.length) {
    await supabase.from('screens').insert(
      screens.map((s) => ({
        project_id: newProject.id,
        name: s.name,
        order_index: s.order_index,
        code: s.code,
        thumbnail: s.thumbnail,
      }))
    );
  }

  return NextResponse.json({ projectId: newProject.id });
}
