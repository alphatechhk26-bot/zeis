export default function ParentDashboardLoading() {
  return (
    <div className="space-y-6" aria-label="Loading parent dashboard" aria-busy="true">
      <div className="h-20 animate-pulse rounded-2xl bg-gray-800/70" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-gray-800 bg-gray-900/60" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-gray-800 bg-gray-900/60" />
    </div>
  );
}
