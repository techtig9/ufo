'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function DangerZone() {
  const router = useRouter();
  const supabase = createClient();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    const res = await fetch('/api/account/export');
    if (!res.ok) {
      toast.error('Could not export your data');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ufo-data-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch('/api/account/delete', { method: 'POST' });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? 'Could not delete your account');
      return;
    }

    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-white/60">Download everything ufo has stored about your account.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={handleExport}>
          Export my data
        </Button>
      </div>

      <div className="border-t border-line pt-4">
        <p className="text-sm text-white/60">
          Permanently delete your account, projects, and billing history. This cancels any active
          subscription and can&rsquo;t be undone.
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="mt-3 w-full max-w-xs rounded-lg border border-line bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-coral"
        />
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          disabled={confirmText !== 'DELETE' || deleting}
          onClick={handleDelete}
        >
          {deleting ? 'Deleting\u2026' : 'Delete my account'}
        </Button>
      </div>
    </div>
  );
}
