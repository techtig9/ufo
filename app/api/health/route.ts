import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('users').select('id').limit(1);

    if (error) {
      // The message is logged for operators but not returned: this endpoint is
      // unauthenticated, and Postgres errors can disclose schema details.
      console.error('[health] database check failed', error.message);
      return NextResponse.json({ status: 'degraded', db: 'error' }, { status: 503 });
    }

    return NextResponse.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    console.error('[health] check threw', err);
    return NextResponse.json({ status: 'down' }, { status: 503 });
  }
}
