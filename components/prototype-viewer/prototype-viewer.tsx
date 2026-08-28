'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DeviceFrame, type DeviceMode } from './device-frame';
import type { Screen } from '@/lib/types';

function buildSrcDoc(bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com"><\/script>
<style>body{margin:0;}</style>
</head>
<body>
${bodyHtml}
<script>
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-hotspot]');
  if (el) {
    e.preventDefault();
    window.parent.postMessage({ type: 'ufo-hotspot', target: el.getAttribute('data-hotspot') }, '*');
  }
});
<\/script>
</body>
</html>`;
}

export function PrototypeViewer({
  screens,
  initialScreenId,
  device: controlledDevice,
  onDeviceChange,
  onScreenChange,
  zoom = 1,
  pinMode = false,
  onPin,
  pins,
  onPinClick,
}: {
  screens: Screen[];
  initialScreenId?: string;
  device?: DeviceMode;
  onDeviceChange?: (mode: DeviceMode) => void;
  onScreenChange?: (screenId: string) => void;
  /** Visual zoom for the device frame (mobile/tablet). Only meaningful when a parent passes it. */
  zoom?: number;
  /** When true, clicking the rendered frame captures a percentage-based x/y instead of interacting with the page. */
  pinMode?: boolean;
  onPin?: (screenId: string, x: number, y: number) => void;
  /** Existing pins for the active screen, rendered as markers. */
  pins?: { id: string; x: number; y: number; resolved?: boolean }[];
  onPinClick?: (commentId: string) => void;
}) {
  const sorted = useMemo(() => [...screens].sort((a, b) => a.order_index - b.order_index), [screens]);
  const [activeId, setActiveId] = useState(initialScreenId ?? sorted[0]?.id);
  const [internalDevice, setInternalDevice] = useState<DeviceMode>('mobile');
  const [presentation, setPresentation] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const device = controlledDevice ?? internalDevice;
  const setDevice = (mode: DeviceMode) => {
    setInternalDevice(mode);
    onDeviceChange?.(mode);
  };

  useEffect(() => {
    if (initialScreenId && sorted.some((s) => s.id === initialScreenId)) setActiveId(initialScreenId);
  }, [initialScreenId, sorted]);

  useEffect(() => {
    if (activeId) onScreenChange?.(activeId);
  }, [activeId, onScreenChange]);

  useEffect(() => {
    if (!sorted.some((s) => s.id === activeId)) setActiveId(sorted[0]?.id);
  }, [sorted, activeId]);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.source === window || e.data?.type !== 'ufo-hotspot') return;
      const target = sorted.find((s) => s.name.toLowerCase() === String(e.data.target).toLowerCase());
      if (target) setActiveId(target.id);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sorted]);

  if (!sorted.length) {
    return <p className="text-center text-white/40">No screens yet.</p>;
  }

  const active = sorted.find((s) => s.id === activeId) ?? sorted[0];

  function go(delta: number) {
    const index = sorted.findIndex((s) => s.id === active.id);
    const next = sorted[index + delta];
    if (next) setActiveId(next.id);
  }

  async function toggleFullscreen() {
    if (!frameRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await frameRef.current.requestFullscreen();
    }
  }

  return (
    <div ref={frameRef} className={`flex flex-col items-center gap-3 ${presentation ? 'bg-[#0b0b0b] p-6' : ''}`}>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
        <div className="flex min-w-0 gap-1 overflow-x-auto">
          {sorted.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                s.id === active.id ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)} disabled={!sorted[sorted.findIndex((s) => s.id === active.id) - 1]} className="rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10 disabled:opacity-20">←</button>
          <button onClick={() => go(1)} disabled={!sorted[sorted.findIndex((s) => s.id === active.id) + 1]} className="rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10 disabled:opacity-20">→</button>
          <button onClick={() => setPresentation((v) => !v)} className="rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10">
            {presentation ? 'Exit' : 'Present'}
          </button>
          <button onClick={toggleFullscreen} className="rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10">
            ⛶
          </button>
        </div>
      </div>

      <DeviceFrame mode={device} onModeChange={setDevice} zoom={zoom} showSwitcher={controlledDevice === undefined}>
        <div className="relative h-full w-full">
          <iframe
            title={active.name}
            srcDoc={buildSrcDoc(active.code)}
            sandbox="allow-scripts"
            className="h-full w-full border-0"
          />
          {pinMode && (
            <button
              type="button"
              aria-label="Click to place a comment pin"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
                const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
                onPin?.(active.id, x, y);
              }}
              className="absolute inset-0 cursor-crosshair bg-black/10"
            />
          )}
          {!pinMode && pins?.map((pin) => (
            <button
              key={pin.id}
              type="button"
              onClick={() => onPinClick?.(pin.id)}
              title="View this comment"
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[9px] font-bold !text-white shadow-lg ${pin.resolved ? 'bg-status-success' : 'bg-studio-coral'}`}
            >
              !
            </button>
          ))}
        </div>
      </DeviceFrame>
    </div>
  );
}
