import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { chatWithAssistant } from '@/lib/ai';
import { reportError } from '@/lib/observability';
import { buildKnowledgeBase, CHAT_SYSTEM_INSTRUCTION } from '@/lib/chatbot-knowledge';

const MAX_HISTORY = 12; // trims prompt size — a decision-support chat doesn't need deep history

/**
 * The body was previously read as `(await request.json()) as { messages: ChatMessage[] }`.
 * A cast is not a check: every element came straight from the client unexamined.
 *
 * Two things that actually let through, both worth closing:
 *
 *  - `text` could be any type. A number, an object or null reached the
 *    provider as message content and came back as an opaque 400.
 *  - `text` had no length cap. MAX_HISTORY bounds the message COUNT and
 *    `maxTokens` bounds the OUTPUT, but nothing bounded the input, so twelve
 *    multi-megabyte messages were a rate-limit-compliant way to run up a bill
 *    against our API key.
 *
 * What it did NOT allow, despite appearances: a forged `role: 'system'`.
 * chatWithAssistant maps anything that is not 'model' to 'user', so a system
 * turn cannot be injected this way. The role is still constrained here so that
 * this stays true if that mapping is ever rewritten.
 */
const MAX_MESSAGE_CHARS = 4000;

const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
      })
    )
    .min(1)
    .max(MAX_HISTORY * 4), // generous: the tail is trimmed to MAX_HISTORY below
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The chatbot is a product feature like any other — same auth
  // requirement as everything else, no exception for it.
  if (!user) {
    return NextResponse.json(
      { error: 'Sign up or log in to chat with ufo\u2019s advisor.' },
      { status: 401 }
    );
  }

  const rateLimit = await checkRateLimit(user.id, 'chat', 30, 600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many messages — please slow down a bit.' }, { status: 429 });
  }

  // A malformed body is the client's mistake, so it gets a 400 with a reason
  // rather than throwing into the 500 handler.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body was not valid JSON.' }, { status: 400 });
  }

  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === 'too_big');
    return NextResponse.json(
      {
        error: tooLong
          ? `Each message must be under ${MAX_MESSAGE_CHARS.toLocaleString()} characters.`
          : 'No message provided',
      },
      { status: 400 }
    );
  }
  const { messages } = parsed.data;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, credits_remaining')
    .eq('user_id', user.id)
    .single();

  const personalized = subscription
    ? `\n\nTHIS USER: currently on the ${subscription.plan} plan with ${subscription.credits_remaining.toLocaleString()} credits remaining this cycle. Use this to give specific advice (e.g. whether they'd benefit from upgrading) rather than generic answers.`
    : '';

  const systemContext = `${CHAT_SYSTEM_INSTRUCTION}\n\nPRODUCT KNOWLEDGE:\n${buildKnowledgeBase()}${personalized}`;

  try {
    const reply = await chatWithAssistant(systemContext, messages.slice(-MAX_HISTORY));
    return NextResponse.json({ reply });
  } catch (err) {
    // Through reportError so the line is redacted and correlated like every
    // other scope, rather than a bare console.error.
    reportError(err, 'chat', { userId: user.id });
    return NextResponse.json({ error: 'Could not reach the advisor right now — try again shortly.' }, { status: 502 });
  }
}
