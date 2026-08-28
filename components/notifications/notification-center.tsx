'use client';

import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const TYPE_VARIANT: Record<string, 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  billing: 'warning',
  credits: 'warning',
  system: 'info',
  success: 'success',
  error: 'error',
  info: 'neutral',
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
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

  async function markRead(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });
  }

  const unread = items.filter((item) => !item.read).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen((value) => !value); if (!open) load(); }}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="relative rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-white"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-studio-coral px-1 text-[9px] leading-4 text-black">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Notifications"
          className="dropdown-surface absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] animate-scale-in rounded-panel border border-line p-2 shadow-2xl"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="font-medium">Notifications</p>
              <p className="text-[10px] text-white/30">{unread} unread</p>
            </div>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-white/40 hover:text-white">Mark all read</button>
              )}
              <button onClick={() => setOpen(false)} className="text-xs text-white/30 hover:text-white">Close</button>
            </div>
          </div>

          <div className="max-h-80 space-y-1 overflow-y-auto">
            {!loading && !items.length && (
              <EmptyState title="You're all caught up" className="py-8" />
            )}
            {items.map((item) => (
              <button
                key={item.id}
                role="menuitem"
                onClick={() => markRead(item.id)}
                className={clsx('w-full rounded-lg p-3 text-left hover:bg-white/5', item.read && 'opacity-50')}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={TYPE_VARIANT[item.type] ?? 'neutral'} size="sm" dot>{item.type}</Badge>
                  {!item.read && <span className="h-1.5 w-1.5 rounded-full bg-studio-citron" aria-hidden="true" />}
                </div>
                <p className="mt-1.5 text-sm text-white/80">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/40">{item.message}</p>
                <p className="mt-1 text-[9px] text-white/25">{new Date(item.created_at).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
