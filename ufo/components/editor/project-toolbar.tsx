'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { exportProjectZip } from '@/lib/export';
import type { Project, Screen } from '@/lib/types';

export function ProjectToolbar({
  project,
  screens,
  shareSlug,
  isPublic: initialPublic,
}: {
  project: Project;
  screens: Screen[];
  shareSlug: string;
  isPublic: boolean;
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [qr, setQr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [figmaStatus, setFigmaStatus] = useState(project.figma_export_status);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/proto/${shareSlug}` : '';

  async function handlePublish() {
    const res = await fetch('/api/shares/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, isPublic: !isPublic }),
    });
    if (!res.ok) {
      toast.error('Could not update the share link');
      return;
    }
    const next = !isPublic;
    setIsPublic(next);
    if (next) {
      const dataUrl = await QRCode.toDataURL(shareUrl, { margin: 1 });
      setQr(dataUrl);
      toast.success('Prototype published');
    } else {
      setQr(null);
      toast.success('Prototype unpublished');
    }
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

  async function handleExportFigma() {
    const res = await fetch('/api/export/figma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Could not queue the Figma export');
      return;
    }
    setFigmaStatus('queued');
    toast.success('Figma export queued \u2014 full sync ships in Phase 2');
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
        <Button size="sm" variant="secondary" onClick={handleExportZip} disabled={exporting}>
          {exporting ? 'Exporting\u2026' : 'Export ZIP'}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleExportFigma} disabled={figmaStatus === 'queued'}>
          {figmaStatus === 'queued' ? 'Figma export queued' : 'Export to Figma'}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleDuplicate}>
          Duplicate
        </Button>
      </div>

      <div className="border-t border-white/10 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">Shareable prototype link</span>
          <Button size="sm" onClick={handlePublish}>
            {isPublic ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
        {isPublic && (
          <div className="mt-3 flex items-center gap-3">
            {qr && <img src={qr} alt="QR code" className="h-16 w-16 rounded bg-white p-1" />}
            <code className="truncate rounded bg-white/5 px-2 py-1 text-xs text-white/60">{shareUrl}</code>
          </div>
        )}
      </div>
    </Panel>
  );
}
