import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function ProjectsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}
