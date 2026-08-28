import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import { recordReferral } from '@/lib/referral';
import { sendWelcomeEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';
  const ref = searchParams.get('ref');

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Ensure a `users` row + a free-plan `subscriptions` row exist for
      // first-time sign-ins (covers both email/password and Google OAuth,
      // since a DB trigger on auth.users would only catch one path
      // depending on how it's wired — this is the simple, explicit version).
      const admin = createAdminClient();

      const { data: upserted } = await admin
        .from('users')
        .upsert(
          {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.name ?? data.user.user_metadata?.full_name ?? null,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )
        .select('id')
        .single();

      const { data: existingSub } = await admin
        .from('subscriptions')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      const isFirstSignIn = !existingSub;

      if (isFirstSignIn) {
        await admin.from('subscriptions').insert({
          user_id: data.user.id,
          plan: 'free',
          status: 'active',
          credits_remaining: PLAN_MONTHLY_CREDITS.free,
        });
        await sendWelcomeEmail(data.user.email!, data.user.user_metadata?.name ?? '');
      }

      // Only record on first sign-in — a returning user clicking an old
      // referral link shouldn't retroactively attach a referral.
      if (isFirstSignIn && ref && upserted) {
        await recordReferral(data.user.id, ref);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
