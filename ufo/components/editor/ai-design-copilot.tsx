'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import type { Project, Screen } from '@/lib/types';

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

  async function generateProposal() {
    if (!screen || !instruction.trim()) return;

    setLoading(true);
    setProposal(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/ai-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenId: screen.id, instruction: instruction.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'AI could not edit this screen');
        return;
      }

      setProposal({ code: data.code, changes: data.changes ?? [] });
    } catch {
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
      body: JSON.stringify({ code: proposal.code }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not apply AI changes');
      return;
    }

    onApplied(data.screen);
    setProposal(null);
    setInstruction('');
    toast.success('AI changes applied and versioned');
  }

  return (
    <section className="panel rounded-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-studio-citron">UFO AI</p>
          <h3 className="mt-1 font-display text-lg font-semibold">Design Copilot</h3>
          <p className="mt-1 text-xs leading-5 text-white/45">
            {screen ? `Editing ${screen.name}` : 'Select a screen to start'}
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/35">Context aware</span>
      </div>

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        disabled={!screen || loading}
        placeholder='Try: “Make this dashboard feel more premium and improve hierarchy.”'
        rows={3}
        className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-studio-citron/60 disabled:opacity-50"
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
            className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/45 hover:border-white/20 hover:text-white disabled:opacity-30"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <Button className="mt-4 w-full" onClick={generateProposal} disabled={!screen || !instruction.trim() || loading}>
        {loading ? 'UFO is designing…' : 'Generate improvement'}
      </Button>

      {proposal && (
        <div className="mt-4 rounded-xl border border-studio-citron/20 bg-studio-citron/5 p-3">
          <p className="text-xs font-medium text-white/80">Proposed changes</p>
          <ul className="mt-2 space-y-1">
            {proposal.changes.map((change) => (
              <li key={change} className="text-xs text-white/50">✓ {change}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={applyProposal} disabled={loading}>Apply changes</Button>
            <Button size="sm" variant="secondary" onClick={() => setProposal(null)} disabled={loading}>Discard</Button>
          </div>
        </div>
      )}
    </section>
  );
}
