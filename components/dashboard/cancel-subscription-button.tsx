'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

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

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-fg-faint underline decoration-dotted hover:text-fg-muted"
      >
        Cancel subscription
      </button>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Cancel your subscription?"
        description="This takes effect immediately and drops you to the Free plan. You can resubscribe any time."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={loading}>Never mind</Button>
            <Button variant="danger" onClick={handleCancel} disabled={loading}>
              {loading ? 'Canceling…' : 'Yes, cancel'}
            </Button>
          </>
        }
      />
    </>
  );
}
