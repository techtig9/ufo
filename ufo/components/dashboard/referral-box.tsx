'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

export function ReferralBox({ referralCode, userId }: { referralCode: string | null; userId: string }) {
  const [code, setCode] = useState(referralCode);
  const [loading, setLoading] = useState(!referralCode);

  useEffect(() => {
    if (code) return;
    fetch('/api/account/referral-code', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => setCode(d.code))
      .finally(() => setLoading(false));
  }, [code]);

  const link = code && typeof window !== 'undefined' ? `${window.location.origin}/signup?ref=${code}` : '';

  function copy() {
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied');
  }

  if (loading) return <div className="shimmer h-9 w-full max-w-sm" />;

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg border border-line bg-white/5 px-3 py-2 text-xs text-white/60">
        {link}
      </code>
      <Button size="sm" variant="secondary" onClick={copy}>Copy</Button>
    </div>
  );
}
