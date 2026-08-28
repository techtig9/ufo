import { type ReactNode } from 'react';
import clsx from 'clsx';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      {icon && (
        <div
          aria-hidden="true"
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40"
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-medium text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-white/50">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
