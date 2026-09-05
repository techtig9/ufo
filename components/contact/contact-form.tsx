'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { GridField } from '@/components/ui/grid-field';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';

/**
 * The interactive half of /contact.
 *
 * `contactEmail` is passed in from the server rather than read here: it comes
 * from UFO_COMPANY_CONTACT_EMAIL, which is not a NEXT_PUBLIC_ variable, so a
 * client component sees the real value during SSR and `— not set —` in the
 * browser. That is a hydration mismatch (React #418), and it broke every render
 * of this page once the variable was actually set.
 *
 * For the same reason this renders neither Nav nor Footer: both are server
 * components, and rendering them from here would pull them into the client
 * bundle — where Footer's own companyValue call would reintroduce exactly the
 * mismatch this split was made to fix. The page composes them around this.
 */
export function ContactForm({ contactEmail }: { contactEmail: string }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, message }),
    });
    setSending(false);

    if (!res.ok) {
      // Prefer the server's reason — it distinguishes "you are rate limited"
      // and "messaging is not configured" from a generic failure.
      const reason = await res
        .json()
        .then((body: { error?: string }) => body?.error)
        .catch(() => undefined);
      toast.error(reason || 'Could not send — try emailing us directly instead');
      return;
    }
    setSent(true);
  }

  return (
    <main className="relative mx-auto max-w-lg px-6 py-16">
        <GridField strength="subtle" />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-wider text-brand-text">Support</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Get in touch</h1>
          <p className="mt-2 text-fg-muted">
            Billing, bugs, feature requests {'\u2014'} or just say hi. We read every message.
          </p>

          <Panel hover={false} className="mt-8">
            {sent ? (
              <p className="text-center text-fg-secondary">
                Sent {'\u2014'} we&rsquo;ll get back to you at <span className="text-fg">{email}</span>.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-fg-muted" htmlFor="email">Your email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none focus:border-studio-citron"
                  />
                </div>
                <div>
                  <label className="text-sm text-fg-muted" htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none focus:border-studio-citron"
                  />
                </div>
                <Button type="submit" disabled={sending} className="w-full">
                  {sending ? 'Sending\u2026' : 'Send message'}
                </Button>
              </form>
            )}
          </Panel>
          <p className="mt-6 text-center text-sm text-fg-faint">
            Prefer email? {contactEmail}
          </p>
        </div>
    </main>
  );
}
