'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UpgradeModal } from '@/components/dashboard/upgrade-modal';
import { CREDIT_COSTS, type CreditAction } from '@/lib/credits';
import type { Project, Screen } from '@/lib/types';

/**
 * The AI action surface (Master Command 2.C).
 *
 * The catalogue is fetched from the server rather than duplicated here, so the
 * panel can only ever offer actions the backend actually implements — there is
 * no way for a button to exist for something that does not run.
 *
 * Rewrites are proposed, never auto-applied: the user previews the result and
 * chooses. Applying goes through the existing PATCH /api/screens/[id], which is
 * what records the version snapshot, so an AI change stays undoable.
 */

interface ActionDef {
  id: string;
  kind: 'screen_rewrite' | 'new_screen' | 'tokens' | 'analysis';
  label: string;
  description: string;
  needsScreen: boolean;
  needsInstruction: boolean;
  credit: CreditAction;
}

interface Finding {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  location?: string;
  suggestion?: string;
}

interface SavedPrompt {
  id: string;
  title: string;
  body: string;
  action: string | null;
}

type Outcome =
  | { kind: 'screen_rewrite'; action: string; screenId: string; code: string }
  | { kind: 'analysis'; action: string; result: { summary: string; findings?: Finding[] } }
  | { kind: 'tokens'; action: string; result: Record<string, unknown> }
  | { kind: 'new_screen'; action: string; result: { name: string; code: string } };

const severityVariant = { high: 'error', medium: 'warning', low: 'info' } as const;

