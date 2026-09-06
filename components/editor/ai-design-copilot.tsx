'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { UpgradeModal } from '@/components/dashboard/upgrade-modal';
import { CREDIT_COSTS } from '@/lib/credits';
import type { Project, Screen } from '@/lib/types';

interface HistoryEntry {
  id: string;
  instruction: string;
  changes: string[];
  appliedAt: string;
}

export function AIDesignCopilot({
  project,
  screen,
  onApplied,
}: {
  project: Project;
  screen?: Screen;
  onApplied: (screen: Screen) => void;
}) {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<{ code: string; changes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  // Seeded from real persisted history (screen_versions rows with source='ai') on screen
  // change, then appended to optimistically as edits are applied this session — so history
  // survives a reload or switching screens and back, addressing spec Section 36 (AI Memory)
  // without a parallel chat-log table.
  // Stored WITH the screen it belongs to, and read back below only when the two
  // still agree. The previous version kept a bare array that an effect cleared
  // and refilled on every screen change, which meant a render could briefly
  // show one screen's AI history under another screen's name.
  const [historyFor, setHistoryFor] = useState<{ screenId: string; entries: HistoryEntry[] } | null>(null);

  const history = historyFor && historyFor.screenId === screen?.id ? historyFor.entries : [];
  // Derived rather than a separate flag: we are loading exactly while there is
  // a screen whose history we have not stored yet. A flag would be a second
  // source of truth that could disagree with the first — and setting it in the
  // effect body cost an extra render pass on every screen change.
  const historyLoading = !!screen && historyFor?.screenId !== screen.id;

  useEffect(() => {
    fetch('/api/account/plan')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setCreditsRemaining(data.creditsRemaining ?? null); })
      .catch(() => undefined);
  }, []);

  const screenId = screen?.id;

  useEffect(() => {
    // No screen: nothing to fetch, and nothing to clear either — `history`
    // above already reads as empty because the stored screenId cannot match.
    if (!screenId) return;

    let cancelled = false;

    fetch(`/api/projects/${project.id}/versions?screenId=${screenId}`)
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((data) => {
        if (cancelled) return;
        const aiVersions = (data.versions ?? []).filter((v: { source?: string }) => v.source === 'ai');
        setHistoryFor({
          screenId,
          entries: aiVersions.map((v: { id: string; instruction?: string | null; created_at: string }) => ({
            id: v.id,
            instruction: v.instruction ?? '(no prompt recorded)',
            changes: [],
            appliedAt: v.created_at,
          })),
        });
      })
      .catch(() => {
        // Store an empty history for this screen rather than leaving nothing:
        // `historyLoading` is derived from whether we have a result, so
        // failing silently would leave the panel loading forever.
        if (!cancelled) setHistoryFor({ screenId, entries: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [project.id, screenId]);

  async function generateProposal(overrideInstruction?: string) {
    const activeInstruction = overrideInstruction ?? instruction;
    if (!screen || !activeInstruction.trim()) return;

    setLoading(true);
    setProposal(null);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/ai-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenId: screen.id, instruction: activeInstruction.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setUpgradeReason(data.error ?? 'You\u2019ve hit a plan limit.');
        } else {
          setError(data.error ?? 'AI could not edit this screen');
          toast.error(data.error ?? 'AI could not edit this screen');
        }
        return;
      }

      setProposal({ code: data.code, changes: data.changes ?? [] });
      // The edit itself already deducted credits server-side — refresh the displayed balance.
      fetch('/api/account/plan')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setCreditsRemaining(d.creditsRemaining ?? null); })
        .catch(() => undefined);
    } catch {
      setError('AI request failed \u2014 check your connection');
      toast.error('AI request failed');
    } finally {
      setLoading(false);
    }
  }

  async function applyProposal() {
    if (!screen || !proposal) return;

    setLoading(true);
    const res = await fetch(`/api/screens/${screen.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: proposal.code, instruction, source: 'ai' }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not apply AI changes');
      return;
    }

    onApplied(data.screen);
    setHistoryFor((current) => ({
      screenId: screen.id,
      entries: [
        { id: crypto.randomUUID(), instruction, changes: proposal.changes, appliedAt: new Date().toISOString() },
        ...(current?.screenId === screen.id ? current.entries : []),
      ].slice(0, 20),
    }));
    setProposal(null);
    setInstruction('');
    toast.success('AI changes applied and versioned');
  }

  function clear() {
    setInstruction('');
    setProposal(null);
    setError(null);
  }

  function editPreviousPrompt(entry: HistoryEntry) {
    setInstruction(entry.instruction);
    setProposal(null);
    setError(null);
  }

  return (
    <>
      {upgradeReason && <UpgradeModal reason={upgradeReason} onClose={() => setUpgradeReason(null)} />}
      <section className="panel rounded-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-text">UFO AI</p>
            <h3 className="mt-1 font-display text-lg font-semibold">Design Copilot</h3>
            <p className="mt-1 text-xs leading-5 text-fg-muted">
              {screen ? `Editing ${screen.name}` : 'Select a screen to start'}
            </p>
          </div>
          <div className="text-right">
            <span className="block rounded-full border border-edge px-2 py-1 text-[10px] text-fg-faint">
              {CREDIT_COSTS.update_screen} credits/edit
            </span>
            {creditsRemaining !== null && (
              <span className="mt-1 block text-[10px] text-fg-faint">{creditsRemaining.toLocaleString()} remaining</span>
            )}
          </div>
        </div>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={!screen || loading}
          placeholder="Try: “Make this dashboard feel more premium and improve hierarchy.”"
          rows={3}
          className="mt-4 w-full resize-none rounded-xl border border-edge bg-surface-subtle px-3 py-2.5 text-sm text-fg outline-none placeholder:text-fg-faint focus:border-studio-citron/60 disabled:opacity-50"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            'Improve visual hierarchy',
            'Make it more premium',
            'Improve mobile layout',
            'Make the CTA stronger',
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setInstruction(suggestion)}
              disabled={!screen || loading}
              className="rounded-full border border-edge px-2.5 py-1 text-[10px] text-fg-muted hover:border-edge-strong hover:text-fg disabled:opacity-30"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => generateProposal()} disabled={!screen || !instruction.trim() || loading}>
            {loading ? 'UFO is designing\u2026' : 'Generate improvement'}
          </Button>
          {(instruction || proposal) && (
            <Button variant="secondary" onClick={clear} disabled={loading}>Clear</Button>
          )}
        </div>

        {error && !loading && (
          <div className="mt-3 rounded-xl border border-status-error/30 bg-status-error/5 p-3">
            <p className="text-xs text-status-error">{error}</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => generateProposal()}>
              Retry
            </Button>
          </div>
        )}

        {proposal && (
          <div className="mt-4 rounded-xl border border-studio-citron/20 bg-studio-citron/5 p-3">
            <p className="text-xs font-medium text-fg-secondary">Proposed changes</p>
            <ul className="mt-2 space-y-1">
              {proposal.changes.map((change) => (
                <li key={change} className="text-xs text-fg-muted">✓ {change}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={applyProposal} disabled={loading}>Apply changes</Button>
              <Button size="sm" variant="secondary" onClick={() => generateProposal()} disabled={loading}>
                Regenerate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProposal(null)} disabled={loading}>Discard</Button>
            </div>
          </div>
        )}

        {(history.length > 0 || historyLoading) && (
          <div className="mt-5 border-t border-edge pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-faint">
              AI history {historyLoading && '\u00b7 loading\u2026'}
            </p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button
                    onClick={() => editPreviousPrompt(entry)}
                    disabled={loading}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-fg-muted hover:bg-surface-subtle hover:text-fg disabled:opacity-40"
                    title="Click to edit and re-run this prompt"
                  >
                    <span className="line-clamp-1">{entry.instruction}</span>
                    <span className="text-[9px] text-fg-faint">{new Date(entry.appliedAt).toLocaleString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
