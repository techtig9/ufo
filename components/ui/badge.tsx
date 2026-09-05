import { type ReactNode } from 'react';
import clsx from 'clsx';

interface BadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  className?: string;
  /** Small leading dot indicator, useful for status badges (e.g. "Published"). */
  dot?: boolean;
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral: 'bg-surface-raised text-fg-secondary border border-edge',
  primary: 'bg-studio-citron/15 text-brand-text border border-studio-citron/30',
  success: 'bg-status-success/15 text-status-success border border-status-success/30',
  warning: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
  error: 'bg-status-error/15 text-status-error border border-status-error/30',
  info: 'bg-status-info/15 text-status-info border border-status-info/30',
};

const dotColors: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral: 'bg-fg-muted',
  primary: 'bg-studio-citron',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  error: 'bg-status-error',
  info: 'bg-status-info',
};

export function Badge({ children, variant = 'neutral', size = 'sm', className, dot }: BadgeProps) {
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        sizes[size],
        variants[variant],
        className
      )}
    >
      {dot && <span aria-hidden="true" className={clsx('h-1.5 w-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}
