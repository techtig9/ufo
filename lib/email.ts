const RESEND_API_BASE = 'https://api.resend.com/emails';
const FROM = process.env.EMAIL_FROM || 'ufo <hello@yourdomain.com>';

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY not set — would have emailed ${to}: "${subject}"`);
    return;
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
    if (!res.ok) console.error('Resend send failed', await res.text());
  } catch (err) {
    console.error('Email send error', err);
  }
}

const wrapper = (body: string) => `
<div style="font-family:system-ui,sans-serif;background:#101114;color:#fff;padding:32px;border-radius:14px;max-width:480px;margin:0 auto;">
  <p style="font-family:monospace;font-size:12px;color:#D4FF4F;letter-spacing:0.05em;text-transform:uppercase;">ufo</p>
  ${body}
</div>`;

export async function sendWelcomeEmail(to: string, name: string) {
  await send(
    to,
    'Welcome to ufo',
    wrapper(`
      <h1 style="font-size:20px;">Hey ${name || 'there'} \u2014 welcome</h1>
      <p style="color:#B5B7C0;line-height:1.6;">You've got 150 free credits to try the generator.
      Head to AI Designer and describe your first project \u2014 most people have a clickable
      prototype in under a minute.</p>
    `)
  );
}

export async function sendLowCreditsEmail(to: string, creditsRemaining: number, plan: string) {
  await send(
    to,
    `You're down to ${creditsRemaining.toLocaleString()} credits`,
    wrapper(`
      <h1 style="font-size:20px;">Running low on credits</h1>
      <p style="color:#B5B7C0;line-height:1.6;">You have ${creditsRemaining.toLocaleString()}
      credits left on the ${plan} plan this cycle. Upgrade or grab a top-up pack to keep
      generating without interruption.</p>
    `)
  );
}

export async function sendPaymentFailedEmail(to: string) {
  await send(
    to,
    'Your ufo payment didn\u2019t go through',
    wrapper(`
      <h1 style="font-size:20px;">Payment failed</h1>
      <p style="color:#B5B7C0;line-height:1.6;">We couldn't process your last payment. Update
      your card from Billing in your dashboard to avoid losing access to your plan.</p>
    `)
  );
}

export async function sendSubscriptionCanceledEmail(to: string) {
  await send(
    to,
    'Your ufo subscription was canceled',
    wrapper(`
      <h1 style="font-size:20px;">Subscription canceled</h1>
      <p style="color:#B5B7C0;line-height:1.6;">You're back on the Free plan. Your projects are
      still there \u2014 upgrade anytime from Billing to pick up where you left off.</p>
    `)
  );
}

export async function sendContactFormEmail(fromEmail: string, message: string) {
  const supportInbox = process.env.SUPPORT_INBOX_EMAIL || FROM;
  await send(
    supportInbox,
    `New contact form message from ${fromEmail}`,
    wrapper(`
      <h1 style="font-size:18px;">New support message</h1>
      <p style="color:#B5B7C0;">From: ${fromEmail}</p>
      <p style="color:#fff;white-space:pre-wrap;line-height:1.6;">${message}</p>
    `)
  );
}
