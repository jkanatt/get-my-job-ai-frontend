'use client';

export default function DashboardLoading() {
  return (
    <div className="p-6 md:p-10 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-64 bg-[var(--bg-hover)] rounded mb-2" />
          <div className="h-4 w-48 bg-[var(--bg-hover)] rounded" />
        </div>
        <div className="h-10 w-32 bg-[var(--bg-hover)] rounded" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 rounded">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-24 bg-[var(--bg-hover)] rounded" />
              <div className="h-8 w-8 bg-[var(--bg-hover)] rounded" />
            </div>
            <div className="h-8 w-16 bg-[var(--bg-hover)] rounded mb-2" />
            <div className="h-3 w-20 bg-[var(--bg-hover)] rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <div className="h-5 w-40 bg-[var(--bg-hover)] rounded" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-[var(--border-subtle)] last:border-b-0">
            <div className="h-4 w-4 bg-[var(--bg-hover)] rounded" />
            <div className="h-4 w-32 bg-[var(--bg-hover)] rounded" />
            <div className="h-4 w-24 bg-[var(--bg-hover)] rounded" />
            <div className="flex-1" />
            <div className="h-6 w-20 bg-[var(--bg-hover)] rounded" />
            <div className="h-4 w-16 bg-[var(--bg-hover)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
