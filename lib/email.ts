import { createHash } from 'crypto';
import { PLAN_MONTHLY_CREDITS } from './credits';
import { escapeHtml } from './escape-html';
import { createAdminClient } from './supabase/admin';

// Re-exported so existing importers of '@/lib/email' are unaffected.
export { escapeHtml };

const RESEND_API_BASE = 'https://api.resend.com/emails';
const FROM = process.env.EMAIL_FROM || 'ufo <hello@yourdomain.com>';

export type EmailStatus = 'sent' | 'failed' | 'skipped_unconfigured';

/**
 * Delivery log (Master Command 2.F): "an email event log so admins can
 * diagnose delivery attempts without exposing sensitive data".
 *
 * Hence a salted hash of the recipient rather than the address, and a coarse
 * error class rather than the provider's raw string — enough to answer "are
 * welcome emails failing" without turning this table into a mailing list or a
 * copy of the message bodies. Best-effort: logging must never fail a send.
 */
function recipientHash(to: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'ufo-fallback-salt';
  return createHash('sha256').update(`${salt}:${to.toLowerCase().trim()}`).digest('hex').slice(0, 32);
}

/** Buckets a provider failure so it is groupable without storing raw text. */
function errorClass(status: number | undefined, body: string): string {
  if (status === 401 || status === 403) return 'auth';
  if (status === 422) return 'invalid_recipient';
  if (status === 429) return 'rate_limited';
  if (status && status >= 500) return 'provider_error';
  if (/domain is not verified/i.test(body)) return 'domain_unverified';
  return 'unknown';
}

function logEmailEvent(row: {
  userId?: string | null;
  template: string;
  to: string;
  status: EmailStatus;
  providerMessageId?: string | null;
  errorClass?: string | null;
}): void {
  console.log(
    JSON.stringify({
      scope: 'email',
      template: row.template,
      status: row.status,
      errorClass: row.errorClass ?? undefined,
    })
  );

  void (async () => {
    try {
      const admin = createAdminClient();
      await admin.from('email_events').insert({
        user_id: row.userId ?? null,
        template: row.template,
        recipient_hash: recipientHash(row.to),
        status: row.status,
        provider_message_id: row.providerMessageId ?? null,
        error_class: row.errorClass ?? null,
      });
    } catch {
      // Best-effort by design.
    }
  })();
}

async function send(
  to: string,
  subject: string,
  html: string,
  template: string,
  userId?: string | null
): Promise<EmailStatus> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY not set — would have emailed a ${template} to a recipient.`);
    logEmailEvent({ userId, template, to, status: 'skipped_unconfigured' });
    return 'skipped_unconfigured';
  }

  try {
    const res = await fetch(RESEND_API_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300);
      console.error('Resend send failed', res.status, body);
      logEmailEvent({
        userId,
        template,
        to,
        status: 'failed',
        errorClass: errorClass(res.status, body),
      });
      return 'failed';
    }

    const payload = await res.json().catch(() => ({}) as { id?: string });
    logEmailEvent({
      userId,
      template,
      to,
      status: 'sent',
      providerMessageId: payload?.id ?? null,
    });
    return 'sent';
  } catch (err) {
    console.error('Email send error', err);
    logEmailEvent({ userId, template, to, status: 'failed', errorClass: 'transport' });
    return 'failed';
  }
}

const wrapper = (body: string) => `
<div style="font-family:system-ui,sans-serif;background:#101114;color:#fff;padding:32px;border-radius:14px;max-width:480px;margin:0 auto;">
  <p style="font-family:monospace;font-size:12px;color:#D4FF4F;letter-spacing:0.05em;text-transform:uppercase;">ufo</p>
  ${body}
