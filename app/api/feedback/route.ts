import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { isSupabaseAdminConfigured } from '@/lib/supabase/config';
import { reportError, withObservability } from '@/lib/observability';

const feedbackSchema = z.object({
  source: z.enum(['general', 'first_success']).default('general'),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  message: z.string().trim().min(1).max(4000),
  // A PATH, never a full URL. A query string on a share page carries a token,
  // and an email address can end up in one — neither belongs in a feedback row
  // that an operator reads casually.
  path: z.string().max(255).optional(),
});

async function handler(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      { error: 'Feedback is not configured on this deployment.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Generous but finite: someone with a lot to say should not be silenced,
  // someone scripting inserts should be.
  const rateLimit = await checkRateLimit(user.id, 'feedback', 10, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'You have sent several notes recently — thank you. Try again in a little while.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body was not valid JSON.' }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please write a message before sending.' }, { status: 400 });
  }

  // Strip any query string the client sent anyway, rather than trusting it.
  const path = parsed.data.path?.split('?')[0]?.slice(0, 255);

  // Written with the service role because the table has no select policy at
  // all: nothing client-side can read feedback back, by design.
  const { error } = await createAdminClient().from('feedback').insert({
    user_id: user.id,
    source: parsed.data.source,
    rating: parsed.data.rating ?? null,
    message: parsed.data.message,
    path: path ?? null,
  });

  if (error) {
    reportError(error, 'feedback', { userId: user.id });
    return NextResponse.json(
      { error: 'Could not save that right now — please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export const POST = withObservability('feedback', handler);
