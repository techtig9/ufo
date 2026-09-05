'use client';

import type { DeviceMode } from '@/components/prototype-viewer/device-frame';

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25];

export function CanvasToolbar({
  device,
  onDeviceChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  inspecting,
  onToggleInspect,
}: {
  device: DeviceMode;
  onDeviceChange: (device: DeviceMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  inspecting: boolean;
  onToggleInspect: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-surface-subtle p-2">
      <div className="flex items-center gap-1">
        <button onClick={onUndo} disabled={!canUndo} className="rounded-lg px-2.5 py-1.5 text-xs text-fg-muted hover:bg-surface-raised hover:text-fg disabled:opacity-25">
          ↶ Undo
        </button>
        <button onClick={onRedo} disabled={!canRedo} className="rounded-lg px-2.5 py-1.5 text-xs text-fg-muted hover:bg-surface-raised hover:text-fg disabled:opacity-25">
          ↷ Redo
        </button>
        <button
          onClick={onToggleInspect}
          aria-pressed={inspecting}
          title="Select elements in the preview and edit their styles"
          className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-micro ${
            inspecting
              ? 'bg-studio-citron/15 text-brand-text'
              : 'text-fg-muted hover:bg-surface-raised hover:text-fg'
          }`}
        >
          ⌗ Inspect
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-surface-subtle p-1">
        {(['mobile', 'tablet', 'desktop'] as DeviceMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onDeviceChange(mode)}
            className={`rounded-md px-2.5 py-1 text-[11px] capitalize ${
              device === mode ? 'bg-surface-strong text-fg' : 'text-fg-faint hover:text-fg'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1" title={device === 'desktop' ? 'Zoom applies to mobile/tablet frames' : undefined}>
        <button
          onClick={() => onZoomChange(ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(zoom) - 1)])}
          disabled={device === 'desktop' || zoom <= ZOOM_STEPS[0]}
          aria-label="Zoom out"
          className="rounded-lg px-2 py-1.5 text-xs text-fg-muted hover:bg-surface-raised hover:text-fg disabled:opacity-25"
        >
          −
        </button>
        <span className="w-10 text-center text-[11px] text-fg-muted">{device === 'desktop' ? '—' : `${Math.round(zoom * 100)}%`}</span>
        <button
          onClick={() => onZoomChange(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, ZOOM_STEPS.indexOf(zoom) + 1)])}
          disabled={device === 'desktop' || zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
          aria-label="Zoom in"
          className="rounded-lg px-2 py-1.5 text-xs text-fg-muted hover:bg-surface-raised hover:text-fg disabled:opacity-25"
        >
          +
        </button>
      </div>
    </div>
  );
}
