'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Screen } from '@/lib/types';

interface Version {
  id: string;
  code: string;
  instruction?: string | null;
  source?: 'manual' | 'ai';
  created_at: string;
}

export function VersionHistoryPanel({
  projectId,
  screen,
  onRestored,
}: {
  projectId: string;
  screen?: Screen;
  onRestored: (screen: Screen) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmVersion, setConfirmVersion] = useState<Version | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!screen) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/versions?screenId=${screen.id}`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .catch(() => toast.error('Could not load version history'))
      .finally(() => setLoading(false));
  }, [projectId, screen?.id]);

  async function restore() {
    if (!screen || !confirmVersion) return;

    setRestoring(true);
    const res = await fetch(`/api/projects/${projectId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenId: screen.id, versionId: confirmVersion.id }),
    });
    const data = await res.json();
    setRestoring(false);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not restore version');
      return;
    }

    onRestored(data.screen);
    setConfirmVersion(null);
    toast.success('Version restored');
  }

  return (
    <section className="panel rounded-panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-faint">History</p>
          <h3 className="mt-1 font-medium">Version history</h3>
        </div>
        {loading && <span className="text-xs text-fg-faint">Loading…</span>}
      </div>

      {!screen ? (
        <p className="mt-3 text-xs text-fg-faint">Select a screen first.</p>
      ) : !versions.length && !loading ? (
        <p className="mt-3 text-xs text-fg-faint">No previous versions yet. Saving edits creates them automatically.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {versions.map((version, index) => (
            <div key={version.id} className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-surface-subtle px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-fg-secondary">Version {versions.length - index}</p>
                  <Badge variant={version.source === 'ai' ? 'primary' : 'neutral'} size="sm">
                    {version.source === 'ai' ? 'AI' : 'Manual'}
                  </Badge>
                </div>
                {version.instruction && (
                  <p className="mt-0.5 truncate text-[10px] text-fg-faint" title={version.instruction}>{version.instruction}</p>
                )}
                <p className="text-[10px] text-fg-faint">{new Date(version.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setConfirmVersion(version)}
                className="shrink-0 rounded-md border border-edge px-2 py-1 text-[10px] text-fg-muted hover:border-studio-citron/40 hover:text-fg"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!confirmVersion}
        onClose={() => setConfirmVersion(null)}
        title="Restore this version?"
        description="The current code will be saved as a new version first, so nothing is lost."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmVersion(null)} disabled={restoring}>Cancel</Button>
            <Button onClick={restore} disabled={restoring}>{restoring ? 'Restoring…' : 'Restore'}</Button>
          </>
        }
      />
    </section>
  );
}
