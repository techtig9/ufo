'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DeviceFrame, type DeviceMode } from './device-frame';
import { parsePath } from '@/lib/inspector';
import type { Screen } from '@/lib/types';

/**
 * Click-to-select support for the editor's visual inspector.
 *
 * Injected only when `inspect` is on, so the public prototype view never
 * carries it — a share-link visitor has no inspector and should not have their
 * clicks intercepted.
 *
 * The frame is sandboxed without allow-same-origin, so the parent cannot reach
 * into its DOM at all: the element path has to be computed in here and sent
 * out by postMessage. `data-ufo-path` is written by the parent before the HTML
 * is handed over, so this script only reads it.
 */
const INSPECT_AGENT = `
<style>
  [data-ufo-selected] { outline: 2px solid #D4FF4F !important; outline-offset: 1px; }
  [data-ufo-hover]    { outline: 1px dashed rgba(212,255,79,.7) !important; outline-offset: 1px; }
</style>
<script>
(function () {
  function pathOf(el) {
    var node = el;
    while (node && !node.hasAttribute('data-ufo-path')) node = node.parentElement;
    return node ? node.getAttribute('data-ufo-path') : null;
  }

  document.addEventListener('mouseover', function (e) {
    var previous = document.querySelector('[data-ufo-hover]');
    if (previous) previous.removeAttribute('data-ufo-hover');
    var node = e.target;
    while (node && !node.hasAttribute('data-ufo-path')) node = node.parentElement;
    if (node) node.setAttribute('data-ufo-hover', '');
  });

  document.addEventListener('click', function (e) {
    var path = pathOf(e.target);
    if (path === null) return;
    /* Selecting must not follow a link or submit a form out of the frame. */
    e.preventDefault();
    e.stopPropagation();
    /* targetOrigin '*' is unavoidable here for the same reason as the hotspot
       message below: this frame's origin is "null". The payload is only a
       path, and the parent validates both the origin and the path's shape. */
    window.parent.postMessage(
      { type: 'ufo-inspect-select', path: path, additive: e.shiftKey || e.metaKey || e.ctrlKey },
      '*'
    );
  }, true);

  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || data.type !== 'ufo-inspect-highlight') return;
    document.querySelectorAll('[data-ufo-selected]').forEach(function (el) {
      el.removeAttribute('data-ufo-selected');
    });
    (data.paths || []).forEach(function (path) {
      var el = document.querySelector('[data-ufo-path="' + String(path).replace(/["\\]/g, '') + '"]');
      if (el) el.setAttribute('data-ufo-selected', '');
    });
  });
})();
<\/script>`;

function buildSrcDoc(bodyHtml: string, inspect = false): string {
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
${inspect ? INSPECT_AGENT : ''}
<script>
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-hotspot]');
  if (el) {
    e.preventDefault();
    /* targetOrigin '*' is unavoidable: this frame is sandboxed without
       allow-same-origin, so its origin is "null" and it cannot name the
       parent's. The payload is only a screen name, and the parent validates
       the sender's origin before acting on it. */
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
  inspect = false,
  inspectHtml,
  selectedPaths,
  onInspectSelect,
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
  /** Editor-only: inject the click-to-select agent. Never set on a public share. */
  inspect?: boolean;
  /** The active screen's HTML with data-ufo-path attributes, when inspecting. */
  inspectHtml?: string;
  selectedPaths?: string[];
  onInspectSelect?: (path: string, additive: boolean) => void;
}) {
  const sorted = useMemo(() => [...screens].sort((a, b) => a.order_index - b.order_index), [screens]);
  const [activeId, setActiveId] = useState(initialScreenId ?? sorted[0]?.id);
  const [internalDevice, setInternalDevice] = useState<DeviceMode>('mobile');
  const [presentation, setPresentation] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
      // The prototype iframe is sandboxed WITHOUT allow-same-origin, so its
      // messages arrive with origin "null". Accepting only that (plus this
      // page's own origin) means a message from any other embedded frame or
      // opener is ignored, rather than being able to drive navigation here.
      if (e.origin !== 'null' && e.origin !== window.location.origin) return;
      if (e.source === window) return;

      const data = e.data as { type?: unknown; target?: unknown; path?: unknown; additive?: unknown } | null;
      if (!data) return;

      // Element selected inside the preview. The path is untrusted input from a
      // sandboxed frame, so its shape is validated before it is acted on.
      if (data.type === 'ufo-inspect-select') {
        if (typeof data.path !== 'string' || parsePath(data.path) === null) return;
        onInspectSelect?.(data.path, data.additive === true);
        return;
      }

      if (data.type !== 'ufo-hotspot') return;
      if (typeof data.target !== 'string') return;

      // The target is matched against this project's own screen names, so an
      // unexpected value can only fail to match — never navigate somewhere else.
      const wanted = data.target.toLowerCase();
      const target = sorted.find((s) => s.name.toLowerCase() === wanted);
      if (target) setActiveId(target.id);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sorted, onInspectSelect]);

  // Push the current selection into the frame so it can draw the outline.
  // Re-sent whenever the HTML changes too, since a reloaded frame has lost it.
  useEffect(() => {
    if (!inspect) return;
    const frame = iframeRef.current;
    if (!frame) return;
    const send = () =>
      frame.contentWindow?.postMessage(
        { type: 'ufo-inspect-highlight', paths: selectedPaths ?? [] },
        '*'
      );
    // The frame may not have parsed its srcDoc yet on first paint.
    send();
    frame.addEventListener('load', send);
    return () => frame.removeEventListener('load', send);
  }, [inspect, selectedPaths, inspectHtml]);

  if (!sorted.length) {
    return <p className="text-center text-fg-faint">No screens yet.</p>;
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
      <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-surface-subtle p-2">
        <div className="flex min-w-0 gap-1 overflow-x-auto">
          {sorted.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                s.id === active.id ? 'bg-surface-strong text-fg' : 'text-fg-faint hover:text-fg'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)} disabled={!sorted[sorted.findIndex((s) => s.id === active.id) - 1]} className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-raised disabled:opacity-20">←</button>
          <button onClick={() => go(1)} disabled={!sorted[sorted.findIndex((s) => s.id === active.id) + 1]} className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-raised disabled:opacity-20">→</button>
          <button onClick={() => setPresentation((v) => !v)} className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-raised">
            {presentation ? 'Exit' : 'Present'}
          </button>
          <button onClick={toggleFullscreen} className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-raised">
            ⛶
          </button>
        </div>
      </div>

      <DeviceFrame mode={device} onModeChange={setDevice} zoom={zoom} showSwitcher={controlledDevice === undefined}>
        <div className="relative h-full w-full">
          <iframe
            title={active.name}
            ref={iframeRef}
            srcDoc={buildSrcDoc(inspect && inspectHtml ? inspectHtml : active.code, inspect)}
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
              className={`absolute -translate-x-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[9px] font-bold !text-fg shadow-lg ${pin.resolved ? 'bg-status-success' : 'bg-studio-coral'}`}
            >
              !
            </button>
          ))}
        </div>
      </DeviceFrame>
    </div>
  );
}
