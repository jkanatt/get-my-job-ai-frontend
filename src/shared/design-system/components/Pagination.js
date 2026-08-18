import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ 
  page, 
  setPage, 
  total, 
  hasMore, 
  limit = 50,
  itemName = 'items'
}) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total || page * limit);
  
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-transparent">
      {/* Mobile view */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="text-[12px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30"
        >
          PREVIOUS
        </button>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={!hasMore}
          className="text-[12px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30"
        >
          NEXT
        </button>
      </div>

      {/* Desktop view */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-mono tracking-widest uppercase text-[var(--text-muted)]">
            <span className="text-[var(--text-primary)] font-bold">{start}-{end}</span> of <span className="text-[var(--text-primary)] font-bold">{total || '?'}</span> {itemName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-none bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all disabled:opacity-30 disabled:hover:bg-[var(--bg-elevated)] disabled:hover:text-[var(--text-secondary)]"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] font-black tracking-widest uppercase text-[var(--text-muted)] px-2">PAGE {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
            className="w-8 h-8 flex items-center justify-center rounded-none bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all disabled:opacity-30 disabled:hover:bg-[var(--bg-elevated)] disabled:hover:text-[var(--text-secondary)]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
