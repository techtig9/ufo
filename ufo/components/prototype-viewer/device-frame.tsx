'use client';

import { type ReactNode } from 'react';
import clsx from 'clsx';

export type DeviceMode = 'mobile' | 'tablet' | 'desktop';

const DIMENSIONS: Record<DeviceMode, string> = {
  mobile: 'w-[375px] h-[720px]',
  tablet: 'w-[768px] h-[720px]',
  desktop: 'w-full h-[720px]',
};

export function DeviceFrame({
  mode,
  onModeChange,
  children,
}: {
  mode: DeviceMode;
  onModeChange: (m: DeviceMode) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="panel flex gap-1 rounded-full p-1">
        {(['mobile', 'tablet', 'desktop'] as DeviceMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={clsx(
              'rounded-full px-4 py-1.5 text-xs capitalize transition-colors',
              mode === m ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <div
        className={clsx(
          'panel overflow-hidden rounded-panel p-2 transition-[width,height] duration-300',
          DIMENSIONS[mode]
        )}
      >
        <div className="h-full w-full overflow-hidden rounded-[12px] bg-white">{children}</div>
      </div>
    </div>
  );
}
