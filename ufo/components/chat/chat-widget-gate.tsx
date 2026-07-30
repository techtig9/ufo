'use client';

import { usePathname } from 'next/navigation';
import { ChatWidget } from './chat-widget';

const HIDDEN_PREFIXES = ['/login', '/signup', '/forgot-password'];

export function ChatWidgetGate() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <ChatWidget />;
}
