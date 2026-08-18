'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Newspaper, Search, RefreshCw, ChevronDown, ExternalLink,
  Zap, TrendingUp, Building2, Users, Activity,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/shared/design-system/ui/Button';
import { useNews } from '@/features/intelligence/hooks/useIntelligence';
import { VerificationBadge } from '@/features/intelligence/components/IntelligenceComponents';

const CATEGORIES = [
  { value: 'all', label: 'All', icon: '📋' },
  { value: 'funding', label: 'Funding', icon: '💰' },
  { value: 'hiring', label: 'Hiring', icon: '👥' },
  { value: 'growth', label: 'Growth', icon: '🌱' },
  { value: 'product', label: 'Product', icon: '🚀' },
  { value: 'partnership', label: 'Partners', icon: '🤝' },
  { value: 'ma', label: 'M&A', icon: '🏢' },
  { value: 'workforce', label: 'Layoffs', icon: '⚠️' },
  { value: 'leadership', label: 'Leadership', icon: '👔' },
  { value: 'ipo', label: 'IPO', icon: '📈' },
];

const CATEGORY_STYLES = {
  funding: { bg: 'rgba(16,185,129,0.1)', text: 'rgb(52,211,153)', border: 'rgba(16,185,129,0.3)' },
  hiring: { bg: 'rgba(59,130,246,0.1)', text: 'rgb(96,165,250)', border: 'rgba(59,130,246,0.3)' },
  growth: { bg: 'rgba(168,85,247,0.1)', text: 'rgb(192,132,252)', border: 'rgba(168,85,247,0.3)' },
  product: { bg: 'rgba(6,182,212,0.1)', text: 'rgb(34,211,238)', border: 'rgba(6,182,212,0.3)' },
  partnership: { bg: 'rgba(99,102,241,0.1)', text: 'rgb(129,140,248)', border: 'rgba(99,102,241,0.3)' },
  ma: { bg: 'rgba(236,72,153,0.1)', text: 'rgb(244,114,182)', border: 'rgba(236,72,153,0.3)' },
  workforce: { bg: 'rgba(239,68,68,0.1)', text: 'rgb(248,113,113)', border: 'rgba(239,68,68,0.3)' },
  leadership: { bg: 'rgba(245,158,11,0.1)', text: 'rgb(251,191,36)', border: 'rgba(245,158,11,0.3)' },
  ipo: { bg: 'rgba(16,185,129,0.1)', text: 'rgb(52,211,153)', border: 'rgba(16,185,129,0.3)' },
  other: { bg: 'rgba(107,114,128,0.1)', text: 'rgb(156,163,175)', border: 'rgba(107,114,128,0.3)' },
};

const CATEGORY_LABELS = {
  funding: 'Funding', hiring: 'Hiring', growth: 'Growth', product: 'Product',
  partnership: 'Partnership', ma: 'M&A', workforce: 'Workforce', leadership: 'Leadership',
  ipo: 'IPO', other: 'Other',
};

const PAGE_SIZE = 20;

