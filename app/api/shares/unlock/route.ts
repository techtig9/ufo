import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySharePassword, issueShareGrant, SHARE_GRANT_COOKIE_PREFIX } from '@/lib/share-access';
import { checkAnonymousRateLimit, clientIpFrom } from '@/lib/rate-limit';

/**
 * Exchanges a share password for a short-lived grant cookie.
 *
 * Uses the service role deliberately: a password-protected share is invisible
 * to the public key by design (migration 010), so the anon client cannot read
 * the row it needs to check. Every authorisation decision is still made
 * explicitly here.
 *
 * Rate limited per IP, because an unthrottled endpoint that answers "is this
 * the right password" is a brute-force oracle regardless of how the hash is
 * stored.
 */
const schema = z.object({
  slug: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const rate = await checkAnonymousRateLimit(clientIpFrom(request.headers), 'share-unlock', 10, 900);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter the password to continue' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: share } = await admin
    .from('shares')
    .select('id, is_public, password_hash, expires_at')
    .eq('slug', parsed.data.slug)
    .maybeSingle();

  // One response for every failure, so this cannot be used to discover which
  // slugs exist or which are password-protected.
  const denied = NextResponse.json({ error: 'That password is not correct.' }, { status: 401 });

  if (!share || !share.is_public || !share.password_hash) return denied;
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) return denied;
  if (!verifySharePassword(parsed.data.password, share.password_hash)) return denied;

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: `${SHARE_GRANT_COOKIE_PREFIX}${share.id}`,
    value: issueShareGrant(share.id),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 6 * 60 * 60,
  });
  return response;
}
