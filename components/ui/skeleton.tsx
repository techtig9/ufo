import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  /** Rounded-full for avatars/circular thumbnails. */
  circle?: boolean;
}

/** Reuses the existing `.shimmer` keyframe (globals.css) — one shimmer treatment product-wide. */
export function Skeleton({ className, circle }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx('shimmer', circle ? 'rounded-full' : 'rounded-lg', className)}
    />
  );
}

/** A block of skeleton text lines — the last line is shorter, mimicking real paragraph wrap. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={clsx('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** A skeleton matching the shape of a Panel-based card (thumbnail + title + meta line). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx('panel space-y-3 p-4', className)} aria-hidden="true">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}
