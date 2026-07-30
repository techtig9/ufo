'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { PrototypeViewer } from '@/components/prototype-viewer/prototype-viewer';
import { CodeEditorPanel } from '@/components/editor/code-editor-panel';
import { DesignHandoffPanel } from '@/components/editor/design-handoff-panel';
import { ProjectToolbar } from '@/components/editor/project-toolbar';
import type { Project, Screen } from '@/lib/types';

type Tab = 'preview' | 'code' | 'handoff';

export function ProjectWorkspace({
  project,
  screens,
  shareSlug,
  isPublic,
}: {
  project: Project;
  screens: Screen[];
  shareSlug: string;
  isPublic: boolean;
}) {
  const [tab, setTab] = useState<Tab>('preview');
  const [activeScreenId, setActiveScreenId] = useState(screens[0]?.id);
  const activeScreen = screens.find((s) => s.id === activeScreenId) ?? screens[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-4 flex gap-1 rounded-full bg-white/5 p-1 w-fit">
          {(['preview', 'code', 'handoff'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'rounded-full px-4 py-1.5 text-sm capitalize transition-colors',
                tab === t ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'
              )}
            >
              {t === 'handoff' ? 'Design Handoff' : t}
            </button>
          ))}
        </div>

        {tab === 'preview' && <PrototypeViewer screens={screens} />}

        {tab === 'code' && activeScreen && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {screens.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveScreenId(s.id)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs',
                    s.id === activeScreen.id ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <CodeEditorPanel screen={activeScreen} />
          </div>
        )}

        {tab === 'handoff' && <DesignHandoffPanel project={project} />}
      </div>

      <ProjectToolbar project={project} screens={screens} shareSlug={shareSlug} isPublic={isPublic} />
    </div>
  );
}
