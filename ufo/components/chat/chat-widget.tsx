'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { CompassChatIcon } from './compass-chat-icon';
import type { ChatMessage } from '@/lib/ai';

const GREETING = "Hi \u2014 I'm Compass. Ask me which plan fits, what a feature does, or what project type suits what you're building.";

export function ChatWidget() {
  const supabase = createClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    // Proactive greeting bubble — appears once per visit, a few seconds
    // in, rather than instantly (less jarring on page load).
    const t = setTimeout(() => setShowBubble(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function handleOpen() {
    setOpen(true);
    setShowBubble(false);
    if (authed && messages.length === 0) {
      setMessages([{ role: 'model', text: GREETING }]);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const next: ChatMessage[] = [...messages, { role: 'user', text: input.trim() }];
    setMessages(next);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages([...next, { role: 'model', text: data.error ?? 'Something went wrong.' }]);
      } else {
        setMessages([...next, { role: 'model', text: data.reply }]);
      }
    } catch {
      setMessages([...next, { role: 'model', text: 'Network error — try again in a moment.' }]);
    }
    setSending(false);
  }

  return (
    <div className="fixed bottom-5 right-5 z-[150]">
      {!open && showBubble && (
        <button
          onClick={handleOpen}
          className="panel panel-hover mb-3 max-w-[240px] p-3 text-left text-sm text-white/80 animate-fade-up"
        >
          <span className="mr-1.5">{'\u{1F44B}'}</span>
          {authed ? GREETING : "Curious which plan fits? Sign up to ask Compass, ufo's AI advisor."}
        </button>
      )}

      {open && (
        <div className="panel crop-marks mb-3 flex h-[440px] w-80 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <CompassChatIcon size={20} />
              <span className="font-display text-sm font-medium">Compass</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white">&times;</button>
          </div>

          {authed === false ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-white/60">
                Sign up or log in to chat with Compass {'\u2014'} ufo&rsquo;s AI advisor for picking a
                plan and figuring out what fits your project.
              </p>
              <div className="flex gap-2">
                <Link href="/signup"><Button size="sm">Sign up</Button></Link>
                <Link href="/login"><Button size="sm" variant="secondary">Log in</Button></Link>
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.role === 'user'
                        ? 'ml-auto bg-studio-citron text-ink'
                        : 'bg-white/5 text-white/80'
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
                {sending && <div className="shimmer h-8 w-24 rounded-lg" />}
              </div>
              <form onSubmit={handleSend} className="flex gap-2 border-t border-line p-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about plans, credits, features\u2026"
                  className="flex-1 rounded-lg border border-line bg-white/5 px-3 py-2 text-xs outline-none focus:border-studio-citron"
                />
                <Button type="submit" size="sm" disabled={sending || !input.trim()}>Send</Button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label="Open Compass, ufo's AI advisor"
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-studio-citron shadow-glow transition-transform duration-200 ease-snap hover:-translate-y-0.5"
      >
        <CompassChatIcon size={28} />
      </button>
    </div>
  );
}
