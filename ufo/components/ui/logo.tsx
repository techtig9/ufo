import clsx from 'clsx';

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const textSizes = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' };
  const iconSizes = { sm: 18, md: 22, lg: 28 };

  return (
    <span className={clsx('inline-flex items-center gap-2 font-display font-semibold tracking-tight', textSizes[size], className)}>
      <svg width={iconSizes[size]} height={iconSizes[size]} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#101114" />
        <g stroke="#D4FF4F" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M6 11V7h4" />
          <path d="M26 11V7h-4" />
          <path d="M6 21v4h4" />
          <path d="M26 21v4h-4" />
        </g>
        <circle cx="16" cy="16" r="3.2" fill="#D4FF4F" />
      </svg>
      ufo
    </span>
  );
}
