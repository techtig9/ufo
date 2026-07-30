'use client';

import toast from 'react-hot-toast';
import { Panel } from '@/components/ui/panel';
import type { Project } from '@/lib/types';

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
}

export function DesignHandoffPanel({ project }: { project: Project }) {
  const colors = project.color_theme;

  return (
    <div className="space-y-4">
      <Panel hover={false}>
        <h3 className="font-medium">Colors</h3>
        {!colors ? (
          <p className="mt-2 text-sm text-white/40">No tokens saved for this project.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(colors).map(([name, hex]) => (
              <button
                key={name}
                onClick={() => copy(hex as string, name)}
                className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-left text-xs hover:border-white/25"
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-md border border-white/10"
                  style={{ backgroundColor: hex as string }}
                />
                <span>
                  <span className="block capitalize text-white/70">{name}</span>
                  <span className="text-white/40">{hex as string}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel hover={false}>
        <h3 className="font-medium">Typography</h3>
        <button
          onClick={() => copy(project.font_pairing ?? '', 'Font')}
          className="mt-2 block w-full rounded-lg border border-white/10 p-3 text-left text-sm hover:border-white/25"
        >
          {project.font_pairing ?? 'No font pairing saved'}
        </button>
      </Panel>

      <Panel hover={false}>
        <h3 className="font-medium">Spacing scale</h3>
        <button
          onClick={() => copy('4px 8px 12px 16px 24px 32px 48px 64px', 'Spacing scale')}
          className="mt-2 flex flex-wrap gap-2 text-xs text-white/50"
        >
          {[4, 8, 12, 16, 24, 32, 48, 64].map((v) => (
            <span key={v} className="rounded border border-white/10 px-2 py-1">{v}px</span>
          ))}
        </button>
      </Panel>
    </div>
  );
}