</div>`;

export async function sendWelcomeEmail(
  to: string,
  name: string,
  userId?: string | null
): Promise<EmailStatus> {
  // Reads the real plan configuration. This previously hardcoded "150 free
  // credits" while the Free plan actually grants PLAN_MONTHLY_CREDITS.free
  // (1,500) — a number that was wrong by 10x in the first email a user ever
  // receives, and that would silently drift again on the next pricing change.
  const freeCredits = PLAN_MONTHLY_CREDITS.free.toLocaleString();

  return send(
    to,
    'Welcome to ufo',
    wrapper(`
      <h1 style="font-size:20px;">Hey ${escapeHtml(name) || 'there'} — welcome</h1>
      <p style="color:#B5B7C0;line-height:1.6;">You've got ${freeCredits} free credits to try the
      generator. Head to AI Designer and describe your first project — most people have a
      clickable prototype in under a minute.</p>
    `),
    'welcome',
    userId
  );
}

export async function sendLowCreditsEmail(
  to: string,
  creditsRemaining: number,
  plan: string,
  userId?: string | null
): Promise<EmailStatus> {
  return send(
    to,
    `You're down to ${creditsRemaining.toLocaleString()} credits`,
    wrapper(`
      <h1 style="font-size:20px;">Running low on credits</h1>
      <p style="color:#B5B7C0;line-height:1.6;">You have ${creditsRemaining.toLocaleString()}
      credits left on the ${escapeHtml(plan)} plan this cycle. Upgrade or grab a top-up pack to keep
      generating without interruption.</p>
    `),
    'low_credits',
    userId
  );
}

export async function sendPaymentFailedEmail(
  to: string,
  userId?: string | null
): Promise<EmailStatus> {
  return send(
    to,
    'Your ufo payment didn’t go through',
    wrapper(`
      <h1 style="font-size:20px;">Payment failed</h1>
      <p style="color:#B5B7C0;line-height:1.6;">We couldn't process your last payment. Update
      your card from Billing in your dashboard to avoid losing access to your plan.</p>
    `),
    'payment_failed',
    userId
  );
}

export async function sendSubscriptionCanceledEmail(
  to: string,
  userId?: string | null
): Promise<EmailStatus> {
  return send(
    to,
    'Your ufo subscription was canceled',
    wrapper(`
      <h1 style="font-size:20px;">Subscription canceled</h1>
      <p style="color:#B5B7C0;line-height:1.6;">You're back on the Free plan. Your projects are
      still there — upgrade anytime from Billing to pick up where you left off.</p>
    `),
    'subscription_canceled',
    userId
  );
}

export async function sendContactFormEmail(fromEmail: string, message: string): Promise<EmailStatus> {
  const supportInbox = process.env.SUPPORT_INBOX_EMAIL || FROM;
  return send(
    supportInbox,
    // Subject is header-injection-safe because Resend takes it as JSON, but the
    // address is still escaped for the body below.
    `New contact form message from ${fromEmail}`,
    wrapper(`
      <h1 style="font-size:18px;">New support message</h1>
      <p style="color:#B5B7C0;">From: ${escapeHtml(fromEmail)}</p>
      <p style="color:#fff;white-space:pre-wrap;line-height:1.6;">${escapeHtml(message)}</p>
    `),
    'contact_form',
    null
  );
}

/**
 * Security notification for a successful (or attempted) authentication event.
 *
 * Deliberately contains no link that asks the user to log in or reset anything:
 * a security alert that trains people to click a login link in email is a
 * phishing vector. It states what happened and tells them where to go
 * themselves if it was not them.
 */
export async function sendSecurityNotificationEmail(
  to: string,
  params: {
    headline: string;
    detail: string;
    whenIso: string;
    context?: string;
    /** Event name, used only to label the row in the delivery log. */
    eventType?: string;
    userId?: string | null;
  }
): Promise<EmailStatus> {
  const when = new Date(params.whenIso).toUTCString();

  return send(
    to,
    params.headline,
    wrapper(`
      <h1 style="font-size:20px;">${escapeHtml(params.headline)}</h1>
      <p style="color:#B5B7C0;line-height:1.6;">${escapeHtml(params.detail)}</p>
      <table style="margin-top:16px;font-size:13px;color:#B5B7C0;line-height:1.8;">
        <tr><td style="padding-right:12px;color:#737D8F;">When</td><td>${escapeHtml(when)}</td></tr>
        ${
          params.context
            ? `<tr><td style="padding-right:12px;color:#737D8F;vertical-align:top;">Where</td><td>${escapeHtml(
                params.context
              )}</td></tr>`
            : ''
        }
      </table>
      <p style="color:#737D8F;line-height:1.6;font-size:13px;margin-top:20px;">
        If this was you, no action is needed. If it wasn't, change your password and turn on
        two-factor authentication from Settings in your ufo dashboard. We will never ask you to
        sign in through a link in an email.
      </p>
      <p style="color:#737D8F;line-height:1.6;font-size:12px;margin-top:16px;">
        You can turn these security notifications off under Settings → Notifications.
      </p>
    `),
    `security_${params.eventType ?? 'notification'}`,
    params.userId
  );
}
