import { NextResponse } from 'next/server';
import { sendContactFormEmail } from '@/lib/email';
import { contactFormSchema } from '@/lib/schemas';
import { checkAnonymousRateLimit, clientIpFrom } from '@/lib/rate-limit';

export async function POST(request: Request) {
  // This endpoint is intentionally unauthenticated — a contact form has to work
  // for people without an account. That also made it an unmetered way to send
  // mail from ufo's verified sending domain, which is both an abuse vector and
  // a fast way to damage that domain's reputation. Rate limited per client IP.
  // (Body escaping is handled in lib/email.ts.)
  const rate = await checkAnonymousRateLimit(clientIpFrom(request.headers), 'contact', 5, 3600);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many messages from this connection. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds ?? 3600) } }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = contactFormSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please provide a valid email and message' },
      { status: 400 }
    );
  }

  const status = await sendContactFormEmail(parsed.data.email, parsed.data.message);

  if (status === 'failed') {
    return NextResponse.json(
      { error: 'We could not send your message right now. Please try again shortly.' },
      { status: 502 }
    );
  }

  // 'skipped_unconfigured' means RESEND_API_KEY is unset. Reporting success
  // would be a lie, but this is a deployment problem, not the visitor's.
  if (status === 'skipped_unconfigured') {
    console.error('[contact] RESEND_API_KEY is not configured — message was not delivered.');
    return NextResponse.json(
      { error: 'Messaging is not configured on this deployment. Please email us directly.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true });
}
