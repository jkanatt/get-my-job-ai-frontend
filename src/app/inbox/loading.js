'use client';

export default function InboxLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen -mx-4 md:-mx-10 -my-8 animate-pulse">
      {/* Email list sidebar */}
      <div className="w-full md:w-96 border-r border-[var(--border-subtle)] bg-[var(--bg-base)]">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <div className="h-8 w-full bg-[var(--bg-hover)] rounded mb-3" />
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-[var(--bg-hover)] rounded" />
            <div className="h-8 w-20 bg-[var(--bg-hover)] rounded" />
            <div className="h-8 w-20 bg-[var(--bg-hover)] rounded" />
          </div>
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="p-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 w-32 bg-[var(--bg-hover)] rounded" />
              <div className="h-3 w-16 bg-[var(--bg-hover)] rounded" />
            </div>
            <div className="h-4 w-48 bg-[var(--bg-hover)] rounded mb-1" />
            <div className="h-3 w-full bg-[var(--bg-hover)] rounded" />
          </div>
        ))}
      </div>
      {/* Email content area */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-[var(--bg-surface)]">
        <div className="text-center">
          <div className="h-12 w-12 bg-[var(--bg-hover)] rounded-full mx-auto mb-4" />
          <div className="h-4 w-40 bg-[var(--bg-hover)] rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
