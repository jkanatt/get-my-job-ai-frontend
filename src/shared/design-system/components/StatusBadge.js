'use client';

import { STATUS_STYLES, STATUS_DEFAULT_STYLE } from '@/config/status.config';

/**
 * Reusable status badge component used across Tracker, Dashboard, and Detail modals.
 * Styles are centralized in status.config.js — change once, propagate everywhere.
 */
export default function StatusBadge({ status, size = 'sm', showDot = true, className = '' }) {
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[8px]',
    sm: 'px-3 py-1 text-[10px]',
    md: 'px-4 py-1.5 text-[11px]',
  };

  const dotSizes = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
  };

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 rounded-none font-bold uppercase tracking-widest border ${STATUS_STYLES[status] || STATUS_DEFAULT_STYLE} ${sizeClasses[size] || sizeClasses.sm} ${className}`}
    >
      {showDot && <span className={`${dotSizes[size] || dotSizes.sm} rounded-full bg-current opacity-70 shrink-0`} />}
      {status}
    </span>
  );
}

export { STATUS_STYLES };
