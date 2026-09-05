'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Panel } from '@/components/ui/panel';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ProjectCardProject {
  id: string;
  name: string;
  project_type: string;
  created_at: string;
  is_favorite?: boolean | null;
  tags?: string[] | null;
  archived_at?: string | null;
}

export function ProjectCard({ project }: { project: ProjectCardProject }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Could not update the project');
    return data;
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || newName === project.name) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    try {
      await patch({ name: newName.trim() });
      toast.success('Project renamed');
      setRenaming(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleFavorite() {
    try {
      await patch({ isFavorite: !project.is_favorite });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update favorite');
    }
  }

  async function handleToggleArchive() {
    try {
      await patch({ archived: !project.archived_at });
      toast.success(project.archived_at ? 'Project restored' : 'Project archived');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the project');
    }
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not duplicate the project');
      toast.success('Project duplicated');
      router.push(`/dashboard/projects/${data.projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Duplicate failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not delete the project');
      toast.success('Project deleted');
      setDeleting(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  }

  const menuItems: DropdownItem[] = [
    { id: 'rename', label: 'Rename', onSelect: () => { setNewName(project.name); setRenaming(true); } },
    { id: 'duplicate', label: 'Duplicate', onSelect: handleDuplicate },
    { id: 'favorite', label: project.is_favorite ? 'Remove from favorites' : 'Add to favorites', onSelect: handleToggleFavorite },
    { id: 'archive', label: project.archived_at ? 'Restore' : 'Archive', onSelect: handleToggleArchive },
    { id: 'delete', label: 'Delete', destructive: true, onSelect: () => setDeleting(true) },
  ];

  return (
    <>
      <div className="group relative">
        <Link href={`/dashboard/projects/${project.id}`} className="block">
          <Panel className="h-full overflow-hidden border-edge bg-[#111218] p-0 transition duration-300 group-hover:-translate-y-1 group-hover:border-violet-400/20 group-hover:shadow-[0_24px_60px_rgba(0,0,0,.28)]">
            <div className="relative aspect-[16/9] overflow-hidden border-b border-edge bg-gradient-to-br from-violet-500/20 via-[#171923] to-studio-citron/10 p-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(139,92,246,.28),transparent_35%)]" />
              <div className="relative h-full rounded-lg border border-edge bg-surface-subtle p-3 shadow-2xl">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-surface-strong" />
                  <span className="h-1.5 w-1.5 rounded-full bg-surface-strong" />
                  <span className="h-1.5 w-1.5 rounded-full bg-surface-strong" />
                </div>
                <div className="mt-4 h-2 w-1/2 rounded-full bg-surface-strong" />
                <div className="mt-2 h-1.5 w-3/4 rounded-full bg-surface-raised" />
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <span className="h-14 rounded-md bg-violet-400/10" />
                  <span className="h-14 rounded-md bg-surface-subtle" />
                  <span className="h-14 rounded-md bg-studio-citron/10" />
                </div>
              </div>
              <span className="absolute bottom-5 left-5 rounded-full border border-edge bg-black/60 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-wider text-white/85 backdrop-blur">
                {project.project_type}
              </span>
              {project.archived_at && (
                <span className="absolute bottom-5 right-5 rounded-full border border-edge bg-black/60 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-wider text-white/75 backdrop-blur">
                  Archived
                </span>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg-secondary">{project.name}</p>
                  <p className="mt-1 text-[10px] text-fg-faint">Updated {new Date(project.created_at).toLocaleDateString()}</p>
                </div>
                {project.is_favorite && <span className="text-brand-text">★</span>}
              </div>
              {!!project.tags?.length && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-surface-subtle px-2 py-1 text-[8px] text-fg-faint">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </Link>

        <div className="absolute right-3 top-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Dropdown
            trigger={
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-edge bg-black/60 text-white/80 backdrop-blur hover:text-white">
                ⋯
              </span>
            }
            triggerLabel="Project actions"
            items={menuItems}
          />
        </div>
      </div>

      <Modal open={renaming} onClose={() => setRenaming(false)} title="Rename project" size="sm">
        <form onSubmit={handleRename} className="space-y-4">
          <Input
            label="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
            maxLength={120}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this project?"
        description={`"${project.name}" and all of its screens, versions, and share links will be permanently deleted. This can't be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
          </>
        }
      />
    </>
  );
}
