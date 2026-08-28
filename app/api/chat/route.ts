import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { chatWithAssistant, type ChatMessage } from '@/lib/ai';
import { buildKnowledgeBase, CHAT_SYSTEM_INSTRUCTION } from '@/lib/chatbot-knowledge';

const MAX_HISTORY = 12; // trims prompt size — a decision-support chat doesn't need deep history

export async function POST(request: Request) {
  const supabase = createClient();
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

  const { messages } = (await request.json()) as { messages: ChatMessage[] };
  if (!messages?.length) {
    return NextResponse.json({ error: 'No message provided' }, { status: 400 });
  }

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
    console.error('Chat failed', err);
    return NextResponse.json({ error: 'Could not reach the advisor right now — try again shortly.' }, { status: 502 });
  }
}
