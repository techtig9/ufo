import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from './config';

/**
 * SERVER-ONLY. Uses the service-role key and bypasses RLS entirely.
 * Never import this into a Client Component or expose the key to the
 * browser. Used by: Paddle webhook handler, admin panel routes, and the
 * credit-deduction step of /api/generate (which must succeed atomically
 * even under RLS edge cases).
 */
export function createAdminClient() {
  return createSupabaseClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
