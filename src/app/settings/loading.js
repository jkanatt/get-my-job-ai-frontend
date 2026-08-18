'use client';

export default function SettingsLoading() {
  return (
    <div className="p-6 md:p-10 animate-pulse max-w-4xl">
      <div className="h-8 w-32 bg-[var(--bg-hover)] rounded mb-2" />
      <div className="h-4 w-56 bg-[var(--bg-hover)] rounded mb-8" />

      {/* Settings sections */}
      {[...Array(3)].map((_, section) => (
        <div key={section} className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded mb-6">
          <div className="p-5 border-b border-[var(--border-subtle)]">
            <div className="h-5 w-36 bg-[var(--bg-hover)] rounded" />
          </div>
          <div className="p-5 space-y-4">
            {[...Array(3)].map((_, field) => (
              <div key={field}>
                <div className="h-3 w-20 bg-[var(--bg-hover)] rounded mb-2" />
                <div className="h-10 w-full bg-[var(--bg-hover)] rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
