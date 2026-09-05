import { PLAN_MONTHLY_CREDITS } from './credits';
import { escapeHtml } from './escape-html';

// Re-exported so existing importers of '@/lib/email' are unaffected.
export { escapeHtml };

const RESEND_API_BASE = 'https://api.resend.com/emails';
const FROM = process.env.EMAIL_FROM || 'ufo <hello@yourdomain.com>';

export type EmailStatus = 'sent' | 'failed' | 'skipped_unconfigured';

async function send(to: string, subject: string, html: string): Promise<EmailStatus> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY not set — would have emailed ${to}: "${subject}"`);
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
    });
    if (!res.ok) {
      console.error('Resend send failed', await res.text());
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('Email send error', err);
    return 'failed';
  }
}

const wrapper = (body: string) => `
<div style="font-family:system-ui,sans-serif;background:#101114;color:#fff;padding:32px;border-radius:14px;max-width:480px;margin:0 auto;">
  <p style="font-family:monospace;font-size:12px;color:#D4FF4F;letter-spacing:0.05em;text-transform:uppercase;">ufo</p>
  ${body}
</div>`;

export async function sendWelcomeEmail(to: string, name: string): Promise<EmailStatus> {
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
    `)
  );
}

export async function sendLowCreditsEmail(
  to: string,
  creditsRemaining: number,
  plan: string
): Promise<EmailStatus> {
  return send(
    to,
    `You're down to ${creditsRemaining.toLocaleString()} credits`,
    wrapper(`
      <h1 style="font-size:20px;">Running low on credits</h1>
      <p style="color:#B5B7C0;line-height:1.6;">You have ${creditsRemaining.toLocaleString()}
      credits left on the ${escapeHtml(plan)} plan this cycle. Upgrade or grab a top-up pack to keep
      generating without interruption.</p>
    `)
  );
}

export async function sendPaymentFailedEmail(to: string): Promise<EmailStatus> {
  return send(
    to,
    'Your ufo payment didn’t go through',
    wrapper(`
      <h1 style="font-size:20px;">Payment failed</h1>
      <p style="color:#B5B7C0;line-height:1.6;">We couldn't process your last payment. Update
      your card from Billing in your dashboard to avoid losing access to your plan.</p>
    `)
  );
}

export async function sendSubscriptionCanceledEmail(to: string): Promise<EmailStatus> {
  return send(
    to,
    'Your ufo subscription was canceled',
    wrapper(`
      <h1 style="font-size:20px;">Subscription canceled</h1>
      <p style="color:#B5B7C0;line-height:1.6;">You're back on the Free plan. Your projects are
      still there — upgrade anytime from Billing to pick up where you left off.</p>
    `)
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
    `)
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
  params: { headline: string; detail: string; whenIso: string; context?: string }
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
    `)
  );
}
