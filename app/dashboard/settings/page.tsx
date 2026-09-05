import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { DangerZone } from '@/components/dashboard/danger-zone';
import { ReferralBox } from '@/components/dashboard/referral-box';
import { NotificationToggle } from '@/components/dashboard/notification-toggle';
import { MfaEnrollment } from '@/components/dashboard/mfa-enrollment';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, referral_code, notify_low_credits, notify_security_emails, notify_collaboration_emails')
    .eq('id', user!.id)
    .single();

  const { count: referralCount } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', user!.id);

  async function updateProfile(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('users').update({ name: formData.get('name') }).eq('id', user.id);
    revalidatePath('/dashboard/settings');
  }

  async function toggleLowCredits(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('users')
      .update({ notify_low_credits: formData.get('notify_low_credits') === 'on' })
      .eq('id', user.id);
    revalidatePath('/dashboard/settings');
  }

  async function toggleSecurityEmails(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('users')
      .update({ notify_security_emails: formData.get('notify_security_emails') === 'on' })
      .eq('id', user.id);
    revalidatePath('/dashboard/settings');
  }

  async function toggleCollaborationEmails(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('users')
      .update({ notify_collaboration_emails: formData.get('notify_collaboration_emails') === 'on' })
      .eq('id', user.id);
    revalidatePath('/dashboard/settings');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>

      <Panel hover={false}>
        <h2 className="font-medium">Profile</h2>
        <form action={updateProfile} className="mt-4 space-y-4">
          <div>
            <label className="text-sm text-fg-muted" htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              defaultValue={profile?.name ?? ''}
              className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          </div>
          <div>
            <label className="text-sm text-fg-muted">Email</label>
            <p className="mt-1 rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm text-fg-faint">
              {profile?.email}
            </p>
          </div>
          <Button type="submit" size="sm">Save changes</Button>
        </form>
      </Panel>

      <Panel hover={false}>
        <h2 className="font-medium">Appearance</h2>
        <p className="mt-1 text-sm text-fg-muted">Studio Grid in dark or light.</p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </Panel>

      <Panel hover={false}>
        <h2 className="font-medium">Password</h2>
        <p className="mt-1 text-sm text-fg-muted">Reset your password by email.</p>
        <a href="/forgot-password" className="mt-4 inline-block">
          <Button variant="secondary" size="sm">Send reset link</Button>
        </a>
      </Panel>

      <Panel hover={false}>
        <h2 className="font-medium">Two-factor authentication</h2>
        <p className="mt-1 text-sm text-fg-muted">Add an authenticator app for a second login step.</p>
        <div className="mt-4">
          <MfaEnrollment />
        </div>
      </Panel>

      <Panel hover={false}>
        <h2 className="font-medium">Notifications</h2>

        <NotificationToggle
          action={toggleSecurityEmails}
          name="notify_security_emails"
          label="Email me about sign-ins and security changes"
          description="Sent when someone signs in, completes two-factor, requests a password reset, or changes your password. On by default — this is how you would find out about an account takeover."
          defaultChecked={profile?.notify_security_emails ?? true}
        />

        <NotificationToggle
          action={toggleCollaborationEmails}
          name="notify_collaboration_emails"
          label="Email me when I'm mentioned or assigned a comment"
          description="Sent when a collaborator @-mentions you in a comment or assigns one to you. On by default — a mention nobody hears about is not a mention."
          defaultChecked={profile?.notify_collaboration_emails ?? true}
        />

        <NotificationToggle
          action={toggleLowCredits}
          name="notify_low_credits"
          label="Email me when credits run low"
          defaultChecked={profile?.notify_low_credits ?? true}
        />

        <p className="mt-4 text-xs text-fg-faint">
          Payment and account emails are sent regardless {'\u2014'} those aren&rsquo;t optional.
        </p>
      </Panel>

      <Panel hover={false}>
        <h2 className="font-medium">Invite friends</h2>
        <p className="mt-1 text-sm text-fg-muted">Share your link — you both get bonus cloud storage, not credits.</p>
        <div className="mt-4">
          <ReferralBox referralCode={profile?.referral_code ?? null} userId={user!.id} />
        </div>
        <p className="mt-3 text-xs text-fg-faint">
          {referralCount ?? 0} successful referral{referralCount === 1 ? '' : 's'} so far.
        </p>
      </Panel>

      <Panel hover={false} className="border-studio-coral/20">
        <h2 className="font-medium text-accent-text">Danger zone</h2>
        <div className="mt-4">
          <DangerZone />
        </div>
      </Panel>
    </div>
  );
}
