'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Nav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';
import { GridField } from '@/components/ui/grid-field';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';

export default function ContactPage() {
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
      toast.error('Could not send — try emailing us directly instead');
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="relative mx-auto max-w-lg px-6 py-16">
        <GridField strength="subtle" />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-wider text-studio-citron">Support</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Get in touch</h1>
          <p className="mt-2 text-white/50">
            Billing, bugs, feature requests {'\u2014'} or just say hi. We read every message.
          </p>

          <Panel hover={false} className="mt-8">
            {sent ? (
              <p className="text-center text-white/70">
                Sent {'\u2014'} we&rsquo;ll get back to you at <span className="text-white">{email}</span>.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-white/60" htmlFor="email">Your email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/60" htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
                  />
                </div>
                <Button type="submit" disabled={sending} className="w-full">
                  {sending ? 'Sending\u2026' : 'Send message'}
                </Button>
              </form>
            )}
          </Panel>
          <p className="mt-6 text-center text-sm text-white/30">
            Prefer email? [your contact email]
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