export function AIActionsPanel({
  project,
  screen,
  onApplied,
  onScreenCreated,
}: {
  project: Project;
  screen?: Screen;
  onApplied: (screen: Screen) => void;
  onScreenCreated?: (screen: Screen) => void;
}) {
  const [actions, setActions] = useState<ActionDef[]>([]);
  const [active, setActive] = useState<ActionDef | null>(null);
  const [instruction, setInstruction] = useState('');
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);

  useEffect(() => {
    fetch(`/api/projects/${project.id}/ai-action`)
      .then((r) => (r.ok ? r.json() : { actions: [] }))
      .then((d) => setActions(d.actions ?? []))
      .catch(() => undefined);
  }, [project.id]);

  const loadPrompts = useCallback(() => {
    fetch('/api/prompts')
      .then((r) => (r.ok ? r.json() : { prompts: [] }))
      .then((d) => setPrompts(d.prompts ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(loadPrompts, [loadPrompts]);

  async function run(def: ActionDef) {
    if (def.needsScreen && !screen) {
      toast.error('Select a screen first');
      return;
    }
    if (def.needsInstruction && !instruction.trim()) {
      setActive(def);
      toast.error(`${def.label} needs a short description`);
      return;
    }

    setActive(def);
    setRunning(true);
    setOutcome(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/ai-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: def.id,
          screenId: screen?.id,
          instruction: instruction.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) setUpgradeReason(data.error ?? 'You’ve hit a plan limit.');
        else toast.error(data.error ?? `${def.label} failed`);
        return;
      }

      if (data.kind === 'screen_rewrite') {
        setOutcome({ kind: 'screen_rewrite', action: def.id, screenId: data.screenId, code: data.code });
      } else {
        setOutcome({ kind: data.kind, action: def.id, result: data.result });
      }
    } catch {
      toast.error('AI request failed — check your connection');
    } finally {
      setRunning(false);
    }
  }

  async function applyRewrite() {
    if (outcome?.kind !== 'screen_rewrite' || !screen) return;
    setRunning(true);
    // Through the normal screen PATCH, so the change is versioned and undoable.
    const res = await fetch(`/api/screens/${outcome.screenId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: outcome.code, instruction: active?.label, source: 'ai' }),
    });
    const data = await res.json();
    setRunning(false);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not apply the change');
      return;
    }
    onApplied(data.screen);
    setOutcome(null);
    toast.success(`${active?.label} applied and versioned`);
  }

  async function applyTokens() {
    if (outcome?.kind !== 'tokens') return;
    setRunning(true);
    const colors = (outcome.result as { colors?: Record<string, string> }).colors ?? outcome.result;
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorTheme: colors }),
    });
    const data = await res.json();
    setRunning(false);
    if (!res.ok) {
      toast.error(data.error ?? 'Could not apply the theme');
      return;
    }
    setOutcome(null);
    toast.success('Theme updated');
  }

  async function applyNewScreen() {
    if (outcome?.kind !== 'new_screen') return;
    setRunning(true);
    const res = await fetch(`/api/projects/${project.id}/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: outcome.result.name, code: outcome.result.code }),
    });
    const data = await res.json();
    setRunning(false);
    if (!res.ok) {
      toast.error(data.error ?? 'Could not add the screen');
      return;
    }
    onScreenCreated?.(data.screen);
    setOutcome(null);
    setInstruction('');
    toast.success(`“${outcome.result.name}” added`);
  }

  async function savePrompt() {
    const body = instruction.trim();
    if (!body) {
      toast.error('Write a prompt first');
      return;
    }
    const title = body.slice(0, 60);
    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, action: active?.id }),
    });
    if (!res.ok) {
      toast.error('Could not save the prompt');
      return;
    }
    loadPrompts();
    toast.success('Prompt saved');
  }

  async function deletePrompt(id: string) {
    const res = await fetch(`/api/prompts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Could not delete the prompt');
      return;
    }
    setPrompts((p) => p.filter((x) => x.id !== id));
  }

  const rewrites = actions.filter((a) => a.kind === 'screen_rewrite');
  const analyses = actions.filter((a) => a.kind === 'analysis');
  const creators = actions.filter((a) => a.kind === 'new_screen' || a.kind === 'tokens');

  function ActionButton({ def }: { def: ActionDef }) {
    const disabled = running || (def.needsScreen && !screen);
    return (
      <button
        type="button"
        onClick={() => run(def)}
        disabled={disabled}
        title={def.description}
        className="group flex w-full items-center justify-between gap-2 rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-left text-xs transition hover:border-studio-citron/40 hover:bg-surface-raised disabled:opacity-40 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-studio-citron"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-fg-secondary">{def.label}</span>
          <span className="mt-0.5 block truncate text-[10px] text-fg-faint">{def.description}</span>
        </span>
        <span className="shrink-0 rounded-full border border-edge px-1.5 py-0.5 text-[9px] text-fg-faint">
          {CREDIT_COSTS[def.credit]}
        </span>
      </button>
    );
  }

  return (
    <>
      {upgradeReason && <UpgradeModal reason={upgradeReason} onClose={() => setUpgradeReason(null)} />}

      <section className="panel rounded-panel p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-text">UFO AI</p>
        <h3 className="mt-1 font-display text-lg font-semibold">AI actions</h3>
        <p className="mt-1 text-xs leading-5 text-fg-muted">
          {screen ? `Working on ${screen.name}` : 'Select a screen for screen-level actions'}
        </p>

        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
          Direction (optional for most actions)
        </label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
          disabled={running}
          placeholder="e.g. “calmer, more editorial, less neon”"
          className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none transition-colors focus:border-studio-citron disabled:opacity-40"
        />
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" onClick={savePrompt} disabled={running || !instruction.trim()}>
            Save prompt
          </Button>
          {instruction && (
            <Button size="sm" variant="ghost" onClick={() => setInstruction('')} disabled={running}>
              Clear
            </Button>
          )}
        </div>

        {prompts.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Saved prompts</p>
            <ul className="mt-1.5 space-y-1">
              {prompts.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setInstruction(p.body)}
                    className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-[11px] text-fg-muted hover:bg-surface-subtle hover:text-fg"
                  >
                    {p.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePrompt(p.id)}
                    aria-label={`Delete saved prompt ${p.title}`}
                    className="rounded px-1.5 py-1 text-[11px] text-fg-faint hover:text-status-error"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actions.length === 0 ? (
          <p className="mt-4 text-xs text-fg-faint">Loading actions…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
                Rewrite this screen
              </p>
              <div className="space-y-1.5">
                {rewrites.map((a) => <ActionButton key={a.id} def={a} />)}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
                Review (changes nothing)
              </p>
              <div className="space-y-1.5">
                {analyses.map((a) => <ActionButton key={a.id} def={a} />)}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Create</p>
              <div className="space-y-1.5">
                {creators.map((a) => <ActionButton key={a.id} def={a} />)}
              </div>
            </div>
          </div>
        )}

        {running && (
          <p className="mt-4 animate-pulse text-xs text-brand-text" role="status">
            Running {active?.label ?? 'action'}…
          </p>
        )}

        {outcome?.kind === 'screen_rewrite' && (
          <div className="mt-4 rounded-lg border border-studio-citron/30 bg-studio-citron/5 p-3">
            <p className="text-xs font-medium">{active?.label} — proposed</p>
            <p className="mt-1 text-[11px] text-fg-muted">
              Nothing has changed yet. Applying saves a version you can restore.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={applyRewrite} disabled={running}>Apply</Button>
              <Button size="sm" variant="ghost" onClick={() => setOutcome(null)} disabled={running}>
                Discard
              </Button>
            </div>
          </div>
        )}

        {outcome?.kind === 'tokens' && (
          <div className="mt-4 rounded-lg border border-studio-citron/30 bg-studio-citron/5 p-3">
            <p className="text-xs font-medium">New theme — proposed</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(
                (outcome.result as { colors?: Record<string, string> }).colors ?? {}
              ).map(([role, value]) => (
                <span key={role} className="flex items-center gap-1 rounded border border-edge px-1.5 py-0.5 text-[10px] text-fg-muted">
                  <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-edge-strong" style={{ background: String(value) }} />
                  {role}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={applyTokens} disabled={running}>Apply theme</Button>
              <Button size="sm" variant="ghost" onClick={() => setOutcome(null)} disabled={running}>Discard</Button>
            </div>
          </div>
        )}

        {outcome?.kind === 'new_screen' && (
          <div className="mt-4 rounded-lg border border-studio-citron/30 bg-studio-citron/5 p-3">
            <p className="text-xs font-medium">New screen — “{outcome.result.name}”</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={applyNewScreen} disabled={running}>Add screen</Button>
              <Button size="sm" variant="ghost" onClick={() => setOutcome(null)} disabled={running}>Discard</Button>
            </div>
          </div>
        )}

        {outcome?.kind === 'analysis' && (
          <div className="mt-4 rounded-lg border border-edge bg-surface-subtle p-3">
            <p className="text-xs font-medium">{active?.label}</p>
            <p className="mt-1 text-[11px] leading-5 text-fg-muted">{outcome.result.summary}</p>

            {outcome.result.findings && outcome.result.findings.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {outcome.result.findings.map((f, i) => (
                  <li key={i} className="rounded border border-edge bg-surface-subtle p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={severityVariant[f.severity] ?? 'neutral'} size="sm">{f.severity}</Badge>
                      <span className="text-[11px] font-medium text-fg-secondary">{f.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-fg-muted">{f.detail}</p>
                    {f.location && <p className="mt-1 text-[10px] text-fg-faint">Where: {f.location}</p>}
                    {f.suggestion && <p className="mt-1 text-[10px] text-brand-text/80">Fix: {f.suggestion}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-fg-faint">No issues reported.</p>
            )}

            <Button size="sm" variant="ghost" className="mt-3" onClick={() => setOutcome(null)}>Close</Button>
          </div>
        )}
      </section>
    </>
  );
}
