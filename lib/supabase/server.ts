import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { cookies } from 'next/headers';

/**
 * Use inside Server Components, Route Handlers, and Server Actions.
 * Respects RLS as the signed-in user — reads the session from cookies.
 */
export async function createClient() {
  // Next 15+ made cookies() async. Every caller already `await`s this factory.
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component with no writable cookie jar —
            // safe to ignore because middleware refreshes the session too.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // See note above.
          }
        },
      },
    }
  );
}