export default function NewsPage() {
  const [filters, setFilters] = useState({
    category: 'all',
    location: '',
    search: '',
    sort: 'date',
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);

  const { news, total, hasMore, categoryStats, isLoading, mutate } = useNews(filters);

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, offset: 0 }));
  }, []);

  const handlePageChange = useCallback((page) => {
    setFilters(prev => ({ ...prev, offset: (page - 1) * PAGE_SIZE }));
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch('/api/intelligence/scrape/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'deep' }),
      });
      const data = await res.json();
      setRefreshResult(data.success
        ? `✓ ${data.stats?.newsEventsStored || 0} events discovered`
        : '✗ Failed');
      await mutate();
    } catch {
      setRefreshResult('✗ Network error');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshResult(null), 8000);
    }
  }, [mutate]);

  const currentPage = Math.floor(filters.offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const totalNewsCount = Object.values(categoryStats).reduce((s, v) => s + v, 0);

  return (
    <div className="p-3 md:p-5 w-full h-full flex flex-col gap-3 overflow-hidden">

      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-4 shrink-0 pb-1 border-b border-[var(--border-subtle)]/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Activity size={20} className="text-indigo-500" />
          </div>
          <div>
            <h1 className="text-[20px] font-black text-[var(--text-primary)] leading-none tracking-tight">
              Intelligence Feed
            </h1>
            <p className="text-[12px] text-[var(--text-muted)] mt-1.5 font-medium">
              Real-time startup signals · <span className="text-[var(--text-secondary)]">{totalNewsCount.toLocaleString()} events tracked</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {refreshResult && (
            <span className={`text-[11px] font-bold px-3 py-1.5 ${refreshResult.startsWith('✓') ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
              {refreshResult}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 px-4 text-[11px] bg-[var(--text-primary)] text-[var(--bg-base)] hover:bg-[var(--text-secondary)]"
          >
            {isRefreshing ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : <Zap size={14} className="mr-1.5" />}
            {isRefreshing ? 'Scanning...' : 'Deep Scan'}
          </Button>
        </div>
      </div>

      {/* ═══ Stats Bar ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0 pt-1">
        <StatBox label="Total Events" value={totalNewsCount} icon={Activity} color="text-blue-400" accent="bg-blue-500" />
        <StatBox label="Funding News" value={categoryStats.funding || 0} icon={TrendingUp} color="text-emerald-400" accent="bg-emerald-500" />
        <StatBox label="Hiring Signals" value={categoryStats.hiring || 0} icon={Users} color="text-purple-400" accent="bg-purple-500" />
        <StatBox label="Companies" value={new Set(news.map(n => n.company_id).filter(Boolean)).size} icon={Building2} color="text-amber-400" accent="bg-amber-500" />
      </div>

      {/* ═══ Category Tabs ═══ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none shrink-0">
        {CATEGORIES.map(cat => {
          const count = cat.value === 'all' ? totalNewsCount : (categoryStats[cat.value] || 0);
          const isActive = filters.category === cat.value;

          return (
            <button
              key={cat.value}
              onClick={() => setFilter('category', cat.value)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                isActive
                  ? 'bg-[var(--text-primary)] text-[var(--bg-base)] shadow-sm'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span className="text-[12px] opacity-80">{cat.icon}</span>
              <span>{cat.label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-sm ${
                  isActive ? 'bg-[var(--bg-base)] text-[var(--text-primary)]/70' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                }`}>
                  {count > 999 ? '999+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ Toolbar: Search + Region + Sort ═══ */}
      <div className="flex items-center gap-3 shrink-0 py-1">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search news, companies, investors..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full h-9 pl-9 pr-4 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--c-primary)] focus:ring-1 focus:ring-[var(--c-primary)] focus:outline-none transition-all"
          />
        </div>

        <div className="flex border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
          {['', 'india', 'global'].map(loc => (
            <button
              key={loc}
              onClick={() => setFilter('location', loc)}
              className={`px-4 h-8 text-[11px] font-bold uppercase tracking-wider transition-all ${
                filters.location === loc
                  ? 'bg-[var(--text-primary)] text-[var(--bg-base)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {loc === '' ? 'All' : loc === 'india' ? '🇮🇳 India' : '🌍 Global'}
            </button>
          ))}
        </div>

        <div className="relative">
          <select
            value={filters.sort}
            onChange={(e) => setFilter('sort', e.target.value)}
            className="h-9 px-3.5 pr-8 text-[11px] font-bold uppercase tracking-wider bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] appearance-none cursor-pointer focus:outline-none focus:border-[var(--c-primary)] focus:ring-1 focus:ring-[var(--c-primary)] transition-all"
          >
            <option value="date">Latest First</option>
            <option value="relevance">By Confidence</option>
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* ═══ News Feed — scrollable ═══ */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <NewsCardSkeleton key={i} />)
          ) : news.length === 0 ? (
            <div className="col-span-full">
              <EmptyState onRefresh={handleRefresh} isRefreshing={isRefreshing} />
            </div>
          ) : (
            news.map(event => (
              <NewsItem key={event.id} event={event} />
            ))
          )}
        </div>
      </div>

      {/* ═══ Footer + Pagination ═══ */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between shrink-0 pt-1">
          <span className="text-[10px] text-[var(--text-muted)]">
            {news.length} of {total.toLocaleString()} events · {Object.keys(categoryStats).length} categories
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page;
                if (totalPages <= 7) page = i + 1;
                else if (currentPage <= 4) page = i + 1;
                else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                else page = currentPage - 3 + i;
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-7 h-7 flex items-center justify-center text-[10px] font-bold transition-colors ${
                      page === currentPage
                        ? 'bg-[var(--c-primary)] text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── News Item Card ────────────────────────────────────────────────────

function NewsItem({ event }) {
  const company = event.companies;
  const category = event.category || 'other';
  const catStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.other;
  const router = useRouter();

  return (
    <div 
      onClick={() => router.push(`/news/${event.id}`)}
      className="cursor-pointer group flex flex-col bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--c-primary)]/40 transition-all h-full"
    >
      <div className="p-3 flex-1 flex flex-col gap-2.5">
        
        {/* Top Header: Badge + Date */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="shrink-0 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest border leading-none"
            style={{ backgroundColor: catStyle.bg, color: catStyle.text, borderColor: catStyle.border }}
          >
            {CATEGORY_LABELS[category] || category}
          </span>
          <div className="flex items-center gap-1.5">
            <VerificationBadge status={event.verification_status} />
            {event.event_date && (
              <span className="text-[9px] text-[var(--text-muted)] tabular-nums font-semibold">
                {formatRelativeDate(event.event_date)}
              </span>
            )}
          </div>
        </div>

        {/* Company Ribbon (if exists) */}
        {company && (
          <Link
            href={`/fundings/${company.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-1.5 hover:border-[var(--c-primary)] transition-colors"
          >
            <div className="w-5 h-5 shrink-0 bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
              ) : (
                <span className="text-[8px] font-black text-[var(--c-primary)]">
                  {(company.canonical_name || '?')[0]}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-[var(--text-primary)] truncate">{company.canonical_name}</span>
                {company.is_indian && <span className="text-[9px] shrink-0">🇮🇳</span>}
              </div>
              {company.industry && (
                <span className="text-[8px] text-[var(--text-muted)] truncate">{company.industry}</span>
              )}
            </div>
          </Link>
        )}

        {/* Headline */}
        <div className="block group/link mt-1">
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] leading-snug group-hover:text-[var(--c-primary)] transition-colors line-clamp-3">
            {event.headline}
          </h3>
        </div>

        {/* Summary */}
        {event.summary && (
          <p className="text-[10px] text-[var(--text-muted)] line-clamp-3 leading-relaxed">
            {event.summary}
          </p>
        )}

        {/* Spacer to push footer down */}
        <div className="flex-1" />

        {/* Funding Ribbon (if exists) */}
        {event.funding_amount && (
          <div className="pt-2 mt-2 border-t border-[var(--border-subtle)] flex items-end justify-between gap-2">
            <div>
              <p className="text-[7px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Funding</p>
              <span className="text-[14px] font-black text-emerald-400 tabular-nums leading-none">
                ${formatAmount(event.funding_amount)}
              </span>
            </div>
            {event.investors?.length > 0 && (
              <div className="text-right min-w-0">
                <p className="text-[7px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Investors</p>
                <span className="text-[9px] text-[var(--text-secondary)] truncate block w-[100px]">
                  {event.investors.slice(0, 2).join(', ')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Meta */}
      <div className="bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] px-3 py-2 flex items-center justify-between text-[9px]">
        <div className="flex items-center gap-2">
          {event.source_url ? (
            <a href={event.source_url} onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--text-muted)] hover:text-[var(--c-primary)] flex items-center gap-1 transition-colors z-10 relative">
              <ExternalLink size={9} /> {event.source_name || 'Source'}
            </a>
          ) : (
            <span className="font-bold text-[var(--text-muted)]">{event.source_name || 'Source'}</span>
          )}
        </div>
        {event.confidence_score > 0 && (
          <span className="text-[var(--text-muted)] tabular-nums font-semibold">{event.confidence_score}% Conf</span>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function StatBox({ label, value, icon: Icon, color, accent }) {
  return (
    <div className="relative overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 flex flex-col justify-between h-[84px] hover:border-[var(--border-strong)] transition-colors group">
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${accent} opacity-70 group-hover:opacity-100 transition-opacity`} />
      <div className="flex items-center justify-between pl-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
        <Icon size={14} className={color} />
      </div>
      <p className={`text-[24px] font-black tabular-nums leading-none tracking-tight pl-2 ${color}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-14 bg-[var(--bg-elevated)] animate-pulse" />
        <div className="h-3.5 w-20 bg-[var(--bg-elevated)] animate-pulse" />
      </div>
      <div className="h-4 w-[75%] bg-[var(--bg-elevated)] animate-pulse" />
      <div className="h-3 w-[55%] bg-[var(--bg-elevated)] animate-pulse" />
    </div>
  );
}

function EmptyState({ onRefresh, isRefreshing }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
      <div className="w-12 h-12 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
        <Newspaper size={20} className="text-[var(--text-muted)]" />
      </div>
      <p className="text-[13px] font-bold text-[var(--text-secondary)]">No intelligence data yet</p>
      <p className="text-[11px] text-[var(--text-muted)]">Click Deep Scan to discover signals</p>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
        <Zap size={12} />
        {isRefreshing ? 'Scanning...' : 'Start Discovery'}
      </Button>
    </div>
  );
}

// ─── Utilities ─────────────────────────────────────────────────────────

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatAmount(amount) {
  if (!amount) return '0';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}
