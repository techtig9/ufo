'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#101114',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <p style={{ color: '#FF5A3C', fontFamily: 'monospace', fontSize: 14 }}>Application error</p>
        <h1 style={{ marginTop: 12, fontSize: 24, fontWeight: 600 }}>Something went wrong</h1>
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            background: '#D4FF4F',
            color: '#101114',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
