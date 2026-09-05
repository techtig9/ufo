'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Cmd/Ctrl+K command palette.
 *
 * Replaces a dead control: the top bar rendered a search field with a ⌘K badge
 * whose handler just did `router.push('/dashboard/projects')`. The Master
 * Command forbids exactly that — a placeholder affordance that advertises a
 * capability the product does not have.
 *
 * Everything offered here is real. Navigation entries are static; project
 * results come from the user's actual projects, fetched once the palette is
 * first opened rather than on every dashboard page load.
 */

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string;
  /** Where to go. Exactly one of `href` or `action` is set. */
  href?: string;
  action?: 'toggle-theme';
}

interface ProjectRow {
  id: string;
  name: string;
  archived_at?: string | null;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const projectsRequested = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** Focus is returned here on close, so the keyboard journey is not broken. */
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
    restoreFocusRef.current?.focus?.();
  }, []);

  // Global shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        restoreFocusRef.current = document.activeElement as HTMLElement;
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Projects are fetched lazily — the palette is useful without them, and most
  // page loads never open it. The guard is a ref rather than state so the
  // effect body performs no synchronous setState.
  useEffect(() => {
    if (!open || projectsRequested.current) return;
    projectsRequested.current = true;
    fetch('/api/projects/search')
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const actions: Command[] = [
      {
        id: 'act-new',
        group: 'Actions',
        label: 'Create a new project with AI',
        hint: 'Opens AI Designer',
        keywords: 'new generate build',
        href: '/dashboard/ai-designer',
      },
      {
        id: 'act-theme',
        group: 'Actions',
        label: 'Toggle light / dark mode',
        keywords: 'theme appearance dark light',
        action: 'toggle-theme',
      },
    ];

    const nav: Command[] = [
      { id: 'nav-overview', group: 'Go to', label: 'Overview', keywords: 'dashboard home', href: '/dashboard' },
      { id: 'nav-projects', group: 'Go to', label: 'Projects', keywords: 'files designs', href: '/dashboard/projects' },
      { id: 'nav-templates', group: 'Go to', label: 'Templates', keywords: 'starters', href: '/dashboard/templates' },
      { id: 'nav-designer', group: 'Go to', label: 'AI Designer', keywords: 'generate create new', href: '/dashboard/ai-designer' },
      { id: 'nav-workspaces', group: 'Go to', label: 'Workspaces', keywords: 'team members invite collaborators', href: '/dashboard/workspaces' },
      { id: 'nav-billing', group: 'Go to', label: 'Billing', keywords: 'plan credits invoice', href: '/dashboard/billing' },
      { id: 'nav-settings', group: 'Go to', label: 'Settings', keywords: 'account profile security', href: '/dashboard/settings' },
      { id: 'nav-help', group: 'Go to', label: 'Help & Support', keywords: 'docs faq', href: '/help' },
    ];

    const projectCommands: Command[] = projects.map((p) => ({
      id: `project-${p.id}`,
      group: 'Projects',
      label: p.name,
      hint: p.archived_at ? 'Archived' : undefined,
      keywords: 'open project',
      href: `/dashboard/projects/${p.id}`,
    }));

    return [...actions, ...nav, ...projectCommands];
  }, [projects]);

  /** Runs a command. An event handler, so nothing here happens during render. */
  function execute(cmd: Command | undefined) {
    if (!cmd) return;
    close();
    if (cmd.href) { router.push(cmd.href); return; }
    if (cmd.action === 'toggle-theme') {
      // Imported lazily: the palette mounts on every dashboard page and does
      // not otherwise need the theme module.
      void import('@/lib/theme').then(({ getTheme, setTheme }) => {
        setTheme(getTheme() === 'light' ? 'dark' : 'light');
      });
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Derived, not synced: clamping in an effect would cost an extra render on
  // every keystroke that narrows the list.
  const activeIndex = filtered.length ? Math.min(cursor, filtered.length - 1) : 0;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (filtered.length ? (c + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (filtered.length ? (c - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(filtered[activeIndex]);
    } else if (e.key === 'Tab') {
      // Focus stays in the palette: it is a modal surface.
      e.preventDefault();
    }
  }

  // Keep the active option scrolled into view for keyboard-only users.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={close}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm animate-fade-in"
      />

      <div className="relative w-full max-w-lg animate-scale-in overflow-hidden rounded-xl border border-edge-strong bg-elevated shadow-palette">
        <div className="flex items-center gap-3 border-b border-edge px-4">
          <span aria-hidden="true" className="text-fg-faint">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search projects, pages and actions…"
            aria-label="Search commands"
            aria-controls="command-palette-results"
            aria-activedescendant={filtered[activeIndex] ? `cmd-${filtered[activeIndex].id}` : undefined}
            className="w-full bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-fg-faint"
          />
          <kbd className="rounded border border-edge px-1.5 py-0.5 text-[10px] text-fg-faint">esc</kbd>
        </div>

        <ul
          id="command-palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-[52vh] overflow-y-auto p-1.5"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-fg-muted">
              Nothing matches “{query}”.
            </li>
          )}
          {filtered.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            const activeRow = i === activeIndex;
            return (
              <li key={c.id}>
                {showGroup && (
                  <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
                    {c.group}
                  </p>
                )}
                <button
                  type="button"
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={activeRow}
                  data-active={activeRow}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => execute(c)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-micro ${
                    activeRow ? 'bg-surface-raised text-fg' : 'text-fg-secondary'
                  }`}
                >
                  <span className="truncate">{c.label}</span>
                  {c.hint && <span className="shrink-0 text-[10px] text-fg-faint">{c.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
