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
}: {
  device: DeviceMode;
  onDeviceChange: (device: DeviceMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
      <div className="flex items-center gap-1">
        <button onClick={onUndo} disabled={!canUndo} className="rounded-lg px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25">
          ↶ Undo
        </button>
        <button onClick={onRedo} disabled={!canRedo} className="rounded-lg px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25">
          ↷ Redo
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
        {(['mobile', 'tablet', 'desktop'] as DeviceMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onDeviceChange(mode)}
            className={`rounded-md px-2.5 py-1 text-[11px] capitalize ${
              device === mode ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
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
          className="rounded-lg px-2 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25"
        >
          −
        </button>
        <span className="w-10 text-center text-[11px] text-white/50">{device === 'desktop' ? '—' : `${Math.round(zoom * 100)}%`}</span>
        <button
          onClick={() => onZoomChange(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, ZOOM_STEPS.indexOf(zoom) + 1)])}
          disabled={device === 'desktop' || zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
          aria-label="Zoom in"
          className="rounded-lg px-2 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25"
        >
          +
        </button>
      </div>
    </div>
  );
}
