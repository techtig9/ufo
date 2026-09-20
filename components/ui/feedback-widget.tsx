'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * In-app feedback.
 *
 * Deliberately not a modal: a modal steals focus and makes "I noticed
 * something odd on this screen" a bigger decision than it is. This opens a
 * small panel anchored to a persistent trigger, and closes on Escape.
 *
 * The rating is optional. Requiring a score before accepting a comment is how
 * bug reports get lost — someone who wants to tell you a button is broken does
 * not have a 1-to-5 opinion about it.
 *
 * The current path is sent so a report can be placed without asking "which
 * page were you on?", but only the path: a query string on a share page
 * carries a token, and the server strips one anyway if the client sends it.
 */
export function FeedbackWidget({ source = 'general' }: { source?: 'general' | 'first_success' }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const pathname = usePathname();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, rating, message: message.trim(), path: pathname }),
      });

      if (!res.ok) {
        // Show what the server actually said — "something went wrong" tells a
        // rate-limited user nothing about why, or when to try again.
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not send that — please try again.');
        return;
      }

      toast.success('Thank you — that goes straight to the team.');
      setMessage('');
      setRating(null);
      setOpen(false);
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 left-5 z-[140]">
      {open ? (
        <form
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          className="mb-2 w-80 rounded-panel border border-edge bg-elevated p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-fg">Send feedback</p>
              <p className="mt-0.5 text-xs text-fg-faint">
                A bug, a rough edge, or something you wish it did.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close feedback"
              className="rounded p-1 text-fg-faint hover:text-fg"
            >
              ✕
            </button>
          </div>

          <fieldset className="mt-3">
            <legend className="text-[11px] text-fg-faint">How is it going? (optional)</legend>
            <div className="mt-1.5 flex gap-1.5">
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={rating === r}
                  aria-label={`${r} out of 5`}
                  onClick={() => setRating(rating === r ? null : r)}
                  className={`h-8 w-8 rounded-md border text-xs transition-colors duration-micro ${
                    rating === r
                      ? 'border-brand bg-brand font-semibold text-brand-ink'
                      : 'border-edge text-fg-muted hover:border-edge-strong hover:text-fg'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </fieldset>

          <label htmlFor="feedback-message" className="sr-only">
            Your feedback
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            rows={4}
            required
            placeholder="What happened, or what would help?"
            className="mt-3 w-full resize-y rounded-md border border-edge bg-surface-subtle p-2.5 text-sm text-fg placeholder:text-fg-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-fg-faint">{message.length}/4000</span>
            <Button type="submit" size="sm" loading={sending} disabled={!message.trim()}>
              Send
            </Button>
          </div>
        </form>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full border border-edge bg-elevated px-3.5 py-2 text-xs text-fg-muted shadow-md transition-colors duration-micro hover:text-fg"
      >
        Feedback
      </button>
    </div>
  );
}
