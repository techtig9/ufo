'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ASSET_BUCKET, formatBytes, isScriptableType } from '@/lib/assets';

/**
 * Project assets — upload, preview, rename, delete, with the plan quota shown.
 *
 * Uploads go to Supabase Storage directly using a signed token the server
 * issues, so a 25 MB file never passes through a serverless function. The
 * sequence is: reserve (server validates + counts quota) → PUT the bytes →
 * confirm (server verifies the object landed).
 */

interface Asset {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface Quota {
  plan: string;
  usedBytes: number;
  limitBytes: number;
}

export function AssetLibrary({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState<Asset | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/assets`);
      if (!res.ok) return;
      const data = await res.json();
      setAssets(data.assets ?? []);
      setQuota(data.quota ?? null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Thumbnails need a signed URL each, fetched lazily for image types only —
  // a PDF has nothing to show inline.
  useEffect(() => {
    let cancelled = false;
    const missing = assets.filter(
      (a) => !previewUrls[a.id] && a.mime_type.startsWith('image/') && !isScriptableType(a.mime_type)
    );
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (asset) => {
        const res = await fetch(`/api/assets/${asset.id}`);
        if (!res.ok) return null;
        const data = await res.json();
        return [asset.id, data.url] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const entry of results) if (entry) next[entry[0]] = entry[1];
      if (Object.keys(next).length) setPreviewUrls((current) => ({ ...current, ...next }));
    });

    return () => {
      cancelled = true;
    };
  }, [assets, previewUrls]);

  async function upload(file: File) {
    setUploading(true);
    try {
      // 1. Reserve: the server validates type, size and quota, and writes a
      //    pending row so a concurrent upload cannot claim the same space.
      const reserve = await fetch(`/api/projects/${projectId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size }),
      });
      const reserved = await reserve.json();
      if (!reserve.ok) {
        toast.error(reserved.error ?? 'Could not start the upload');
        return;
      }

      // 2. The bytes go straight to Storage with the signed token.
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(reserved.upload.bucket ?? ASSET_BUCKET)
        .uploadToSignedUrl(reserved.upload.path, reserved.upload.token, file);

      if (error) {
        // Clean up the reservation so the failed attempt does not hold quota.
        await fetch(`/api/assets/${reserved.asset.id}`, { method: 'DELETE' });
        toast.error('The upload did not complete. Please try again.');
        return;
      }

      // 3. Confirm — the server checks the object is really there before the
      //    asset joins the library.
      const confirm = await fetch(`/api/assets/${reserved.asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      if (!confirm.ok) {
        toast.error('The upload finished but could not be saved. Please try again.');
        return;
      }

      toast.success(`${file.name} uploaded`);
      await load();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function rename() {
    if (!renaming || !renameValue.trim()) return;
    const res = await fetch(`/api/assets/${renaming.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Could not rename this file');
      return;
    }
    setAssets((current) =>
      current.map((a) => (a.id === renaming.id ? { ...a, name: data.asset?.name ?? renameValue } : a))
    );
    setRenaming(null);
    toast.success('Renamed');
  }

  async function remove(asset: Asset) {
    const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? 'Could not delete this file');
      return;
    }
    setConfirmDelete(null);
    toast.success('Deleted');
    await load();
  }

  const percentUsed = quota && quota.limitBytes > 0
    ? Math.min(100, Math.round((quota.usedBytes / quota.limitBytes) * 100))
    : 0;

  return (
    <Panel hover={false} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Assets</h3>
          <p className="text-xs text-fg-faint">
            Logos, screenshots and reference designs for this project.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          loading={uploading}
          loadingLabel="Uploading…"
          onClick={() => fileRef.current?.click()}
        >
          Upload file
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </div>

      {quota && (
        <div>
          <div className="flex justify-between text-[10px] text-fg-faint">
            <span>
              {formatBytes(quota.usedBytes)} of {formatBytes(quota.limitBytes)} used
            </span>
            <span>{quota.plan} plan</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percentUsed}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Storage used"
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-subtle"
          >
            <div
              className={`h-full transition-[width] duration-standard ${
                percentUsed > 90 ? 'bg-status-error' : 'bg-studio-citron'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          title="No assets yet"
          description="Upload a logo, screenshot or reference design to keep it with this project."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {assets.map((asset) => (
            <li key={asset.id} className="rounded-lg border border-edge bg-surface-subtle p-2">
              <div className="grid h-20 place-items-center overflow-hidden rounded bg-surface">
                {previewUrls[asset.id] ? (
                  /* A signed Storage URL is short-lived and its host varies by
                     project, so it cannot be declared as a next/image remote
                     pattern. These are small thumbnails in an authenticated
                     panel, not LCP content. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewUrls[asset.id]}
                    alt={asset.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span aria-hidden="true" className="text-lg text-fg-faint">
                    {asset.mime_type === 'application/pdf' ? '▤' : '◫'}
                  </span>
                )}
              </div>
              <p className="mt-1.5 truncate text-xs text-fg" title={asset.name}>
                {asset.name}
              </p>
              <p className="text-[10px] text-fg-faint">{formatBytes(asset.size_bytes)}</p>
              <div className="mt-1 flex gap-2 text-[10px]">
                <button
                  onClick={() => {
                    setRenaming(asset);
                    setRenameValue(asset.name);
                  }}
                  className="text-fg-faint hover:text-fg"
                >
                  Rename
                </button>
                <button
                  onClick={() => setConfirmDelete(asset)}
                  className="text-status-error/70 hover:text-status-error"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        size="sm"
        title="Rename file"
        description="This changes the label only — the file itself is untouched."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={rename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </div>
        }
      >
        <Input
          label="Name"
          value={renameValue}
          autoFocus
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') rename();
          }}
        />
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        closeOnBackdrop={false}
        size="sm"
        title={`Delete ${confirmDelete?.name}?`}
        description="The file is removed permanently and its space is freed. Anywhere it is referenced will stop showing it."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>
              Delete file
            </Button>
          </div>
        }
      />
    </Panel>
  );
}
