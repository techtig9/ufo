import { type InputHTMLAttributes, forwardRef, useId } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Visually hide the label but keep it for screen readers. */
  hideLabel?: boolean;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, hideLabel, id, className, containerClassName, required, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className={clsx('text-left', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={clsx(
              'mb-1.5 block text-xs font-medium text-white/60',
              hideLabel && 'sr-only'
            )}
          >
            {label}
            {required && <span className="text-status-error"> *</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={clsx(hintId, errorId) || undefined}
          className={clsx(
            'w-full rounded-lg border bg-white/5 px-3 py-2 text-sm outline-none transition-colors duration-150',
            'placeholder:text-white/30 disabled:opacity-40 disabled:pointer-events-none',
            error
              ? 'border-status-error/50 focus:border-status-error'
              : 'border-white/10 focus:border-studio-citron',
            className
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-status-error">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1.5 text-xs text-white/40">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
