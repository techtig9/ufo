'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Screen } from '@/lib/types';

type DialogState =
  | { type: 'add' }
  | { type: 'rename'; screen: Screen }
  | { type: 'delete'; screen: Screen }
  | null;

export function ScreenPanel({
  projectId,
  screens,
  activeScreenId,
  onScreensChange,
  onSelect,
}: {
  projectId: string;
  screens: Screen[];
  activeScreenId?: string;
  onScreensChange: (screens: Screen[]) => void;
  onSelect: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [nameInput, setNameInput] = useState('');

  const sorted = [...screens].sort((a, b) => a.order_index - b.order_index);

  function openAdd() {
    setNameInput(`Screen ${sorted.length + 1}`);
    setDialog({ type: 'add' });
  }

  function openRename(screen: Screen) {
    setNameInput(screen.name);
    setDialog({ type: 'rename', screen });
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;

    setBusy('add');
    const res = await fetch(`/api/projects/${projectId}/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setBusy(null);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not create screen');
      return;
    }

    onScreensChange([...sorted, data.screen]);
    onSelect(data.screen.id);
    setDialog(null);
    toast.success('Screen added');
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (dialog?.type !== 'rename') return;
    const name = nameInput.trim();
    if (!name || name === dialog.screen.name) {
      setDialog(null);
      return;
    }

    setBusy(dialog.screen.id);
    const res = await fetch(`/api/screens/${dialog.screen.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setBusy(null);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not rename screen');
      return;
    }

    onScreensChange(sorted.map((s) => (s.id === dialog.screen.id ? data.screen : s)));
    setDialog(null);
    toast.success('Screen renamed');
  }

  async function duplicateScreen(screen: Screen) {
    setBusy(screen.id);
    const res = await fetch(`/api/projects/${projectId}/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${screen.name} Copy`, code: screen.code }),
    });
    const data = await res.json();
    setBusy(null);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not duplicate screen');
      return;
    }

    onScreensChange([...sorted, data.screen]);
    onSelect(data.screen.id);
    toast.success('Screen duplicated');
  }

  async function handleDeleteConfirm() {
    if (dialog?.type !== 'delete') return;
    const screen = dialog.screen;

    if (sorted.length <= 1) {
      toast.error('A project must keep at least one screen');
      setDialog(null);
      return;
    }

    setBusy(screen.id);
    const res = await fetch(`/api/screens/${screen.id}`, { method: 'DELETE' });
    const data = await res.json();
    setBusy(null);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not delete screen');
      return;
    }

    const next = sorted.filter((s) => s.id !== screen.id);
    onScreensChange(next);
    if (activeScreenId === screen.id && next[0]) onSelect(next[0].id);
    setDialog(null);
    toast.success('Screen deleted');
  }

  async function move(screen: Screen, direction: -1 | 1) {
    const index = sorted.findIndex((s) => s.id === screen.id);
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;

    const next = [...sorted];
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = next.map((s, i) => ({ ...s, order_index: i }));

    setBusy(screen.id);
    const res = await fetch(`/api/projects/${projectId}/screens/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenIds: ordered.map((s) => s.id) }),
    });
    const data = await res.json();
    setBusy(null);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not reorder screens');
      return;
    }

    onScreensChange(data.screens);
  }

  return (
    <aside className="panel flex min-h-[680px] w-full flex-col rounded-panel p-3 lg:w-60">
      <div className="mb-3 flex items-center justify-between px-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Screens</p>
          <p className="mt-1 text-xs text-white/45">{sorted.length} screens</p>
        </div>
        <button
          onClick={openAdd}
          disabled={busy === 'add'}
          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 hover:border-studio-citron/50 hover:text-white disabled:opacity-50"
        >
          + Add
        </button>
      </div>

      <div className="space-y-2 overflow-y-auto">
        {sorted.map((screen, index) => (
          <div
            key={screen.id}
            className={`group rounded-xl border p-2 transition ${
              screen.id === activeScreenId
                ? 'border-studio-citron/60 bg-studio-citron/10'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <button onClick={() => onSelect(screen.id)} className="block w-full text-left">
              <div className="aspect-video overflow-hidden rounded-lg bg-white">
                {screen.thumbnail ? (
                  <img src={screen.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-end bg-gradient-to-br from-studio-citron/20 via-white to-studio-coral/10 p-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-black/45">
                      {screen.name}
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-xs font-medium text-white/80">{screen.name}</p>
            </button>

            <div className="mt-2 flex items-center gap-1 opacity-70 transition group-hover:opacity-100">
              <button
                title="Move up"
                onClick={() => move(screen, -1)}
                disabled={index === 0 || busy === screen.id}
                className="rounded px-1.5 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-20"
              >
                ↑
              </button>
              <button
                title="Move down"
                onClick={() => move(screen, 1)}
                disabled={index === sorted.length - 1 || busy === screen.id}
                className="rounded px-1.5 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-20"
              >
                ↓
              </button>
              <button
                title="Rename"
                onClick={() => openRename(screen)}
                className="rounded px-1.5 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white"
              >
                Rename
              </button>
              <button
                title="Duplicate"
                onClick={() => duplicateScreen(screen)}
                className="rounded px-1.5 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white"
              >
                Copy
              </button>
              <button
                title="Delete"
                onClick={() => setDialog({ type: 'delete', screen })}
                className="ml-auto rounded px-1.5 py-1 text-[10px] text-studio-coral/70 hover:bg-studio-coral/10 hover:text-studio-coral"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={dialog?.type === 'add'} onClose={() => setDialog(null)} title="Add a screen" size="sm">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Input label="Screen name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus required maxLength={120} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="submit" disabled={busy === 'add'}>{busy === 'add' ? 'Adding…' : 'Add screen'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog?.type === 'rename'} onClose={() => setDialog(null)} title="Rename screen" size="sm">
        <form onSubmit={handleRenameSubmit} className="space-y-4">
          <Input label="Screen name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus required maxLength={120} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
            <Button type="submit" disabled={!!busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={dialog?.type === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this screen?"
        description={dialog?.type === 'delete' ? `"${dialog.screen.name}" and its version history will be permanently deleted. This can't be undone.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={!!busy}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={!!busy}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
          </>
        }
      />
    </aside>
  );
}
