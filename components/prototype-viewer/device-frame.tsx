'use client';

import { type ReactNode } from 'react';
import clsx from 'clsx';

export type DeviceMode = 'mobile' | 'tablet' | 'desktop';

const DIMENSIONS: Record<DeviceMode, string> = {
  mobile: 'w-[375px] h-[720px]',
  tablet: 'w-[768px] h-[720px]',
  desktop: 'w-full h-[720px]',
};

// Pixel bases for the zoomable frame sizes (mobile/tablet only — desktop is fluid width,
// so it isn't zoomed; see DeviceFrame's `effectiveZoom`).
const BASE_PX: Record<DeviceMode, [number, number]> = {
  mobile: [375, 720],
  tablet: [768, 720],
  desktop: [0, 720],
};

export function DeviceFrame({
  mode,
  onModeChange,
  zoom = 1,
  showSwitcher = true,
  children,
}: {
  mode: DeviceMode;
  onModeChange: (m: DeviceMode) => void;
  /** Visual scale applied to the frame (mobile/tablet only — desktop has no fixed base to scale from). */
  zoom?: number;
  /** Hide the built-in device pills when a parent toolbar already controls device mode. */
  showSwitcher?: boolean;
  children: ReactNode;
}) {
  const effectiveZoom = mode === 'desktop' ? 1 : zoom;
  const [baseWidth, baseHeight] = BASE_PX[mode];

  return (
    <div className="flex flex-col items-center gap-4">
      {showSwitcher && (
        <div className="panel flex gap-1 rounded-full p-1">
          {(['mobile', 'tablet', 'desktop'] as DeviceMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={clsx(
                'rounded-full px-4 py-1.5 text-xs capitalize transition-colors',
                mode === m ? 'bg-surface-strong text-fg' : 'text-fg-muted hover:text-fg'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      <div
        style={mode !== 'desktop' ? { width: baseWidth * effectiveZoom, height: baseHeight * effectiveZoom } : undefined}
        className={clsx(
          'panel overflow-hidden rounded-panel p-2 transition-[width,height] duration-300',
          mode === 'desktop' && DIMENSIONS[mode]
        )}
      >
        <div
          style={
            mode !== 'desktop'
              ? { width: baseWidth, height: baseHeight, transform: `scale(${effectiveZoom})`, transformOrigin: 'top left' }
              : undefined
          }
          className={clsx('overflow-hidden rounded-[12px] bg-white', mode === 'desktop' && 'h-full w-full')}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
