'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';

export interface DropdownItem {
  id: string;
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  /** Accessible name for the trigger button, for icon-only triggers. */
  triggerLabel?: string;
  /** Optional non-interactive content shown above the menu items (e.g. account name/email). */
  header?: ReactNode;
}

/** A button-triggered menu. Closes on Escape, outside click, or item selection. */
export function Dropdown({ trigger, items, align = 'right', triggerLabel, header }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={clsx(
            'dropdown-surface absolute z-[150] mt-2 min-w-[180px] animate-scale-in rounded-lg border border-edge p-1 shadow-lift',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {header && <div className="border-b border-edge px-3 py-2">{header}</div>}
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className={clsx(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-micro disabled:opacity-40 disabled:pointer-events-none',
                item.destructive ? 'text-status-error hover:bg-status-error/10' : 'text-fg-secondary hover:bg-surface-raised hover:text-fg'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
