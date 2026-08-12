'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { Screen } from '@/lib/types';

interface Version {
  id: string;
  code: string;
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

  useEffect(() => {
    if (!screen) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/versions?screenId=${screen.id}`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .catch(() => toast.error('Could not load version history'))
      .finally(() => setLoading(false));
  }, [projectId, screen?.id]);

  async function restore(versionId: string) {
    if (!screen || !window.confirm('Restore this version? The current code will be saved as a new version first.')) return;

    const res = await fetch(`/api/projects/${projectId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenId: screen.id, versionId }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? 'Could not restore version');
      return;
    }

    onRestored(data.screen);
    toast.success('Version restored');
  }

  return (
    <section className="panel rounded-panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">History</p>
          <h3 className="mt-1 font-medium">Version history</h3>
        </div>
        {loading && <span className="text-xs text-white/30">Loading…</span>}
      </div>

      {!screen ? (
        <p className="mt-3 text-xs text-white/35">Select a screen first.</p>
      ) : !versions.length && !loading ? (
        <p className="mt-3 text-xs text-white/35">No previous versions yet. Saving edits creates them automatically.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {versions.map((version, index) => (
            <div key={version.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <div>
                <p className="text-xs font-medium text-white/70">Version {versions.length - index}</p>
                <p className="text-[10px] text-white/35">{new Date(version.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => restore(version.id)} className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/50 hover:border-studio-citron/40 hover:text-white">
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
                }
