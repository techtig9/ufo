import { type ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

/**
 * The Master Command requires every important interactive component to carry
 * default, hover, active, pressed, focus, disabled and loading states, and the
 * spec assigns motion to tiers rather than ad-hoc durations. Both are handled
 * here rather than at ~200 call sites.
 *
 * `loading` is a real state, not a caller-managed convention: it disables the
 * button, marks it aria-busy, and swaps in a spinner while preserving the
 * label's width so the layout does not jump — the previous pattern of
 * `{loading ? 'Saving…' : 'Save'}` reflowed everything around it.
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  /** Announced to assistive tech while `loading`. */
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, loadingLabel = 'Working…', className, children, disabled, ...props },
    ref
  ) => {
    const sizes = {
      // Minimum 44px touch target at md/lg per the spec; sm is for dense
      // toolbars where the surrounding row already provides the target.
      sm: 'min-h-[36px] px-3.5 py-1.5 text-sm',
      md: 'min-h-[44px] px-5 py-2.5 text-sm',
      lg: 'min-h-[52px] px-7 py-3.5 text-base',
    };

    const variants = {
      primary:
        'bg-brand text-brand-ink font-semibold hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
      secondary:
        'panel text-fg font-medium border-edge hover:border-edge-strong hover:bg-surface-raised active:scale-[0.98]',
      ghost:
        'text-fg-muted hover:text-fg hover:bg-surface-subtle font-medium active:scale-[0.98]',
      danger:
        'bg-status-error/15 text-accent-text font-medium hover:bg-status-error/25 border border-status-error/30 active:scale-[0.98]',
    };

    return (
      <button
        ref={ref}
        // A loading button must not be clickable twice.
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={clsx(
          'relative inline-flex items-center justify-center gap-2 rounded-lg',
          'transition-all duration-micro ease-snap',
          'disabled:opacity-40 disabled:pointer-events-none',
          sizes[size],
          variants[variant],
          className
        )}
        {...props}
      >
        {loading && (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
          </span>
        )}
        {/* Kept in flow while loading so the button does not change width. */}
        <span className={clsx('inline-flex items-center gap-2', loading && 'invisible')}>
          {children}
        </span>
        {loading && <span className="sr-only">{loadingLabel}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';
