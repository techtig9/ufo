'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function UpgradeModal({ reason, onClose }: { reason: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-6">
      <div className="panel crop-marks w-full max-w-sm p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-studio-coral">Limit reached</p>
        <h2 className="mt-2 font-display text-lg font-medium">{reason}</h2>
        <p className="mt-2 text-sm text-white/50">
          Upgrade your plan or grab a credit top-up to keep going — everything you&rsquo;ve built stays exactly where it is.
        </p>
        <div className="mt-6 flex gap-2">
          <Link href="/dashboard/billing" className="flex-1">
            <Button className="w-full">View plans</Button>
          </Link>
          <Button variant="secondary" onClick={onClose}>Not now</Button>
        </div>
      </div>
    </div>
  );
}
