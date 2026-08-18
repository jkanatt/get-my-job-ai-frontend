'use client';

export default function JobsLoading() {
  return (
    <div className="p-6 md:p-10 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-48 bg-[var(--bg-hover)] rounded mb-2" />
          <div className="h-4 w-64 bg-[var(--bg-hover)] rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-[var(--bg-hover)] rounded" />
          <div className="h-10 w-28 bg-[var(--bg-hover)] rounded" />
        </div>
      </div>

      {/* Search bar */}
      <div className="h-12 w-full bg-[var(--bg-hover)] rounded mb-6" />

      {/* Job cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 rounded">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="h-5 w-40 bg-[var(--bg-hover)] rounded mb-2" />
                <div className="h-4 w-28 bg-[var(--bg-hover)] rounded" />
              </div>
              <div className="h-8 w-16 bg-[var(--bg-hover)] rounded" />
            </div>
            <div className="h-3 w-full bg-[var(--bg-hover)] rounded mb-2" />
            <div className="h-3 w-3/4 bg-[var(--bg-hover)] rounded mb-4" />
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-[var(--bg-hover)] rounded" />
              <div className="h-6 w-20 bg-[var(--bg-hover)] rounded" />
              <div className="h-6 w-14 bg-[var(--bg-hover)] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
