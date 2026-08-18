'use client';

/**
 * Verification Badge — Visual indicator of data verification status
 */
export function VerificationBadge({ status, score, className = '' }) {
  const config = {
    confirmed: { label: 'Confirmed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: '✓' },
    high_confidence: { label: 'High Confidence', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: '◉' },
    estimated: { label: 'Estimated', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: '≈' },
    inferred: { label: 'Inferred', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: '~' },
    unverified: { label: 'Unverified', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg-elevated)]', border: 'border-[var(--border-subtle)]', icon: '?' },
  };

  const cfg = config[status] || config.unverified;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.border} ${cfg.color} ${className}`}>
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
      {score !== undefined && <span className="opacity-60">{score}%</span>}
    </span>
  );
}

/**
 * Signal Badges — Job-seeker intelligence indicators
 */
export function SignalBadges({ signals = [], max = 5, className = '' }) {
  const displayed = signals.slice(0, max);

  const priorityStyles = {
    high: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    medium: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    low: 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]',
    warning: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {displayed.map((signal, i) => (
        <span
          key={`${signal.type}-${i}`}
          className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider border ${priorityStyles[signal.priority] || priorityStyles.low}`}
          title={signal.detail}
        >
          <span>{signal.icon}</span>
          <span>{signal.label}</span>
        </span>
      ))}
      {signals.length > max && (
        <span className="inline-flex items-center px-2 py-1 text-[10px] font-bold text-[var(--text-muted)]">
          +{signals.length - max} more
        </span>
      )}
    </div>
  );
}

/**
 * Compact Company Card — For lists and grids
 */
export function CompanyCard({ company, funding, signals = [], jobCount = 0, onClick }) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 cursor-pointer hover:border-[var(--c-primary)]/40 hover:bg-[var(--bg-hover)] transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
          {company.logo_url ? (
            <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1" />
          ) : (
            <span className="text-[14px] font-bold text-[var(--c-primary)]">
              {(company.canonical_name || '?')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--c-primary)] transition-colors">
            {company.canonical_name}
          </h3>
          <p className="text-[11px] text-[var(--text-muted)] truncate">
            {[company.industry, company.location].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* Funding info */}
      {funding && (
        <div className="flex items-center gap-2 mb-3">
          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--c-primary-soft)] text-[var(--c-primary)] border border-[rgba(99,102,241,0.3)]">
            {funding.round_type?.replace(/-/g, ' ') || 'Funding'}
          </span>
          {funding.amount_usd && (
            <span className="text-[13px] font-bold text-[var(--text-primary)]">
              ${formatAmountShort(funding.amount_usd)}
            </span>
          )}
          {funding.funding_date && (
            <span className="text-[11px] text-[var(--text-muted)]">
              {new Date(funding.funding_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
        {jobCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            {jobCount} jobs
          </span>
        )}
        {company.stage && (
          <span className="capitalize">{company.stage}</span>
        )}
        {company.employee_count && (
          <span>{company.employee_count} employees</span>
        )}
      </div>

      {/* Signals */}
      {signals.length > 0 && (
        <div className="mt-3">
          <SignalBadges signals={signals} max={3} />
        </div>
      )}
    </div>
  );
}

/**
 * Investor Card — Compact investor profile
 */
export function InvestorCard({ investor }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 hover:border-[var(--border-strong)] transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
          {investor.logo_url ? (
            <img src={investor.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
          ) : (
            <span className="text-[11px] font-bold text-[var(--c-secondary)]">
              {(investor.name || '?')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-bold text-[var(--text-primary)] truncate">
            {investor.name}
          </h4>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
            {investor.type?.replace(/-/g, ' ') || 'Investor'}
          </p>
        </div>
      </div>
      {investor.focus_industries?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {investor.focus_industries.slice(0, 3).map(ind => (
            <span key={ind} className="text-[9px] px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
              {ind}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * News Card — Single news event
 */
export function NewsCard({ event, onClick }) {
  const categoryColors = {
    funding: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    hiring: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    growth: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    product: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    partnership: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    ma: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    workforce: 'bg-red-500/10 text-red-400 border-red-500/30',
    leadership: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    ipo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    other: 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]',
  };

  const categoryLabels = {
    funding: 'Funding', hiring: 'Hiring', growth: 'Growth', product: 'Product',
    partnership: 'Partnership', ma: 'M&A', workforce: 'Workforce', leadership: 'Leadership',
    ipo: 'IPO', other: 'Other',
  };

  const company = event.companies;

  return (
    <div
      onClick={onClick}
      className="group bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] transition-all duration-200"
    >
      {/* Category + Date */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${categoryColors[event.category] || categoryColors.other}`}>
          {categoryLabels[event.category] || event.category}
        </span>
        <div className="flex items-center gap-2">
          <VerificationBadge status={event.verification_status} />
          {event.event_date && (
            <span className="text-[11px] text-[var(--text-muted)]">
              {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Company */}
      {company && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[8px] font-bold text-[var(--c-primary)]">
                {(company.canonical_name || '?')[0]}
              </span>
            )}
          </div>
          <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
            {company.canonical_name}
          </span>
          {company.industry && (
            <span className="text-[10px] text-[var(--text-muted)]">· {company.industry}</span>
          )}
        </div>
      )}

      {/* Headline */}
      <h3 className="text-[14px] font-bold text-[var(--text-primary)] leading-snug mb-2 line-clamp-2 group-hover:text-[var(--c-primary)] transition-colors">
        {event.headline}
      </h3>

      {/* Summary */}
      {event.summary && (
        <p className="text-[12px] text-[var(--text-muted)] line-clamp-2 mb-3 leading-relaxed">
          {event.summary}
        </p>
      )}

      {/* Funding amount if applicable */}
      {event.funding_amount && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px] font-bold text-emerald-400">
            ${formatAmountShort(event.funding_amount)}
          </span>
          {event.investors?.length > 0 && (
            <span className="text-[11px] text-[var(--text-muted)]">
              by {event.investors.slice(0, 2).join(', ')}
              {event.investors.length > 2 && ` +${event.investors.length - 2}`}
            </span>
          )}
        </div>
      )}

      {/* Source */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>{event.source_name}</span>
        {event.confidence_score > 0 && (
          <span>Confidence: {event.confidence_score}%</span>
        )}
      </div>
    </div>
  );
}

/**
 * Stats Overview — Top-level metrics cards
 */
export function StatsOverview({ stats = {} }) {
  const items = [
    { label: 'Total Fundings', value: stats.totalFundings || 0, color: 'text-[var(--c-primary)]' },
    { label: 'Capital Raised', value: stats.totalCapital ? `$${formatAmountShort(stats.totalCapital)}` : '$0', color: 'text-emerald-400' },
    { label: 'Companies', value: stats.totalCompanies || 0, color: 'text-[var(--c-secondary)]' },
    { label: 'India', value: stats.indianCount || 0, color: 'text-amber-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(item => (
        <div key={item.label} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{item.label}</p>
          <p className={`text-[22px] font-black tabular-nums ${item.color}`}>
            {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Utility ───────────────────────────────────────────────────────────

function formatAmountShort(amount) {
  if (!amount) return '0';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}
