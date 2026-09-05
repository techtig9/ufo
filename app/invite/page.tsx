import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AcceptInvite } from '@/components/workspaces/accept-invite';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Workspace invitation',
  // An invitation link should not be indexed or previewed anywhere.
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const inviteReturnPath = `/invite?token=${encodeURIComponent(token ?? '')}`;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="panel p-8">
        {!token ? (
          <div className="text-center">
            <h1 className="font-display text-2xl font-medium text-fg">Invitation link incomplete</h1>
            <p className="mt-2 text-sm text-fg-muted">
              This link is missing its invitation token. Open the link from your invitation email
              exactly as it was sent, or ask for a new invitation.
            </p>
          </div>
        ) : !user ? (
          <div className="text-center">
            <h1 className="font-display text-2xl font-medium text-fg">Sign in to accept</h1>
            <p className="mt-2 text-sm text-fg-muted">
              An invitation can only be accepted by the account it was sent to, so sign in — or
              create an account with that email address — and you will come straight back here.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {/* `next` is the parameter login, signup and /auth/callback all
                  read, and each passes it through safeRedirectPath — so the
                  token survives the round trip without opening a redirect. */}
              <Link href={`/login?next=${encodeURIComponent(inviteReturnPath)}`}>
                <Button>Sign in</Button>
              </Link>
              <Link href={`/signup?next=${encodeURIComponent(inviteReturnPath)}`}>
                <Button variant="secondary">Create account</Button>
              </Link>
            </div>
          </div>
        ) : (
          <AcceptInvite token={token} signedInAs={user.email ?? null} />
        )}
      </div>
    </main>
  );
}
