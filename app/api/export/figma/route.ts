import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: 'Figma export is coming soon. Your project and credits were not changed.',
      status: 'unavailable',
    },
    { status: 501 }
  );
}
