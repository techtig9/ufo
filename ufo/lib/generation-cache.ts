import crypto from 'crypto';
import { createAdminClient } from './supabase/admin';
import type { GeneratedProject } from './types';

const CACHE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes — long enough to dedupe a double-click
                                          // or a retry-after-timeout, short enough that a
                                          // deliberate second identical request later still runs.

/** Stable hash of the exact inputs that determine Gemini's output. */
export function hashGenerationRequest(payload: Record<string, unknown>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function getCachedGeneration(
  userId: string,
  requestHash: string
): Promise<GeneratedProject | null> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - CACHE_WINDOW_MS).toISOString();

  const { data } = await admin
    .from('generation_cache')
    .select('response')
    .eq('user_id', userId)
    .eq('request_hash', requestHash)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.response as GeneratedProject) ?? null;
}

export async function storeCachedGeneration(
  userId: string,
  requestHash: string,
  response: GeneratedProject
): Promise<void> {
  const admin = createAdminClient();
  await admin.from('generation_cache').insert({ user_id: userId, request_hash: requestHash, response });
}
