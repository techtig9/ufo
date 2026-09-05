import type { Plan } from './types';

/**
 * Project asset rules — file types, sizes and storage quotas.
 *
 * Pure module with no imports beyond a type, so it is unit-tested directly and
 * can be used on both sides. It is NOT the only line of defence: the bucket
 * created in migration 012 carries the same size cap and MIME allow-list,
 * because the browser uploads straight to Storage through a signed URL and a
 * modified client would never run this code.
 */

export const ASSET_BUCKET = 'project-assets';

/** Per-file cap. Mirrored on the bucket as `file_size_limit`. */
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

/**
 * Allowed types, mapped to the extension the stored object gets.
 *
 * Deliberately narrow and allow-listed, not deny-listed. SVG is included
 * because logos are a stated use case, and it is the reason the bucket is
 * private and served through signed URLs: an SVG is a document that can carry
 * script, so serving one from a public bucket on the app's own origin would be
 * stored XSS. See `isScriptableType`.
 */
export const ALLOWED_ASSET_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

/** Types a browser may execute or navigate as a document rather than render inertly. */
export function isScriptableType(mimeType: string): boolean {
  return mimeType === 'image/svg+xml' || mimeType === 'application/pdf';
}

/**
 * Total storage per account. The Pro and Business figures are the ones already
 * printed on the pricing page — this is what makes that copy true rather than a
 * claim about a feature that did not exist.
 */
export const PLAN_STORAGE_BYTES: Record<Plan, number> = {
  free: 100 * 1024 * 1024, // 100 MB
  starter: 1024 * 1024 * 1024, // 1 GB
  pro: 10 * 1024 * 1024 * 1024, // 10 GB
  business: 50 * 1024 * 1024 * 1024, // 50 GB
};

export interface AssetValidationError {
  field: 'name' | 'mimeType' | 'size' | 'quota';
  message: string;
}

/** Human-readable size, for quota messages and the asset list. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * A display name safe to store and show.
 *
 * This is only ever a LABEL — the object key is built from ids, never from the
 * user's filename — so path separators and traversal sequences are stripped
 * rather than rejected: they cannot reach the filesystem, but a name reading
 * `../../etc/passwd` in the UI is misleading.
 */
export function sanitizeAssetName(raw: string): string {
  const cleaned = raw
    .replace(/[/\\]/g, '-')
    .replace(/\.{2,}/g, '.')
    // Control characters, as a char-code scan so none appear in this source.
    .split('')
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join('')
    .trim()
    .slice(0, 120);
  return cleaned || 'untitled';
}

/** The object key for an asset. Built from ids only — never from user input. */
export function assetStoragePath(projectId: string, assetId: string, mimeType: string): string {
  const extension = ALLOWED_ASSET_TYPES[mimeType] ?? 'bin';
  return `${projectId}/${assetId}.${extension}`;
}

/** Validate an upload request. Returns null when it is acceptable. */
export function validateAssetUpload(input: {
  name: string;
  mimeType: string;
  size: number;
  plan: Plan;
  usedBytes: number;
}): AssetValidationError | null {
  if (!input.name.trim()) {
    return { field: 'name', message: 'The file needs a name.' };
  }

  if (!ALLOWED_ASSET_TYPES[input.mimeType]) {
    return {
      field: 'mimeType',
      message: `${input.mimeType || 'That file type'} is not supported. Upload a PNG, JPEG, GIF, WebP, SVG or PDF.`,
    };
  }

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { field: 'size', message: 'That file appears to be empty.' };
  }

  if (input.size > MAX_ASSET_BYTES) {
    return {
      field: 'size',
      message: `Files are limited to ${formatBytes(MAX_ASSET_BYTES)}. That one is ${formatBytes(input.size)}.`,
    };
  }

  const limit = PLAN_STORAGE_BYTES[input.plan] ?? PLAN_STORAGE_BYTES.free;
  if (input.usedBytes + input.size > limit) {
    return {
      field: 'quota',
      message: `That would exceed your ${formatBytes(limit)} of storage — ${formatBytes(
        Math.max(0, limit - input.usedBytes)
      )} free. Delete some assets or upgrade your plan.`,
    };
  }

  return null;
}
