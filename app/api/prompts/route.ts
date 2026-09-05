import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAiActionId } from '@/lib/ai/actions';

/**
 * Saved prompts (Master Command 2.C).
 *
 * Every query goes through the caller's own session, so the RLS policies in
 * migration 009 are what enforce ownership — there is no path here that could
 * read or write another user's prompts.
 */

const savePromptSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(2000),
  action: z.string().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('saved_prompts')
    .select('id, title, body, action, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[prompts] load failed', error.message);
    return NextResponse.json({ prompts: [] });
  }
  return NextResponse.json({ prompts: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = savePromptSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid prompt' },
      { status: 400 }
    );
  }

  // An unrecognised action would make the prompt un-offerable in the editor,
  // so it is dropped rather than stored as dead metadata.
  const action = isAiActionId(parsed.data.action) ? parsed.data.action : null;

  // Re-saving the same title updates it, matching the unique index — clicking
  // Save twice should not leave two copies behind.
  const { data, error } = await supabase
    .from('saved_prompts')
    .upsert(
      {
        user_id: user.id,
        title: parsed.data.title,
        body: parsed.data.body,
        action,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,title' }
    )
    .select('id, title, body, action, created_at')
    .single();

  if (error || !data) {
    console.error('[prompts] save failed', error?.message);
    return NextResponse.json({ error: 'Could not save the prompt' }, { status: 500 });
  }
  return NextResponse.json({ prompt: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // RLS scopes the delete; the explicit user_id filter makes that intent
  // obvious at the call site rather than implicit in the policy.
  const { error } = await supabase.from('saved_prompts').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Could not delete the prompt' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
