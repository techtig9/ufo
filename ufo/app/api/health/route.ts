import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('users').select('id').limit(1);

    if (error) {
      return NextResponse.json({ status: 'degraded', db: 'error', message: error.message }, { status: 503 });
    }

    return NextResponse.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ status: 'down', error: String(err) }, { status: 503 });
  }
}
