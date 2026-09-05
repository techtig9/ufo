'use client';

import { type ReactNode, useId, useState } from 'react';
import clsx from 'clsx';

interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  /** Controlled active tab id. Omit for uncontrolled (internally-managed) usage. */
  value?: string;
  onChange?: (id: string) => void;
  defaultValue?: string;
  className?: string;
}

export function Tabs({ tabs, value, onChange, defaultValue, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.id);
  const active = value ?? internal;
  const baseId = useId();

  function select(id: string) {
    if (onChange) onChange(id);
    else setInternal(id);
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const enabled = tabs.filter((t) => !t.disabled);
    if (enabled.length === 0) return;
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') nextIndex = 0;
    if (e.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const target = tabs[nextIndex];
    if (target.disabled) return;
    select(target.id);
    document.getElementById(`${baseId}-tab-${target.id}`)?.focus();
  }

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 border-b border-edge">
        {tabs.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={clsx(
                'relative px-4 py-2.5 text-sm font-medium transition-colors duration-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-studio-citron disabled:opacity-40 disabled:pointer-events-none',
                selected ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'
              )}
            >
              {tab.label}
              {selected && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-studio-citron" />}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="pt-4"
        >
          {tab.id === active && tab.content}
        </div>
      ))}
    </div>
  );
}
