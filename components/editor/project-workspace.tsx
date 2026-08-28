'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { PrototypeViewer } from '@/components/prototype-viewer/prototype-viewer';
import { DesignHandoffPanel } from '@/components/editor/design-handoff-panel';
import { ProjectToolbar } from '@/components/editor/project-toolbar';
import { ScreenPanel } from '@/components/editor/screen-panel';
import { CanvasToolbar } from '@/components/editor/canvas-toolbar';
import { AIDesignCopilot } from '@/components/editor/ai-design-copilot';
import { VersionHistoryPanel } from '@/components/editor/version-history-panel';
import { Skeleton } from '@/components/ui/skeleton';
import type { Project, Screen } from '@/lib/types';
import type { DeviceMode } from '@/components/prototype-viewer/device-frame';

// Monaco is one of the largest deps in this project — code-split so its JS only
// loads when someone actually opens the Code tab, not on every editor page visit.
const CodeEditorPanel = dynamic(
  () => import('@/components/editor/code-editor-panel').then((mod) => mod.CodeEditorPanel),
  { ssr: false, loading: () => <Skeleton className="h-[680px] w-full" /> }
);

type Tab = 'preview' | 'code' | 'handoff';

export function ProjectWorkspace({
  project,
  screens: initialScreens,
  shareSlug,
  isPublic,
  publishedAt,
}: {
  project: Project;
  screens: Screen[];
  shareSlug: string;
  isPublic: boolean;
  publishedAt: string | null;
}) {
  const [screens, setScreens] = useState(initialScreens);
  const [tab, setTab] = useState<Tab>('preview');
  const [activeScreenId, setActiveScreenId] = useState(initialScreens[0]?.id);
  const [device, setDevice] = useState<DeviceMode>('mobile');
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);

  const sorted = useMemo(
    () => [...screens].sort((a, b) => a.order_index - b.order_index),
    [screens]
  );

  const activeScreen = sorted.find((s) => s.id === activeScreenId) ?? sorted[0];

  function updateScreen(nextScreen: Screen, pushHistory = true) {
    if (pushHistory && activeScreen) {
      setPast((history) => [...history.slice(-19), activeScreen.code]);
      setFuture([]);
    }
    setScreens((current) => current.map((screen) => screen.id === nextScreen.id ? nextScreen : screen));
  }

  function undo() {
    if (!activeScreen || !past.length) return;
    const previous = past[past.length - 1];
    setPast((history) => history.slice(0, -1));
    setFuture((history) => [...history, activeScreen.code]);
    setScreens((current) => current.map((screen) =>
      screen.id === activeScreen.id ? { ...screen, code: previous } : screen
    ));
  }

  function redo() {
    if (!activeScreen || !future.length) return;
    const next = future[future.length - 1];
    setFuture((history) => history.slice(0, -1));
    setPast((history) => [...history, activeScreen.code]);
    setScreens((current) => current.map((screen) =>
      screen.id === activeScreen.id ? { ...screen, code: next } : screen
    ));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#101116]/80 p-4 shadow-[0_12px_40px_rgba(0,0,0,.18)] backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300">✦</span><div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-300">UFO Studio</p>
          <h1 className="font-display text-2xl font-semibold">{project.name}</h1>
          <p className="text-xs capitalize text-white/35">{project.project_type} · {sorted.length} screens</p></div></div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(['preview', 'code', 'handoff'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'rounded-lg px-4 py-2 text-xs capitalize transition',
                tab === t ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:bg-white/5 hover:text-white'
              )}
            >
              {t === 'handoff' ? 'Design Handoff' : t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_310px]">
        <ScreenPanel
          projectId={project.id}
          screens={sorted}
          activeScreenId={activeScreen?.id}
          onScreensChange={(next) => setScreens(next)}
          onSelect={setActiveScreenId}
        />

        <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#0b0c10] p-2 shadow-[0_24px_70px_rgba(0,0,0,.25)]">
          {tab === 'preview' && (
            <>
              <CanvasToolbar
                device={device}
                onDeviceChange={setDevice}
                onUndo={undo}
                onRedo={redo}
                canUndo={past.length > 0}
                canRedo={future.length > 0}
                zoom={zoom}
                onZoomChange={setZoom}
              />
              <PrototypeViewer screens={sorted} initialScreenId={activeScreen?.id} device={device} onDeviceChange={setDevice} zoom={zoom} />
            </>
          )}

          {tab === 'code' && activeScreen && (
            <CodeEditorPanel
              screen={activeScreen}
              onSaved={(screen) => updateScreen(screen, true)}
            />
          )}

          {tab === 'handoff' && <DesignHandoffPanel project={project} />}
        </div>

        <div className="space-y-4">
          <AIDesignCopilot
            project={project}
            screen={activeScreen}
            onApplied={(screen) => updateScreen(screen, true)}
          />
          <VersionHistoryPanel
            projectId={project.id}
            screen={activeScreen}
            onRestored={(screen) => {
              updateScreen(screen, true);
              setFuture([]);
            }}
          />
          <ProjectToolbar
            project={project}
            screens={sorted}
            shareSlug={shareSlug}
            isPublic={isPublic}
            publishedAt={publishedAt}
          />
        </div>
      </div>
    </div>
  );
}
