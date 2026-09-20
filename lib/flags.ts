import { createAdminClient } from './supabase/admin';
import { isSupabaseAdminConfigured } from './supabase/config';

/**
 * Runtime feature flags.
 *
 * The point is to ship an incomplete feature dark, and to turn a misbehaving
 * one off without a deploy. Two properties matter more than the mechanism:
 *
 *  - **A missing flag is OFF.** Not on, not an error. A flag row that was
 *    never created, a database that cannot be reached, a typo in the key —
 *    all of them mean the feature stays hidden. The alternative is an
 *    unfinished feature appearing in production because a row was missing,
 *    which is precisely the failure flags exist to prevent.
 *  - **Flags are not a permission system.** They decide whether a feature is
 *    visible, never whether a user may do something. Entitlements live in
 *    lib/plan-features.ts and are enforced server-side. A flag read in the
 *    browser is a hint; an authorisation check is not.
 */
const CACHE_MS = 30_000;
let cache: { at: number; flags: Record<string, boolean> } | null = null;

export async function loadFlags(): Promise<Record<string, boolean>> {
  if (!isSupabaseAdminConfigured) return {};
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.flags;

  try {
    const { data, error } = await createAdminClient()
      .from('feature_flags')
      .select('key, enabled');

    if (error) return cache?.flags ?? {};

    const flags = Object.fromEntries((data ?? []).map((row) => [row.key as string, row.enabled === true]));
    cache = { at: Date.now(), flags };
    return flags;
  } catch {
    // Serve the last known values rather than flipping every flag off during a
    // blip — an outage should not also change what the product does.
    return cache?.flags ?? {};
  }
}

export async function isEnabled(key: string): Promise<boolean> {
  const flags = await loadFlags();
  return flags[key] === true;
}

/** Test seam. */
export function resetFlagCache(): void {
  cache = null;
}
