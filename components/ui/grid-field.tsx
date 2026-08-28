interface GridFieldProps {
  /** 'strong' for hero/pricing, 'subtle' for deep dashboard screens. */
  strength?: 'strong' | 'subtle';
  className?: string;
}

/**
 * Studio Grid's background: a dot-grid "artboard" canvas plus one slow,
 * faint scan-line sweep — the visual language of a design tool, not a
 * generic gradient. Pure CSS (dot-grid via background-image, scan via a
 * @keyframes translateY loop) — no JS, no animation library, respects
 * prefers-reduced-motion globally (see globals.css).
 */
export function GridField({ strength = 'strong', className = '' }: GridFieldProps) {
  const opacity = strength === 'strong' ? 'opacity-100' : 'opacity-40';

  return (
    <div
      aria-hidden="true"
      className={`dot-canvas absolute inset-0 overflow-hidden pointer-events-none ${opacity} ${className}`}
    >
      <div
        className="absolute inset-x-0 h-64 animate-scan bg-gradient-to-b from-transparent via-studio-citron/[0.06] to-transparent"
        style={{ top: '-16rem' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
    </div>
  );
}
