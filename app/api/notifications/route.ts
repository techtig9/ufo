import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Notifications load failed', error);
    return NextResponse.json({ notifications: [] });
  }

  return NextResponse.json({ notifications: notifications ?? [] });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();

  if (body.markAll === true) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    if (error) return NextResponse.json({ error: 'Could not update notifications' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { id } = body;
  if (!id) return NextResponse.json({ error: 'Notification id is required' }, { status: 400 });

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'Could not update notification' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
