'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Filter, Search, ChevronDown, ExternalLink,
  RefreshCw, DollarSign, Building2, Globe, Zap, ChevronLeft,
  ChevronRight, LinkIcon
} from 'lucide-react';
import { Button } from '@/shared/design-system/ui/Button';
import { useFundings } from '@/features/intelligence/hooks/useIntelligence';
import { VerificationBadge } from '@/features/intelligence/components/IntelligenceComponents';

const ROUND_OPTIONS = [
  { value: '', label: 'All Rounds' },
  { value: 'pre-seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B' },
  { value: 'series-c', label: 'Series C' },
  { value: 'series-d', label: 'Series D+' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'undisclosed', label: 'Undisclosed' },
];

const STAGE_OPTIONS = [
  { value: '', label: 'All Stages' },
  { value: 'pre-seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'early', label: 'Early Stage' },
  { value: 'growth', label: 'Growth' },
  { value: 'late', label: 'Late Stage' },
];

const PAGE_SIZE = 30;

const ROUND_COLORS = {
  'pre-seed': { bg: 'rgba(168,85,247,0.12)', text: 'rgb(192,132,252)', border: 'rgba(168,85,247,0.3)' },
  'seed': { bg: 'rgba(34,197,94,0.12)', text: 'rgb(74,222,128)', border: 'rgba(34,197,94,0.3)' },
  'series-a': { bg: 'rgba(59,130,246,0.12)', text: 'rgb(96,165,250)', border: 'rgba(59,130,246,0.3)' },
  'series-b': { bg: 'rgba(99,102,241,0.12)', text: 'rgb(129,140,248)', border: 'rgba(99,102,241,0.3)' },
  'series-c': { bg: 'rgba(236,72,153,0.12)', text: 'rgb(244,114,182)', border: 'rgba(236,72,153,0.3)' },
  'series-d': { bg: 'rgba(245,158,11,0.12)', text: 'rgb(251,191,36)', border: 'rgba(245,158,11,0.3)' },
  'bridge': { bg: 'rgba(107,114,128,0.12)', text: 'rgb(156,163,175)', border: 'rgba(107,114,128,0.3)' },
  'ipo': { bg: 'rgba(16,185,129,0.12)', text: 'rgb(52,211,153)', border: 'rgba(16,185,129,0.3)' },
};

function getRoundColor(round) {
  if (!round) return ROUND_COLORS['bridge'];
  const key = round.toLowerCase().replace(/\s+/g, '-');
  return ROUND_COLORS[key] || ROUND_COLORS['bridge'];
}

function extractDomain(url) {
  if (!url) return null;
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', ''); }
  catch { return null; }
}

export default function FundingsPage() {
  const [filters, setFilters] = useState({
    region: '',
    round: '',
    stage: '',
    search: '',
    sort: 'date',
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);

  const { fundings, total, hasMore, isLoading, mutate } = useFundings(filters);

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
      setRefreshResult(data.success ? `✓ ${data.stats?.fundingRoundsStored || 0} funding + ${data.stats?.newsEventsStored || 0} news` : '✗ Failed');
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

  const totalCapital = fundings.reduce((sum, f) => sum + (f.amount_usd || 0), 0);
  const uniqueCompanies = new Set(fundings.map(f => f.company_id).filter(Boolean)).size;
  const indianCount = fundings.filter(f => f.companies?.is_indian).length;

  return (
    <div className="p-3 md:p-5 w-full h-full flex flex-col gap-3 overflow-hidden">

      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-4 shrink-0 pb-1 border-b border-[var(--border-subtle)]/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
          <div>
            <h1 className="text-[20px] font-black text-[var(--text-primary)] leading-none tracking-tight">
              Startup Fundings
            </h1>
            <p className="text-[12px] text-[var(--text-muted)] mt-1.5 font-medium">
              Live funding intelligence · <span className="text-[var(--text-secondary)]">{total.toLocaleString()} events tracked</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {refreshResult && (
            <span className={`text-[11px] font-bold px-3 py-1.5 ${refreshResult.startsWith('✓') ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
              {refreshResult}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9 px-4 text-[11px] border-[var(--border-strong)]">
            <Filter size={14} className="mr-1.5" />
            Filters
          </Button>
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
        <StatBox label="Total Rounds" value={total} icon={DollarSign} color="text-indigo-400" accent="bg-indigo-500" />
        <StatBox label="Capital Raised" value={totalCapital ? `$${formatAmount(totalCapital)}` : '$0'} icon={TrendingUp} color="text-emerald-400" accent="bg-emerald-500" />
        <StatBox label="Companies" value={uniqueCompanies} icon={Building2} color="text-cyan-400" accent="bg-cyan-500" />
        <StatBox label="🇮🇳 India" value={indianCount} icon={Globe} color="text-amber-400" accent="bg-amber-500" />
      </div>

      {/* ═══ Toolbar: Search + Region + Sort ═══ */}
      <div className="flex items-center gap-3 shrink-0 py-1">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search companies, investors..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full h-9 pl-9 pr-4 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--c-primary)] focus:ring-1 focus:ring-[var(--c-primary)] focus:outline-none transition-all"
          />
        </div>

        {/* Region Toggle */}
        <div className="flex border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
          {['', 'india', 'global'].map(region => (
            <button
              key={region}
              onClick={() => setFilter('region', region)}
              className={`px-4 h-8 text-[11px] font-bold uppercase tracking-wider transition-all ${
                filters.region === region
                  ? 'bg-[var(--text-primary)] text-[var(--bg-base)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {region === '' ? 'All' : region === 'india' ? '🇮🇳 India' : '🌍 Global'}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={filters.sort}
            onChange={(e) => setFilter('sort', e.target.value)}
            className="h-9 px-3.5 pr-8 text-[11px] font-bold uppercase tracking-wider bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] appearance-none cursor-pointer focus:outline-none focus:border-[var(--c-primary)] focus:ring-1 focus:ring-[var(--c-primary)] transition-all"
          >
            <option value="date">Latest First</option>
            <option value="amount">Largest Amount</option>
            <option value="company">A-Z Name</option>
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* ═══ Advanced Filters ═══ */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0">
          <FilterSelect label="Round" value={filters.round} options={ROUND_OPTIONS} onChange={v => setFilter('round', v)} />
          <FilterSelect label="Stage" value={filters.stage} options={STAGE_OPTIONS} onChange={v => setFilter('stage', v)} />
          <FilterInput label="Investor" placeholder="Search investors..." value={filters.investor || ''} onChange={v => setFilter('investor', v)} />
          <FilterInput label="Location" placeholder="City or country..." value={filters.location || ''} onChange={v => setFilter('location', v)} />
        </div>
      )}

      {/* ═══ Funding Feed (Grid Layout) ═══ */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4 mt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
            ))
          ) : fundings.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                <TrendingUp size={20} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-[13px] font-bold text-[var(--text-secondary)]">No funding data yet</p>
              <p className="text-[11px] text-[var(--text-muted)]">Click &quot;Deep Scan&quot; to discover funding events</p>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <Zap size={12} />
                {isRefreshing ? 'Scanning...' : 'Start Discovery'}
              </Button>
            </div>
          ) : (
            fundings.map((funding) => {
              const company = funding.companies;
              const domain = extractDomain(company?.website);
              const roundColor = getRoundColor(funding.round_type);
              
              return (
                <div
                  key={funding.id}
                  className="group flex flex-col bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--c-primary)]/40 transition-all h-full"
                >
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    
                    {/* Top Row: Round + Date */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="px-2 py-1 text-[9px] font-black uppercase tracking-widest border leading-none"
                        style={{ backgroundColor: roundColor.bg, color: roundColor.text, borderColor: roundColor.border }}
                      >
                        {funding.round_type?.replace(/-/g, ' ') || 'Unknown Round'}
                      </span>
                      <span className="text-[9px] text-[var(--text-muted)] tabular-nums font-semibold">
                        {funding.funding_date
                          ? new Date(funding.funding_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>

                    {/* Company Ribbon */}
                    <div className="flex items-center gap-3">
                      <Link href={`/fundings/${company?.id || funding.company_id}`} className="shrink-0 group/logo block">
                        <div className="w-12 h-12 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden group-hover/logo:border-[var(--c-primary)] transition-colors">
                          {company?.logo_url ? (
                            <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1.5" />
                          ) : (
                            <span className="text-[14px] font-black text-[var(--c-primary)]">
                              {(company?.canonical_name || '?')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                      </Link>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <Link href={`/fundings/${company?.id || funding.company_id}`} className="block group/link">
                          <h3 className="text-[14px] font-black text-[var(--text-primary)] truncate group-hover/link:text-[var(--c-primary)] transition-colors">
                            {company?.canonical_name || 'Unknown'}
                            {company?.is_indian && <span className="ml-1 text-[10px]">🇮🇳</span>}
                          </h3>
                        </Link>
                        {company?.industry && (
                          <p className="text-[10px] text-[var(--text-secondary)] truncate">{company.industry}</p>
                        )}
                        {domain && (
                          <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[9px] text-[var(--text-muted)] hover:text-[var(--c-primary)] mt-0.5 truncate w-fit">
                            <LinkIcon size={8} /> {domain}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Funding Amount */}
                    <div className="mt-1 flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Raised Amount</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[24px] font-black text-emerald-400 tabular-nums leading-none">
                          {funding.amount_usd ? `$${formatAmount(funding.amount_usd)}` : 'Undisclosed'}
                        </span>
                        {funding.currency && funding.currency !== 'USD' && funding.amount_usd && (
                          <span className="text-[10px] text-[var(--text-muted)] font-bold">({funding.currency})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1" />

                    {/* Investors & Meta */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)] mt-2">
                      <div>
                        <p className="text-[7px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Lead Investor</p>
                        <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                          {funding.lead_investor || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[7px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Location</p>
                        <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                          {company?.location || '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Meta */}
                  <div className="bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] px-3 py-2 flex items-center justify-between text-[9px]">
                    <VerificationBadge status={funding.verification_status} />
                    {funding.job_count > 0 ? (
                      <span className="text-emerald-400 font-bold bg-emerald-400/10 px-1.5 py-0.5">
                        {funding.job_count} Jobs
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]/50">No Jobs</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* Table Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 shrink-0">
          <span className="text-[10px] text-[var(--text-muted)]">
            {fundings.length} of {total.toLocaleString()} events · {new Set(fundings.flatMap(f => f.source_urls || []).filter(Boolean)).size} sources
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

function FilterSelect({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-7 px-2 pr-7 text-[10px] bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] appearance-none cursor-pointer focus:outline-none focus:border-[var(--c-primary)]"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      </div>
    </div>
  );
}

function FilterInput({ label, placeholder, value, onChange }) {
  return (
    <div>
      <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 px-2 text-[10px] bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--c-primary)]"
      />
    </div>
  );
}

function formatAmount(amount) {
  if (!amount) return '0';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}
