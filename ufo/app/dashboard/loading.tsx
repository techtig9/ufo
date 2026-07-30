export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="shimmer h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer h-40" />
        ))}
      </div>
    </div>
  );
}
