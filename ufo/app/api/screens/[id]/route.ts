import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { code } = await request.json();

  // Best-effort version snapshot (Optional Zero-Cost Add-On). If the
  // `screen_versions` table hasn't been applied, this silently no-ops —
  // it must never block the actual save below.
  const { data: current } = await supabase.from('screens').select('code').eq('id', params.id).single();
  if (current) {
    await supabase
      .from('screen_versions')
      .insert({ screen_id: params.id, code: current.code })
      .then(
        () => {},
        () => {}
      );
  }

  const { error } = await supabase.from('screens').update({ code }).eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
