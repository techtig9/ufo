import { NextResponse } from 'next/server';
import { sendContactFormEmail } from '@/lib/email';
import { contactFormSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  const parsed = contactFormSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please provide a valid email and message' },
      { status: 400 }
    );
  }

  await sendContactFormEmail(parsed.data.email, parsed.data.message);
  return NextResponse.json({ ok: true });
}
