'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';

/**
 * Share permissions for a published prototype: expiry, password and whether
 * visitors may comment.
 *
 * The controls are deliberately explicit about what each one does to people who
 * already hold the link, because none of these are reversible for a link that
 * has already been shared around — removing a password does not un-share it.
 *
 * Only the *intent* is expressed here. Enforcement is in the database (migration
 * 010): an expired or password-protected share is unreadable through the public
 * anon key, so these settings hold even if someone bypasses the app entirely.
 */

export interface ShareSettingsValue {
  expiresAt: string | null;
  hasPassword: boolean;
  allowComments: boolean;
}

/** `datetime-local` needs `YYYY-MM-DDTHH:mm` in *local* time, not an ISO/UTC string. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function minLocalInputValue(): string {
  const offset = new Date().getTimezoneOffset() * 60_000;
  return new Date(Date.now() + 60_000 - offset).toISOString().slice(0, 16);
}

export function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() <= Date.now()) return 'Expired';
  return `Expires ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export function ShareSettings({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: ShareSettingsValue;
  onChange: (next: ShareSettingsValue) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Draft state, so closing without saving changes nothing.
  const [expiry, setExpiry] = useState(() => toLocalInputValue(value.expiresAt));
  const [password, setPassword] = useState('');
  const [removePassword, setRemovePassword] = useState(false);
  const [allowComments, setAllowComments] = useState(value.allowComments);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setExpiry(toLocalInputValue(value.expiresAt));
    setPassword('');
    setRemovePassword(false);
    setAllowComments(value.allowComments);
    setError(null);
    setOpen(true);
  }

  async function save() {
    setError(null);

    let expiresAt: string | null = null;
    if (expiry) {
      const parsed = new Date(expiry);
      if (Number.isNaN(parsed.getTime())) {
        setError('That expiry date is not valid.');
        return;
      }
      if (parsed.getTime() <= Date.now()) {
        setError('The expiry must be in the future.');
        return;
      }
      expiresAt = parsed.toISOString();
    }

    // Undefined leaves the stored password alone; '' clears it. Sending the
    // empty string on every save would silently drop protection whenever
    // someone edited only the expiry.
    let passwordField: string | undefined;
    if (removePassword) passwordField = '';
    else if (password) {
      if (password.length < 6) {
        setError('Use at least 6 characters, or leave the password unchanged.');
        return;
      }
      passwordField = password;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/shares/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          // Settings never change visibility — that is the Publish button's job.
          isPublic: true,
          expiresAt,
          password: passwordField,
          allowComments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save the share settings.');
        return;
      }
      onChange({
        expiresAt: data.expires_at ?? null,
        hasPassword: !!data.hasPassword,
        allowComments: data.allow_comments ?? true,
      });
      toast.success('Share settings saved');
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const expiryLabel = formatExpiry(value.expiresAt);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={openModal}>
          Link settings
        </Button>
        {value.hasPassword && <Badge variant="info">Password protected</Badge>}
        {expiryLabel && (
          <Badge variant={expiryLabel === 'Expired' ? 'error' : 'warning'}>{expiryLabel}</Badge>
        )}
        {!value.allowComments && <Badge variant="neutral">Comments off</Badge>}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Share link settings"
        description="These apply to everyone who opens the public link."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} loadingLabel="Saving…">
              Save settings
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <Input
              type="datetime-local"
              label="Link expires"
              min={minLocalInputValue()}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              hint="After this time the link stops working for everyone. Leave empty for no expiry."
            />
            {expiry && (
              <button
                type="button"
                onClick={() => setExpiry('')}
                className="mt-1.5 text-[11px] text-brand-text hover:underline"
              >
                Clear expiry
              </button>
            )}
          </div>

          <div className="border-t border-edge pt-5">
            {value.hasPassword && !removePassword ? (
              <>
                <p className="text-xs font-medium text-fg-muted">Password</p>
                <p className="mt-1 text-xs text-fg-faint">
                  A password is set. It is stored hashed and cannot be shown again.
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setRemovePassword(true)}
                    className="text-[11px] text-accent-text hover:underline"
                  >
                    Remove password
                  </button>
                </div>
                <Input
                  containerClassName="mt-3"
                  type="password"
                  label="Replace with a new password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty to keep the current one"
                />
              </>
            ) : (
              <>
                <Input
                  type="password"
                  label="Password"
                  autoComplete="new-password"
                  value={removePassword ? '' : password}
                  disabled={removePassword}
                  onChange={(e) => setPassword(e.target.value)}
                  hint="Visitors must enter this before the prototype loads. Minimum 6 characters."
                  placeholder={removePassword ? 'Will be removed on save' : 'No password'}
                />
                {removePassword && (
                  <button
                    type="button"
                    onClick={() => setRemovePassword(false)}
                    className="mt-1.5 text-[11px] text-brand-text hover:underline"
                  >
                    Keep the existing password
                  </button>
                )}
              </>
            )}
          </div>

          <div className="border-t border-edge pt-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(e) => setAllowComments(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-studio-citron"
              />
              <span>
                <span className="block text-sm text-fg">Allow visitors to comment</span>
                <span className="mt-0.5 block text-xs text-fg-faint">
                  Turning this off hides the composer. Comments already left stay visible to you and
                  to visitors.
                </span>
              </span>
            </label>
          </div>

          {error && (
            <p role="alert" className="text-xs text-status-error">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
