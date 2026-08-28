import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ufo — describe it, see it, click through it';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#101114',
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.12) 2px, transparent 2px)',
          backgroundSize: '32px 32px',
          padding: '80px',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 40,
            color: '#EFEDE6',
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#D4FF4F',
              display: 'flex',
            }}
          />
          ufo
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 64,
            fontWeight: 700,
            color: 'white',
            maxWidth: 900,
            lineHeight: 1.1,
          }}
        >
          Describe it. See it.{' '}
          <span style={{ color: '#D4FF4F' }}>Click through it.</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: '#8A8D97', display: 'flex' }}>
          A full clickable UI/UX prototype from a plain-language description.
        </div>
      </div>
    ),
    { ...size }
  );
}
