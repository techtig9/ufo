'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { PrototypeViewer } from '@/components/prototype-viewer/prototype-viewer';
import { DesignHandoffPanel } from '@/components/editor/design-handoff-panel';
import { ProjectToolbar } from '@/components/editor/project-toolbar';
import { AssetLibrary } from '@/components/editor/asset-library';
import { VisualInspector } from '@/components/editor/visual-inspector';
import { PublishingPanel } from '@/components/editor/publishing-panel';
import { annotateForPreview, buildTree, parseScreen, type TreeNode } from '@/lib/inspector-dom';
import { ScreenPanel } from '@/components/editor/screen-panel';
import { CanvasToolbar } from '@/components/editor/canvas-toolbar';
import { AIDesignCopilot } from '@/components/editor/ai-design-copilot';
import { AIActionsPanel } from '@/components/editor/ai-actions-panel';
import { VersionHistoryPanel } from '@/components/editor/version-history-panel';
import toast from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Project, Screen } from '@/lib/types';
import type { DeviceMode } from '@/components/prototype-viewer/device-frame';
import type { ProjectShare } from '@/components/editor/project-toolbar';

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
  share,
}: {
  project: Project;
  screens: Screen[];
  share: ProjectShare;
}) {
  const [screens, setScreens] = useState(initialScreens);
  const [tab, setTab] = useState<Tab>('preview');
  const [activeScreenId, setActiveScreenId] = useState(initialScreens[0]?.id);
  const [device, setDevice] = useState<DeviceMode>('mobile');
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [inspecting, setInspecting] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [savingStyles, setSavingStyles] = useState(false);

  const sorted = useMemo(
    () => [...screens].sort((a, b) => a.order_index - b.order_index),
    [screens]
  );

  const activeScreen = sorted.find((s) => s.id === activeScreenId) ?? sorted[0];

  // The layer tree and the path-annotated markup are both derived from the
  // active screen's code, and only while the inspector is open — parsing on
  // every render of a screen nobody is inspecting would be wasted work.
  const { tree, annotatedHtml } = useMemo<{ tree: TreeNode[]; annotatedHtml: string }>(() => {
    if (!inspecting || !activeScreen) return { tree: [], annotatedHtml: '' };
    const root = parseScreen(activeScreen.code);
    return { tree: buildTree(root), annotatedHtml: annotateForPreview(root) };
  }, [inspecting, activeScreen]);

  /**
   * Apply an inspector edit: update locally so the preview reflects it at once,
   * then persist. A failed save is rolled back rather than left as a change the
   * user can see but that is not stored.
   */
  async function applyStyleEdit(nextCode: string) {
    if (!activeScreen) return;
    const previousCode = activeScreen.code;
    updateScreen({ ...activeScreen, code: nextCode }, true);
    setSavingStyles(true);
    try {
      const res = await fetch(`/api/screens/${activeScreen.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: nextCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        updateScreen({ ...activeScreen, code: previousCode }, false);
        setPast((history) => history.slice(0, -1));
        toast.error(data?.error ?? 'Could not save that style change');
      }
    } catch {
      updateScreen({ ...activeScreen, code: previousCode }, false);
      setPast((history) => history.slice(0, -1));
      toast.error('Could not reach the server — the change was not saved');
    } finally {
      setSavingStyles(false);
    }
  }

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

  /**
   * Editor keyboard shortcuts (spec: "Keyboard shortcuts: Cmd/Ctrl+Z,
   * Cmd/Ctrl+Shift+Z, Escape").
   *
   * Deliberately inert while focus is in a text field or the Monaco editor —
   * Cmd+Z there must undo the user's typing, not the screen history. Cmd+K is
   * left alone so the command palette keeps it.
   */
  function redo() {
    if (!activeScreen || !future.length) return;
    const next = future[future.length - 1];
    setFuture((history) => history.slice(0, -1));
    setPast((history) => [...history, activeScreen.code]);
    setScreens((current) => current.map((screen) =>
      screen.id === activeScreen.id ? { ...screen, code: next } : screen
    ));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          // Monaco renders its own editable surface.
          !!target.closest('.monaco-editor'));
      if (typing) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === 'Escape') {
        // Leaves presentation/zoom state and returns to a neutral view.
        setZoom(1);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-edge bg-surface/80 p-4 shadow-[0_12px_40px_rgba(0,0,0,.18)] backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-accent-alt-text">✦</span><div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-accent-alt-text">UFO Studio</p>
          <h1 className="font-display text-2xl font-semibold">{project.name}</h1>
          <p className="text-xs capitalize text-fg-faint">{project.project_type} · {sorted.length} screens</p></div></div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-edge bg-surface-subtle p-1">
          {(['preview', 'code', 'handoff'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'rounded-lg px-4 py-2 text-xs capitalize transition',
                tab === t ? 'bg-surface-raised text-fg shadow-sm' : 'text-fg-faint hover:bg-surface-subtle hover:text-fg'
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

        <div className="min-w-0 rounded-2xl border border-edge bg-canvas p-2 shadow-[0_24px_70px_rgba(0,0,0,.25)]">
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
                inspecting={inspecting}
                onToggleInspect={() => {
                  // Leaving inspect mode drops the selection: a highlighted
                  // element the user can no longer see or edit is confusing.
                  setInspecting((on) => !on);
                  setSelectedPaths([]);
                }}
              />
              <PrototypeViewer
                screens={sorted}
                initialScreenId={activeScreen?.id}
                device={device}
                onDeviceChange={setDevice}
                zoom={zoom}
                inspect={inspecting}
                inspectHtml={annotatedHtml}
                selectedPaths={selectedPaths}
                onInspectSelect={(path, additive) =>
                  setSelectedPaths((current) => {
                    if (!additive) return [path];
                    return current.includes(path)
                      ? current.filter((p) => p !== path)
                      : [...current, path];
                  })
                }
              />
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
          <AIActionsPanel
            project={project}
            screen={activeScreen}
            onApplied={(screen) => updateScreen(screen, true)}
            onScreenCreated={(screen) => {
              setScreens((current) => [...current, screen]);
              setActiveScreenId(screen.id);
            }}
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
            share={share}
          />
          {inspecting && activeScreen && (
            <VisualInspector
              code={activeScreen.code}
              tree={tree}
              selected={selectedPaths}
              onSelectedChange={setSelectedPaths}
              onChange={applyStyleEdit}
              disabled={savingStyles}
            />
          )}
          <PublishingPanel
            projectId={project.id}
            share={{
              is_public: share.isPublic,
              expires_at: share.expiresAt,
              hasPassword: share.hasPassword,
              published_at: share.publishedAt,
            }}
          />
          <AssetLibrary projectId={project.id} />
        </div>
      </div>
    </div>
  );
}
