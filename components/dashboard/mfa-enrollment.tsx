'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

interface Factor {
  id: string;
  status: string;
  factor_type: string;
}

export function MfaEnrollment() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshFactors();
  }, []);

  async function refreshFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }

  async function startEnroll() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      toast.error(error.message);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setEnrolling(true);
  }

  async function verifyEnroll() {
    if (!factorId) return;
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      toast.error(challengeError?.message ?? 'Could not start verification');
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) {
      toast.error('Wrong code \u2014 try again');
      return;
    }
    toast.success('Two-factor authentication enabled');
    setEnrolling(false);
    setQrCode(null);
    setCode('');
    refreshFactors();
  }

  async function unenroll(id: string) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Two-factor authentication removed');
    refreshFactors();
  }

  if (loading) return <div className="shimmer h-9 w-full max-w-sm" />;

  const verifiedFactor = factors.find((f) => f.status === 'verified');

  if (verifiedFactor) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">Two-factor authentication is on.</p>
        <Button size="sm" variant="danger" onClick={() => unenroll(verifiedFactor.id)}>
          Turn off
        </Button>
      </div>
    );
  }

  if (enrolling && qrCode) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-white/60">Scan with Google Authenticator, 1Password, or similar.</p>
        <div
          className="w-fit rounded-lg bg-white p-2"
          dangerouslySetInnerHTML={{ __html: qrCode }}
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6-digit code"
          className="w-full max-w-[160px] rounded-lg border border-line bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={verifyEnroll}>Verify &amp; enable</Button>
          <Button size="sm" variant="ghost" onClick={() => setEnrolling(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <Button size="sm" variant="secondary" onClick={startEnroll}>
      Enable two-factor authentication
    </Button>
  );
}
