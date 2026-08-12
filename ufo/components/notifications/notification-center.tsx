'use client';

import { useEffect, useState } from 'react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  async function load() {
    const res = await fetch('/api/notifications');
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.notifications ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((value) => !value); if (!open) load(); }}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-white"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-studio-coral px-1 text-[9px] leading-4 text-black">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="panel absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] rounded-panel p-2 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="font-medium">Notifications</p>
              <p className="text-[10px] text-white/30">{unread} unread</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-xs text-white/30 hover:text-white">Close</button>
          </div>

          <div className="max-h-80 space-y-1 overflow-y-auto">
            {!items.length && <p className="px-3 py-8 text-center text-xs text-white/30">You're all caught up.</p>}
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => markRead(item.id)}
                className={`w-full rounded-lg p-3 text-left hover:bg-white/5 ${item.read ? 'opacity-50' : ''}`}
              >
                <p className="text-sm text-white/80">{item.title}</p>
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
