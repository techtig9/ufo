'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

export function CancelSubscriptionButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    setLoading(true);
    const res = await fetch('/api/billing/cancel', { method: 'POST' });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? 'Could not cancel your subscription');
      return;
    }

    toast.success('Subscription canceled — you\u2019re back on the Free plan.');
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-white/40 underline decoration-dotted hover:text-white/60"
      >
        Cancel subscription
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/50">Cancel immediately and drop to Free?</span>
      <Button variant="danger" size="sm" disabled={loading} onClick={handleCancel}>
        {loading ? 'Canceling\u2026' : 'Yes, cancel'}
      </Button>
      <button onClick={() => setConfirming(false)} className="text-xs text-white/40 hover:text-white/60">
        Never mind
      </button>
    </div>
  );
}
