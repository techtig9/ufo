export default function BillingLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4">
      <div className="shimmer h-8 w-32" />
      <div className="shimmer h-24" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shimmer h-40" />
        ))}
      </div>
    </div>
  );
}
