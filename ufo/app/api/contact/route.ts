import { NextResponse } from 'next/server';
import { sendContactFormEmail } from '@/lib/email';

export async function POST(request: Request) {
  const { email, message } = await request.json();

  if (!email || !message || typeof message !== 'string' || message.length > 5000) {
    return NextResponse.json({ error: 'Please provide a valid email and message' }, { status: 400 });
  }

  await sendContactFormEmail(email, message);
  return NextResponse.json({ ok: true });
}
