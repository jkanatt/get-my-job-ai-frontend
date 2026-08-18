'use client';

export default function TrackerLoading() {
  return (
    <div className="p-6 md:p-10 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-52 bg-[var(--bg-hover)] rounded mb-2" />
          <div className="h-4 w-40 bg-[var(--bg-hover)] rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-[var(--bg-hover)] rounded" />
          <div className="h-10 w-32 bg-[var(--bg-hover)] rounded" />
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...Array(5)].map((_, col) => (
          <div key={col} className="min-w-[280px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-5 w-24 bg-[var(--bg-hover)] rounded" />
              <div className="h-5 w-6 bg-[var(--bg-hover)] rounded" />
            </div>
            <div className="space-y-3">
              {[...Array(col === 0 ? 4 : col === 1 ? 3 : 2)].map((_, card) => (
                <div key={card} className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 rounded">
                  <div className="h-4 w-32 bg-[var(--bg-hover)] rounded mb-2" />
                  <div className="h-3 w-24 bg-[var(--bg-hover)] rounded mb-3" />
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-16 bg-[var(--bg-hover)] rounded" />
                    <div className="h-3 w-12 bg-[var(--bg-hover)] rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
