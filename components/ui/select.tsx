import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
import clsx from 'clsx';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, hint, error, hideLabel, id, className, containerClassName, options, placeholder, required, ...props },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const hintId = hint ? `${selectId}-hint` : undefined;
    const errorId = error ? `${selectId}-error` : undefined;

    return (
      <div className={clsx('text-left', containerClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className={clsx(
              'mb-1.5 block text-xs font-medium text-fg-muted',
              hideLabel && 'sr-only'
            )}
          >
            {label}
            {required && <span className="text-status-error"> *</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={!!error}
            aria-describedby={clsx(hintId, errorId) || undefined}
            className={clsx(
              'w-full appearance-none rounded-lg border bg-surface-subtle px-3 py-2 pr-9 text-sm outline-none transition-colors duration-micro',
              'disabled:opacity-40 disabled:pointer-events-none',
              error
                ? 'border-status-error/50 focus:border-status-error'
                : 'border-edge focus:border-studio-citron',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {error ? (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-status-error">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1.5 text-xs text-fg-faint">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = 'Select';
