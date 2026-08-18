'use client';

export default function ProfileLoading() {
  return (
    <div className="p-6 md:p-10 animate-pulse max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-16 w-16 bg-[var(--bg-hover)] rounded-full" />
        <div>
          <div className="h-7 w-40 bg-[var(--bg-hover)] rounded mb-2" />
          <div className="h-4 w-56 bg-[var(--bg-hover)] rounded" />
        </div>
      </div>

      {/* Profile sections */}
      {[...Array(4)].map((_, section) => (
        <div key={section} className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded mb-6">
          <div className="p-5 border-b border-[var(--border-subtle)]">
            <div className="h-5 w-40 bg-[var(--bg-hover)] rounded" />
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, field) => (
                <div key={field}>
                  <div className="h-3 w-24 bg-[var(--bg-hover)] rounded mb-2" />
                  <div className="h-10 w-full bg-[var(--bg-hover)] rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
