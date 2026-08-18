/**
 * Shared UI Components — Barrel Export
 *
 * Import from '@/shared/design-system/components' for all reusable UI primitives.
 * These components are domain-agnostic and used across multiple features.
 */

// Core Primitives (Brand System)
export * from '../ui/Button';
export * from '../ui/Card';
export * from '../ui/Input';
export * from '../ui/Badge';
export * from '../ui/Table';

// Layout & Navigation
export { default as AppShell } from './AppShell';
export { default as Sidebar } from './Sidebar';
export { default as PageHeader } from './PageHeader';

// Data Display
export { default as StatsCard } from './StatsCard';
export { default as Pagination } from './Pagination';
export { default as StatusBadge } from './StatusBadge';
export { default as ATSBadge } from './ATSBadge';

// Feedback & Overlays
export { default as NotificationCenter } from './NotificationCenter';
export { default as CommandPalette } from './CommandPalette';
export { default as ConfirmDialog } from './ConfirmDialog';

// Effects
export { default as Ripple } from './Ripple';

// State Messages
export { EmptyState, ErrorState } from './StateMessages';

// Loading States
export {
  StatsCardSkeleton,
  JobCardSkeleton,
  KanbanCardSkeleton,
  ListRowSkeleton,
  CalendarGridSkeleton,
  DashboardPipelineSkeleton,
  ProfileSkeleton,
  SettingsSkeleton,
} from './Skeletons';
