'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DeviceFrame, type DeviceMode } from './device-frame';
import type { Screen } from '@/lib/types';

/**
 * Wraps a screen's raw HTML (Tailwind classes, no build step) into a full
 * document, loads Tailwind's CDN script for instant preview, and injects a
 * tiny script that turns every [data-hotspot] click into a postMessage to
 * the parent — the parent then swaps the active screen. The iframe is
 * sandboxed with allow-scripts only (no allow-same-origin), so it can never
 * reach into the parent page directly.
 */
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

export function PrototypeViewer({ screens }: { screens: Screen[] }) {
  const sorted = useMemo(() => [...screens].sort((a, b) => a.order_index - b.order_index), [screens]);
  const [activeId, setActiveId] = useState(sorted[0]?.id);
  const [device, setDevice] = useState<DeviceMode>('mobile');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const active = sorted.find((s) => s.id === activeId) ?? sorted[0];

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type !== 'ufo-hotspot') return;
      const target = sorted.find(
        (s) => s.name.toLowerCase() === String(e.data.target).toLowerCase()
      );
      if (target) setActiveId(target.id);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sorted]);

  if (!active) {
    return <p className="text-center text-white/40">No screens yet.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-2">
        {sorted.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              s.id === active.id ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50 hover:text-white'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
      <DeviceFrame mode={device} onModeChange={setDevice}>
        <iframe
          ref={iframeRef}
          title={active.name}
          srcDoc={buildSrcDoc(active.code)}
          sandbox="allow-scripts"
          className="h-full w-full border-0"
        />
      </DeviceFrame>
    </div>
  );
}
