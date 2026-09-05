import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The people who can be @-mentioned or assigned on a prototype.
 *
 * Authentication is required and membership is checked, even though the comment
 * composer this feeds is reachable from a PUBLIC share page. That is the whole
 * point: an anonymous visitor to a share link must not be handed the project
 * team's names and email addresses. They get an empty list, and the composer
 * simply shows no picker.
 */
export async function GET(request: Request) {
  const shareId = new URL(request.url).searchParams.get('shareId');
  if (!shareId) return NextResponse.json({ error: 'shareId is required' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in: no list, and a 200 rather than a 401 — this is an optional
  // enhancement to the composer, not a failure worth surfacing to a guest.
  if (!user) return NextResponse.json({ collaborators: [] });

  const admin = createAdminClient();

  const { data: share } = await admin
    .from('shares')
    .select('project_id')
    .eq('id', shareId)
    .maybeSingle();
  if (!share) return NextResponse.json({ collaborators: [] });

  const { data: project } = await admin
    .from('projects')
    .select('id, user_id, workspace_id')
    .eq('id', share.project_id)
    .maybeSingle();
  if (!project) return NextResponse.json({ collaborators: [] });

  const isOwner = project.user_id === user.id;
  let memberIds: string[] = [];

  if (project.workspace_id) {
    const { data: members } = await admin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', project.workspace_id);
    memberIds = (members ?? []).map((m) => m.user_id);
  }

  // The caller must themselves be a collaborator before seeing who else is.
  if (!isOwner && !memberIds.includes(user.id)) {
    return NextResponse.json({ collaborators: [] });
  }

  const ids = Array.from(new Set([project.user_id, ...memberIds]));
  const { data: people } = await admin
    .from('users')
    .select('id, name, email')
    .in('id', ids);

  const collaborators = (people ?? [])
    .map((p) => ({
      id: p.id,
      // Name only. An email address is a contactable identifier and the picker
      // does not need one to work; the fallback is a truncated local part so a
      // nameless account is still distinguishable.
      name: p.name || p.email?.split('@')[0] || 'Member',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ collaborators });
}
