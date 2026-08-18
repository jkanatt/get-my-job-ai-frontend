/**
 * Centralized Application Status Configuration — Single Source of Truth
 * 
 * All application statuses, their visual styles, icons, and mappings live here.
 * Used by Tracker (Kanban), StatusBadge, DashboardCharts, and detail modals.
 */
import {
  Send, Eye, MessageCircle, Target, Ban, CheckCircle2, FileText, Bookmark,
} from 'lucide-react';

// ─── Canonical status values ────────────────────────────────────
export const STATUSES = ['Sent', 'Viewed', 'Responded', 'Interview', 'Rejected', 'Offer'];

// ─── Extended statuses (includes non-kanban states) ─────────────
export const ALL_STATUSES = [...STATUSES, 'Draft', 'Saved'];

// ─── Status normalization map ───────────────────────────────────
// Maps variant DB statuses to canonical Kanban column names.
export const STATUS_NORMALIZE_MAP = {
  'Applied': 'Sent',
  'Delivered': 'Sent',
  'Clicked': 'Viewed',
  'Interviewing': 'Interview',
  'Passed': 'Rejected',
  'Ghosted': 'Rejected',
};

export function normalizeStatus(status) {
  return STATUS_NORMALIZE_MAP[status] || status;
}

// ─── Status → Visual Style Mapping ─────────────────────────────
// Uses CSS variables for theme-awareness. No hardcoded hex colors.
export const STATUS_STYLES = {
  Sent:      'bg-[var(--bg-surface)] text-[var(--text-primary)]/70 border-[var(--border-subtle)]',
  Viewed:    'bg-[var(--c-primary-soft)] text-[var(--c-secondary)] border-[var(--border-subtle)]',
  Responded: 'bg-[var(--c-primary-soft)] text-[var(--c-info)] border-[var(--border-subtle)]',
  Interview: 'bg-[var(--c-accent-soft)] text-[var(--c-accent)] border-[var(--border-subtle)]',
  Offer:     'bg-[var(--c-primary)] text-white border-[var(--c-primary)] shadow-sm',
  Rejected:  'bg-[var(--bg-surface)] text-[var(--c-danger)] border-[var(--border-subtle)]',
  Draft:     'bg-[var(--bg-surface)] text-[var(--text-primary)]/50 border-[var(--border-subtle)]',
  Saved:     'bg-[var(--bg-surface)] text-[var(--c-warning)] border-[var(--border-subtle)]',
};

export const STATUS_DEFAULT_STYLE = 'bg-[var(--bg-hover)] text-[var(--text-primary)]/50 border-[var(--border-subtle)]';

// ─── Status → Icon Mapping ──────────────────────────────────────
export const STATUS_ICONS = {
  Sent: Send,
  Viewed: Eye,
  Responded: MessageCircle,
  Interview: Target,
  Offer: CheckCircle2,
  Rejected: Ban,
  Draft: FileText,
  Saved: Bookmark,
};

// ─── Kanban column colors (CSS variable names) ──────────────────
export const KANBAN_COLUMN_COLORS = {
  Sent:      'var(--bg-kanban-sent)',
  Viewed:    'var(--bg-kanban-viewed)',
  Responded: 'var(--bg-kanban-responded)',
  Interview: 'var(--bg-kanban-interview)',
  Offer:     'var(--bg-kanban-offer)',
  Rejected:  'var(--bg-kanban-rejected)',
};

// ─── Tracking event → Status Badge Mapping ──────────────────────
// Used by Tracker to show the latest tracking event as a badge.
export const EVENT_BADGE_MAP = {
  REPLY_RECEIVED: { text: 'REPLY', color: 'bg-[#a855f7]', textColor: 'text-[var(--text-primary)]', icon: MessageCircle },
  CLICK:          { text: 'CLICK', color: 'bg-blue-500', textColor: 'text-[var(--text-primary)]', icon: Eye },
  SENT:           { text: 'SENT', color: 'bg-[#00E676]', textColor: 'text-black', icon: CheckCircle2 },
};

// ─── Fallback status → Badge Mapping ────────────────────────────
export const FALLBACK_BADGE_MAP = {
  Sent:      { text: 'SENT', color: 'bg-[#00E676]', textColor: 'text-black', icon: CheckCircle2 },
  Viewed:    { text: 'VIEWED', color: 'bg-purple-500', textColor: 'text-[var(--text-primary)]', icon: Eye },
  Responded: { text: 'REPLY', color: 'bg-[#a855f7]', textColor: 'text-[var(--text-primary)]', icon: MessageCircle },
  Interview: { text: 'INTERVIEW', color: 'bg-blue-500', textColor: 'text-[var(--text-primary)]', icon: Target },
  Rejected:  { text: 'REJECTED', color: 'bg-[var(--c-danger)]', textColor: 'text-white', icon: Ban },
  Offer:     { text: 'OFFER', color: 'bg-[#00E676]', textColor: 'text-black', icon: CheckCircle2 },
};
