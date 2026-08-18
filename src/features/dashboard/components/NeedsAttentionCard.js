'use client';

import { ArrowRight } from 'lucide-react';

/**
 * Card displayed in the "Needs Attention" section of the Dashboard.
 * Shows urgency-colored borders, company avatar, and action button.
 */
export default function NeedsAttentionCard({ item, getColor, onAction }) {
  const urgencyStyles = {
    high: 'border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent hover:border-red-500/50',
    medium: 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent hover:border-amber-500/50',
    low: 'border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent hover:border-blue-500/50',
  };

  const hoverStyles = {
    high: 'group-hover:bg-red-500/10 group-hover:border-red-500/50',
    medium: 'group-hover:bg-amber-500/10 group-hover:border-amber-500/50',
    low: 'group-hover:bg-blue-500/10 group-hover:border-blue-500/50',
  };

  const color = getColor(item.app.company);

  return (
    <div className={`card-base p-5 border ${urgencyStyles[item.urgency] || urgencyStyles.low} relative overflow-hidden group transition-colors flex flex-col justify-between min-h-[160px]`}>
      <div>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-none flex items-center justify-center font-bold text-sm border shadow-none group-hover:shadow-[4px_4px_0_0_var(--text-primary)] transition-all"
              style={{ backgroundColor: color + '10', color, borderColor: color }}
            >
              {item.app.company?.charAt(0) || '?'}
            </div>
            <h3 className="font-semibold text-[var(--text-primary)]/90 text-sm whitespace-normal break-words max-w-[150px]">
              {item.title}
            </h3>
          </div>
          {item.urgency === 'high' && (
            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[9px] font-bold tracking-widest uppercase rounded-none border border-red-500/50 shrink-0 shadow-none">
              Urgent
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4">{item.subtitle}</p>
      </div>

      <button
        onClick={() => onAction(item)}
        className={`w-full py-2 bg-transparent text-[var(--text-primary)]/90 text-sm font-bold uppercase tracking-widest rounded-none transition-colors flex items-center justify-center gap-2 border border-[var(--border-strong)] hover:border-[var(--text-primary)] hover:bg-[var(--bg-hover)]`}
      >
        Take Action <ArrowRight size={14} />
      </button>
    </div>
  );
}
