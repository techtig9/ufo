import { createAdminClient } from './supabase/admin';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I/L)

function randomCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/** Idempotent: returns the existing code if the user already has one. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: existing } = await admin.from('users').select('referral_code').eq('id', userId).single();
  if (existing?.referral_code) return existing.referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await admin.from('users').update({ referral_code: code }).eq('id', userId);
    if (!error) return code;
    // Unique constraint conflict — try another code.
  }
  throw new Error('Could not generate a unique referral code');
}

/** Records a referral if the code is valid and this user hasn't been referred yet. */
export async function recordReferral(referredUserId: string, referralCode: string): Promise<void> {
  const admin = createAdminClient();

  const { data: referrer } = await admin
    .from('users')
    .select('id')
    .eq('referral_code', referralCode)
    .single();

  if (!referrer || referrer.id === referredUserId) return;

  await admin
    .from('referrals')
    .insert({ referrer_id: referrer.id, referred_id: referredUserId })
    .then(
      () => {},
      () => {} // already referred (unique constraint) — ignore
    );
}
