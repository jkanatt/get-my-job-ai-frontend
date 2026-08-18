'use client';

export default function CalendarLoading() {
  return (
    <div className="p-6 md:p-10 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-36 bg-[var(--bg-hover)] rounded mb-2" />
          <div className="h-4 w-48 bg-[var(--bg-hover)] rounded" />
        </div>
        <div className="flex gap-3 items-center">
          <div className="h-10 w-10 bg-[var(--bg-hover)] rounded" />
          <div className="h-6 w-32 bg-[var(--bg-hover)] rounded" />
          <div className="h-10 w-10 bg-[var(--bg-hover)] rounded" />
        </div>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 gap-px mb-2">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="text-center">
            <div className="h-4 w-8 bg-[var(--bg-hover)] rounded mx-auto" />
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="border border-[var(--border-subtle)] rounded overflow-hidden">
        {[...Array(5)].map((_, week) => (
          <div key={week} className="grid grid-cols-7 gap-px">
            {[...Array(7)].map((_, day) => (
              <div key={day} className="h-24 bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-2">
                <div className="h-4 w-6 bg-[var(--bg-hover)] rounded mb-2" />
                {day % 3 === 0 && <div className="h-5 w-full bg-[var(--bg-hover)] rounded" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
