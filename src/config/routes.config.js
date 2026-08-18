/**
 * Centralized Route Configuration — Single Source of Truth
 * 
 * All navigation routes, their labels, icons, and metadata are defined here.
 * Used by Sidebar, AppShell (auth redirect), CommandPalette, and breadcrumbs.
 */
import {
  LayoutDashboard, Search, Mail, KanbanSquare,
  Users, UserCircle, Settings, Sparkles,
  Calendar, History, Plug, Globe, TrendingUp, Newspaper
} from 'lucide-react';

// ─── Public routes (no auth required) ───────────────────────────
export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/onboarding',
  '/auth/callback',
];

/**
 * Check if a pathname is a public route (no auth required).
 * Handles both exact matches and route group prefixes.
 */
export function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.some(route => pathname === route) || pathname.startsWith('/(auth)');
}

// ─── Main navigation ────────────────────────────────────────────
export const MAIN_NAV = (counts = {}) => [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: Search },
  { href: '/inbox', label: 'Inbox', icon: Mail, badge: counts?.inbox || null },
  { href: '/tracker', label: 'Tracker', icon: KanbanSquare },
  { href: '/resume-history', label: 'Resumes', icon: History },

  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/portals', label: 'Portals', icon: Globe },
  { href: '/fundings', label: 'Fundings', icon: TrendingUp, tag: 'New' },
  { href: '/news', label: 'News', icon: Newspaper, tag: 'New' },
  { href: '/networking', label: 'Network', icon: Users, tag: 'Beta' },
  { href: '/architecture', label: 'Intelligence', icon: Sparkles, tag: 'Core' },
];

// ─── Account navigation ─────────────────────────────────────────
export const ACCOUNT_NAV = [
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/profile', label: 'Profile', icon: UserCircle },
  { href: '/settings', label: 'Settings', icon: Settings },
];
