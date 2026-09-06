'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Tooltip } from '@/components/ui/tooltip';
import { ShareSettings, formatExpiry } from '@/components/editor/share-settings';
import { exportProjectZip } from '@/lib/export';
import type { Plan, Project, Screen } from '@/lib/types';

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** The share row as the editor needs it — never carrying the password hash. */
export interface ProjectShare {
  slug: string;
  isPublic: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  hasPassword: boolean;
  allowComments: boolean;
}

export function ProjectToolbar({
  project,
  screens,
  share,
}: {
  project: Project;
  screens: Screen[];
  share: ProjectShare;
}) {
  const router = useRouter();
  const shareSlug = share.slug;
  const [isPublic, setIsPublic] = useState(share.isPublic);
  const [publishedAt, setPublishedAt] = useState(share.publishedAt);
  const [permissions, setPermissions] = useState({
    expiresAt: share.expiresAt,
    hasPassword: share.hasPassword,
    allowComments: share.allowComments,
  });
  const [qr, setQr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [plan, setPlan] = useState<Plan>('free');
  const [role, setRole] = useState<'user' | 'admin'>('user');

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/proto/${shareSlug}` : '';
  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/plan')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setPlan(data.plan ?? 'free');
          setRole(data.role ?? 'user');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isPublic) QRCode.toDataURL(shareUrl, { margin: 1 }).then(setQr);
    // shareUrl only resolves client-side after mount — re-run once it's available.
  }, [isPublic, shareUrl]);

  async function handlePublish() {
    const res = await fetch('/api/shares/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, isPublic: !isPublic }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error('Could not update the share link');
      return;
    }
    setIsPublic(data.is_public);
    setPublishedAt(data.published_at ?? publishedAt);
    setPermissions({
      expiresAt: data.expires_at ?? null,
      hasPassword: !!data.hasPassword,
      allowComments: data.allow_comments ?? true,
    });
    if (data.is_public && formatExpiry(data.expires_at ?? null) === 'Expired') {
      // Publishing does not clear a past expiry, so the link would be dead on
      // arrival. Say so rather than handing over a link that 404s.
      toast('Published, but the link is past its expiry date — update it in Link settings.', {
        icon: '⚠️',
      });
    } else {
      toast.success(data.is_public ? 'Prototype published' : 'Prototype unpublished');
    }
    router.refresh();
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied');
  }

  async function handleExportZip() {
    setExporting(true);
    try {
      await exportProjectZip(project, screens);
    } catch {
      toast.error('Export failed — please try again');
    }
    setExporting(false);
  }

  async function handleDuplicate() {
    const res = await fetch(`/api/projects/${project.id}/duplicate`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Could not duplicate the project');
      return;
    }
    toast.success('Project duplicated');
    router.push(`/dashboard/projects/${data.projectId}`);
  }

  return (
    <Panel hover={false} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {role === 'admin' || plan !== 'free' ? (
          <Tooltip content="Downloads each screen as HTML, a PNG snapshot, and a style-guide.md — a real code export, not a preview.">
            <Button size="sm" variant="secondary" onClick={handleExportZip} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export ZIP'}
            </Button>
          </Tooltip>
        ) : (
          <Button size="sm" variant="secondary" disabled title="Upgrade to Starter to export code">
            Export ZIP — Starter+
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled
          title="Figma export is not built. The button is disabled rather than failing when clicked."
        >
          Figma export — not available
        </Button>
        <Button size="sm" variant="secondary" onClick={handleDuplicate}>
          Duplicate
        </Button>
      </div>

      <div className="border-t border-edge pt-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-fg-muted">Shareable prototype link</span>
            {isPublic && publishedAt && (
              <p className="text-[10px] text-fg-faint">Last published {timeAgo(publishedAt)}</p>
            )}
          </div>
          <Button size="sm" onClick={handlePublish}>
            {isPublic ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
        {isPublic && (
          <div className="mt-3 flex items-center gap-3">
            {qr && (
              <>
                {/* A data: URI generated in the browser by the qrcode library.
                    next/image cannot optimise a data URI — it would have to be
                    passed through unoptimized, which is exactly what this is.
                    Fixed 64px, so there is no layout shift and nothing to size. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={`QR code linking to ${shareUrl}`} className="h-16 w-16 rounded bg-white p-1" />
              </>
            )}
            <div className="min-w-0 flex-1">
              <code className="block truncate rounded bg-surface-subtle px-2 py-1 text-xs text-fg-muted">{shareUrl}</code>
              <button onClick={copyLink} className="mt-1.5 text-[10px] text-brand-text hover:underline">
                Copy link
              </button>
            </div>
          </div>
        )}
        {isPublic && (
          <div className="mt-3 border-t border-edge pt-3">
            <ShareSettings projectId={project.id} value={permissions} onChange={setPermissions} />
          </div>
        )}
      </div>
    </Panel>
  );
}
