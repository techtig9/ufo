import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { projectId, isPublic } = await request.json();

  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { data: share, error } = await supabase
    .from('shares')
    .update({ is_public: isPublic })
    .eq('project_id', projectId)
    .select('slug, is_public')
    .single();

  if (error || !share) {
    return NextResponse.json({ error: 'Could not update the share link' }, { status: 500 });
  }

  return NextResponse.json(share);
}
