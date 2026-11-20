export default function StudentDashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading student dashboard">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded bg-gray-800" />
        <div className="h-8 w-64 rounded bg-gray-800" />
        <div className="h-4 w-full max-w-xl rounded bg-gray-800" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-gray-800 bg-gray-900/60" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-gray-800 bg-gray-900/60" />
    </div>
  );
}
