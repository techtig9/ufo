import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { CookieConsent } from '@/components/ui/cookie-consent';
import { ChatWidgetGate } from '@/components/chat/chat-widget-gate';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ufo — Describe it. See it. Click through it.',
    template: '%s · ufo',
  },
  description:
    'ufo turns a plain-language description into a complete, clickable multi-screen UI/UX prototype in minutes — real design tokens, real code, no design software required.',
  keywords: [
    'AI UI design generator',
    'AI UX design tool',
    'clickable prototype generator',
    'AI wireframe tool',
    'design handoff',
  ],
  authors: [{ name: 'ufo' }],
  openGraph: {
    type: 'website',
    siteName: 'ufo',
    title: 'ufo — Describe it. See it. Click through it.',
    description:
      'A full clickable multi-screen UI/UX prototype from a plain-language description.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ufo — Describe it. See it. Click through it.',
    description:
      'A full clickable multi-screen UI/UX prototype from a plain-language description.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#101114',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <CookieConsent />
        <ChatWidgetGate />
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: 'panel !text-white !bg-ink-soft !border-line !rounded-panel',
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
