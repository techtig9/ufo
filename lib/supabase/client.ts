import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/** Use inside Client Components only. Respects RLS as the signed-in user. */
export function createClient() {
  return createBrowserClient(
    // From ./config, which substitutes an unreachable placeholder when the
    // real values are absent. Constructing this with `undefined` throws, and
    // Next constructs one while prerendering — so without the placeholder an
    // unconfigured build fails instead of producing a deployment to configure.
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}
