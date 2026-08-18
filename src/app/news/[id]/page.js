'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Globe, Link2, ExternalLink,
  Calendar, Shield, Newspaper, Share2, AlignLeft
} from 'lucide-react';
import { useNewsEvent } from '@/features/intelligence/hooks/useIntelligence';
import { VerificationBadge } from '@/features/intelligence/components/IntelligenceComponents';
import { sanitizeHtml } from '@/shared/utils/sanitize';

export default function NewsDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const { event, isLoading } = useNewsEvent(id);

  if (isLoading) return <LoadingSkeleton />;
  if (!event) return <NotFound />;

  const company = event.companies;
  const category = event.category || 'other';

  return (
    <div className="p-3 md:p-5 w-full h-full flex flex-col gap-3 overflow-hidden">
      
      {/* ── Navigation ── */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={() => router.push('/news')}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--c-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Feed
        </button>
        <div className="flex items-center gap-2">
          {event.source_url && (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 h-7 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-primary)] hover:border-[var(--c-primary)] transition-colors"
            >
              <ExternalLink size={10} /> Original Source
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        
        {/* ═══════ News Header Card ═══════ */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 md:p-6">
          <div className="max-w-4xl space-y-4">
            {/* Meta Row */}
            <div className="flex flex-wrap items-center gap-3">
              <CategoryBadge category={category} />
              <VerificationBadge status={event.verification_status} score={event.confidence_score} />
              {event.event_date && (
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-semibold tabular-nums">
                  <Calendar size={11} />
                  {new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>

            {/* Headline */}
            <h1 className="text-[20px] md:text-[24px] font-black text-[var(--text-primary)] leading-snug">
              {event.headline}
            </h1>

            {/* Quick Stats (Funding etc) */}
            {(event.funding_amount || event.investors?.length > 0) && (
              <div className="flex flex-wrap gap-4 pt-2">
                {event.funding_amount && (
                  <div className="bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] px-3 py-1.5 rounded-sm">
                    <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70 mb-0.5">Funding Amount</p>
                    <p className="text-[16px] font-black text-emerald-400 tabular-nums leading-none">
                      ${formatAmount(event.funding_amount)}
                    </p>
                  </div>
                )}
                {event.investors?.length > 0 && (
                  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-sm">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Key Investors</p>
                    <p className="text-[11px] font-bold text-[var(--text-primary)] leading-none mt-1">
                      {event.investors.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══════ Main Content Grid ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Left Column: Article Summary / Body ── */}
          <div className="lg:col-span-2 space-y-4">
            {event.summary && (
              <Section title="Intelligence Briefing" icon={AlignLeft} iconColor="text-blue-400">
                <div className="p-4 md:p-5">
                  <div 
                    className="text-[13px] md:text-[14px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap [&>p]:mb-3 last:[&>p]:mb-0 [&_a]:text-blue-500 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.summary) }}
                  />
                </div>
              </Section>
            )}

            {/* Raw Extracted Data (if available) */}
            {event.metadata?.raw_extraction && (
              <Section title="Extracted Entities" icon={Shield} iconColor="text-[var(--text-muted)]">
                <div className="p-4 bg-[var(--bg-elevated)] overflow-x-auto">
                  <pre className="text-[10px] text-[var(--text-muted)] font-mono">
                    {JSON.stringify(event.metadata.raw_extraction, null, 2)}
                  </pre>
                </div>
              </Section>
            )}
          </div>

          {/* ── Right Column: Sidebar ── */}
          <div className="space-y-4">
            
            {/* Related Company */}
            {company ? (
              <Section title="Mentioned Entity" icon={Building2} iconColor="text-amber-400">
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="text-[14px] font-black text-[var(--c-primary)]">
                          {(company.canonical_name || '?')[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/fundings/${company.id}`} className="text-[13px] font-black text-[var(--text-primary)] hover:text-[var(--c-primary)] transition-colors truncate block">
                        {company.canonical_name}
                      </Link>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {company.industry || 'Unknown Industry'} {company.is_indian && '🇮🇳'}
                      </p>
                    </div>
                  </div>
                  
                  {company.description && (
                    <p className="text-[10px] text-[var(--text-secondary)] line-clamp-3">
                      {company.description}
                    </p>
                  )}

                  <div className="pt-2 flex flex-col gap-1.5">
                    {company.total_funding > 0 && (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[var(--text-muted)]">Total Funding</span>
                        <span className="font-bold text-emerald-400 tabular-nums">${formatAmount(company.total_funding)}</span>
                      </div>
                    )}
                    {company.stage && (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[var(--text-muted)]">Stage</span>
                        <span className="font-bold text-[var(--text-primary)]">{company.stage}</span>
                      </div>
                    )}
                  </div>

                  <Link 
                    href={`/fundings/${company.id}`}
                    className="flex items-center justify-center w-full h-8 mt-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-primary)] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)] transition-colors"
                  >
                    View Company Profile
                  </Link>
                </div>
              </Section>
            ) : (
              <Section title="Mentioned Entity" icon={Building2} iconColor="text-[var(--text-muted)]">
                <div className="p-4 flex flex-col items-center justify-center gap-2 py-8 opacity-50">
                  <Building2 size={24} className="text-[var(--text-muted)]" />
                  <p className="text-[10px] text-[var(--text-muted)] text-center">No primary company entity linked to this event.</p>
                </div>
              </Section>
            )}

            {/* Source Information */}
            <Section title="Sources" icon={Share2} iconColor="text-cyan-400">
              <div className="p-3 space-y-2">
                <div className="p-2.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Primary Source</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{event.source_name || 'Unknown'}</span>
                    {event.source_url && (
                      <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--c-primary)]">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                {event.additional_sources?.length > 0 && (
                  <div className="p-2.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Additional Citations</p>
                    <div className="flex flex-col gap-1.5">
                      {event.additional_sources.map((src, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
                          <div className="w-1 h-1 bg-[var(--text-muted)] shrink-0" />
                          <span className="truncate">{src}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Sub-components ───────────────────────────────────────────────────

function Section({ title, icon: Icon, iconColor = 'text-[var(--c-primary)]', count, children }) {
  return (
    <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
      <div className="p-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h2 className="text-[11px] font-black text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
          <Icon size={12} className={iconColor} />
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-[9px] font-black text-[var(--text-muted)] tabular-nums bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-0.5 leading-none">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function CategoryBadge({ category }) {
  const styles = {
    funding: { bg: 'rgba(16,185,129,0.1)', text: 'rgb(52,211,153)', border: 'rgba(16,185,129,0.3)' },
    hiring: { bg: 'rgba(59,130,246,0.1)', text: 'rgb(96,165,250)', border: 'rgba(59,130,246,0.3)' },
    growth: { bg: 'rgba(168,85,247,0.1)', text: 'rgb(192,132,252)', border: 'rgba(168,85,247,0.3)' },
    product: { bg: 'rgba(6,182,212,0.1)', text: 'rgb(34,211,238)', border: 'rgba(6,182,212,0.3)' },
    partnership: { bg: 'rgba(99,102,241,0.1)', text: 'rgb(129,140,248)', border: 'rgba(99,102,241,0.3)' },
    ma: { bg: 'rgba(236,72,153,0.1)', text: 'rgb(244,114,182)', border: 'rgba(236,72,153,0.3)' },
    workforce: { bg: 'rgba(239,68,68,0.1)', text: 'rgb(248,113,113)', border: 'rgba(239,68,68,0.3)' },
    leadership: { bg: 'rgba(245,158,11,0.1)', text: 'rgb(251,191,36)', border: 'rgba(245,158,11,0.3)' },
    other: { bg: 'rgba(107,114,128,0.1)', text: 'rgb(156,163,175)', border: 'rgba(107,114,128,0.3)' },
  };
  const catStyle = styles[category] || styles.other;
  return (
    <span 
      className="px-2 py-1 text-[9px] font-black uppercase tracking-widest border leading-none"
      style={{ backgroundColor: catStyle.bg, color: catStyle.text, borderColor: catStyle.border }}
    >
      {category}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 md:p-5 w-full h-full space-y-4">
      <div className="h-4 w-24 bg-[var(--bg-elevated)] animate-pulse" />
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 space-y-4">
        <div className="h-5 w-32 bg-[var(--bg-elevated)] animate-pulse" />
        <div className="h-8 w-3/4 bg-[var(--bg-elevated)] animate-pulse" />
        <div className="h-4 w-1/2 bg-[var(--bg-elevated)] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2 h-96 bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
        <div className="h-96 bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="p-5 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
      <Newspaper size={40} className="text-[var(--text-muted)] mb-3" />
      <h2 className="text-[16px] font-black text-[var(--text-primary)]">Intelligence Not Found</h2>
      <p className="text-[11px] text-[var(--text-muted)] mt-1">The intelligence signal you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/news" className="mt-4 text-[11px] font-bold text-[var(--c-primary)] hover:underline">
        ← Back to Feed
      </Link>
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
