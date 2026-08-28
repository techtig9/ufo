'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Wraps any element with a subtle pointer-tracked 3D tilt — the "magnetic
 * card" micro-interaction, on trend for 2025/26 product sites. Pure
 * pointermove math + CSS custom properties, no animation library.
 */
export function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(0)`;
  }

  function reset() {
    if (ref.current) ref.current.style.transform = '';
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      className={`tilt-card ${className}`}
    >
      {children}
    </div>
  );
}
