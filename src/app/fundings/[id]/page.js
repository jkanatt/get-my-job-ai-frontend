'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Globe, Link2, RefreshCw, Zap,
  Users, MapPin, Calendar, TrendingUp, ExternalLink,
  Briefcase, ChevronRight, DollarSign, Newspaper,
  Shield, Activity, BarChart3, Clock, Layers, Code, Swords, Package
} from 'lucide-react';
import { Button } from '@/shared/design-system/ui/Button';
import { useCompanyIntelligence } from '@/features/intelligence/hooks/useIntelligence';
import { VerificationBadge, SignalBadges } from '@/features/intelligence/components/IntelligenceComponents';

export default function CompanyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const {
    company, fundingHistory, people, investors,
    newsEvents, jobs, hiringMetrics, signals,
    timeline, isLoading, mutate
  } = useCompanyIntelligence(id);

  const handleDeepScan = useCallback(async () => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/intelligence/scrape/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'enrich',
          companyId: id,
        }),
      });
      const data = await res.json();
      setScanResult(data.success ? 'success' : 'error');
      await mutate();
    } catch {
      setScanResult('error');
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanResult(null), 5000);
    }
  }, [id, mutate]);

  if (isLoading) return <LoadingSkeleton />;
  if (!company) return <NotFound />;

  const founders = people.filter(p => p.is_founder);
  const executives = people.filter(p => !p.is_founder && p.is_current);
  const totalFunding = company.total_funding || 0;
  const latestRound = fundingHistory?.[0] || null;

  // Enrichment metadata from Deep Scan
  const enrichment = company.metadata?.enrichment || {};
  const enrichedFounders = enrichment.founders || [];
  const enrichedProducts = enrichment.products || [];
  const enrichedCompetitors = enrichment.competitors || [];
  const enrichedTechStack = enrichment.techStack || [];
  const enrichedCareers = company.metadata?.careers || {};

  return (
    <div className="p-3 md:p-5 w-full h-full flex flex-col gap-3 overflow-hidden">
      
      {/* ── Navigation + Actions ── */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={() => router.push('/fundings')}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--c-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Fundings
        </button>
        <div className="flex items-center gap-1.5">
          {scanResult && (
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 ${scanResult === 'success' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
              {scanResult === 'success' ? '✓ Scan Complete' : '✗ Scan Failed'}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDeepScan}
            disabled={isScanning}
            className="h-7 text-[10px]"
          >
            {isScanning ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
            {isScanning ? 'Enriching...' : 'Deep Enrich'}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        {/* ═══════ Company Header Card ═══════ */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 md:p-5">
          <div className="flex flex-col md:flex-row items-start gap-4">
            {/* Logo */}
            <div className="w-12 h-12 shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-[18px] font-black text-[var(--c-primary)]">
                  {(company.canonical_name || '?')[0]}
                </span>
              )}
            </div>

            {/* Company Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap leading-none">
                <h1 className="text-[18px] font-black text-[var(--text-primary)]">
                  {company.canonical_name}
                </h1>
                {company.stage && (
                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-[var(--c-primary-soft)] text-[var(--c-primary)] border border-[rgba(99,102,241,0.4)]">
                    {company.stage}
                  </span>
                )}
                {company.is_indian && <span className="text-[12px]">🇮🇳</span>}
              </div>

              {company.description && (
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed max-w-3xl">
                  {company.description}
                </p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--text-muted)]">
                {company.industry && <span className="flex items-center gap-1"><Building2 size={10} />{company.industry}</span>}
                {company.domain && <span className="flex items-center gap-1 font-mono"><Globe size={10} />{company.domain}</span>}
                {company.location && <span className="flex items-center gap-1"><MapPin size={10} />{company.location}</span>}
                {company.founded_year && <span className="flex items-center gap-1"><Calendar size={10} />Est. {company.founded_year}</span>}
                {company.employee_count && <span className="flex items-center gap-1"><Users size={10} />{company.employee_count} employees</span>}
              </div>

              {/* External Links */}
              <div className="flex flex-wrap items-center gap-1 pt-1">
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)] transition-colors">
                    <Globe size={9} /> Website
                  </a>
                )}
                {company.linkedin_url && (
                  <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500 hover:text-blue-400 transition-colors">
                    <Link2 size={9} /> LinkedIn
                  </a>
                )}
                {company.twitter_url && (
                  <a href={company.twitter_url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-sky-500 hover:text-sky-400 transition-colors">
                    <span className="text-[10px] leading-none">𝕏</span> Twitter
                  </a>
                )}
              </div>

              {/* Signals */}
              {signals.length > 0 && (
                <div className="pt-1">
                  <SignalBadges signals={signals} max={6} />
                </div>
              )}
            </div>

            {/* Funding Summary Stat */}
            <div className="shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 min-w-[140px]">
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Total Raised</p>
              <p className="text-[20px] font-black text-emerald-400 tabular-nums leading-none">
                ${formatAmount(totalFunding)}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                {fundingHistory.length} round{fundingHistory.length !== 1 ? 's' : ''}
              </p>
              {latestRound?.funding_date && (
                <p className="text-[9px] text-[var(--text-muted)] mt-0.5 font-semibold">
                  Latest: {new Date(latestRound.funding_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════ Overview Stats Bar ═══════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <StatCard label="Funding Rounds" value={fundingHistory.length} icon={DollarSign} color="text-emerald-400" bg="bg-emerald-400/8" />
          <StatCard label="News Events" value={newsEvents.length} icon={Newspaper} color="text-blue-400" bg="bg-blue-400/8" />
          <StatCard label="Open Jobs" value={jobs.length} icon={Briefcase} color="text-purple-400" bg="bg-purple-400/8" />
          <StatCard label="Key People" value={people.length} icon={Users} color="text-amber-400" bg="bg-amber-400/8" />
          <StatCard label="Timeline Events" value={timeline.length} icon={Clock} color="text-cyan-400" bg="bg-cyan-400/8" />
          <StatCard label="Confidence" value={latestRound ? `${latestRound.confidence_score || 0}%` : '—'} icon={Shield} color="text-[var(--c-primary)]" bg="bg-[var(--c-primary-soft)]" />
        </div>

        {/* ═══════ Main Content Grid ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Left Column: Funding History + Jobs + News ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Funding History */}
            <Section title="Funding History" icon={DollarSign} iconColor="text-emerald-400" count={fundingHistory.length}>
              {fundingHistory.length === 0 ? (
                <EmptyState icon={DollarSign} message="No funding rounds discovered yet" sub="Click 'Deep Scan' to search for funding data" />
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {fundingHistory.map(round => (
                    <div key={round.id} className="p-3 flex items-start gap-3 hover:bg-[var(--bg-hover)] transition-colors">
                      <div className="mt-1.5">
                        <div className="w-2 h-2 bg-[var(--c-primary)] border border-[var(--bg-surface)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-[var(--c-primary-soft)] text-[var(--c-primary)] border border-[rgba(99,102,241,0.3)]">
                              {round.round_type?.replace(/-/g, ' ') || 'Round'}
                            </span>
                            {round.amount_usd && (
                              <span className="text-[13px] font-black text-[var(--text-primary)]">
                                ${formatAmount(round.amount_usd)}
                              </span>
                            )}
                            {round.currency && round.currency !== 'USD' && (
                              <span className="text-[9px] text-[var(--text-muted)]">({round.currency})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <VerificationBadge status={round.verification_status} score={round.confidence_score} />
                            {round.funding_date && (
                              <span className="text-[9px] text-[var(--text-muted)] tabular-nums font-semibold">
                                {new Date(round.funding_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        {round.lead_investor && (
                          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                            Led by <span className="font-bold">{round.lead_investor}</span>
                            {round.other_investors?.length > 0 && (
                              <span className="text-[var(--text-muted)]">
                                {' · '}{round.other_investors.slice(0, 4).join(', ')}
                                {round.other_investors.length > 4 && ` +${round.other_investors.length - 4}`}
                              </span>
                            )}
                          </p>
                        )}
                        {round.source_urls?.length > 0 && (
                          <div className="flex gap-2 mt-1.5">
                            {round.source_urls.slice(0, 3).map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                 className="inline-flex items-center gap-0.5 text-[9px] text-[var(--c-primary)] hover:underline font-semibold">
                                Source {i + 1} <ExternalLink size={8} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Jobs Section */}
            <Section title="Open Jobs" icon={Briefcase} iconColor="text-purple-400" count={jobs.length}>
              {jobs.length === 0 ? (
                <EmptyState icon={Briefcase} message="No matched jobs found" sub="Jobs are automatically linked when company names match your tracked positions" />
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {jobs.slice(0, 15).map(job => (
                    <Link key={job.id} href={`/jobs?id=${job.id}`} className="block p-3 hover:bg-[var(--bg-hover)] transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--c-primary)] transition-colors">
                            {job.title || job.role}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-muted)]">
                            {job.location && <span className="flex items-center gap-0.5"><MapPin size={9} />{job.location}</span>}
                            {job.department && <span>{job.department}</span>}
                            {job.type && <span className="capitalize">{job.type}</span>}
                          </div>
                          {job.salary_range && (
                            <p className="text-[10px] text-emerald-400 font-semibold mt-1">{job.salary_range}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {job.ats_score && (
                            <span className="text-[10px] font-black text-[var(--c-primary)] tabular-nums">{job.ats_score}%</span>
                          )}
                          <ChevronRight size={12} className="text-[var(--text-muted)] group-hover:text-[var(--c-primary)]" />
                        </div>
                      </div>
                    </Link>
                  ))}
                  {jobs.length > 15 && (
                    <div className="p-2.5 text-center bg-[var(--bg-elevated)]">
                      <Link href={`/jobs?company=${encodeURIComponent(company.canonical_name)}`}
                            className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-primary)] hover:underline">
                        View all {jobs.length} jobs →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* News Events */}
            <Section title="News & Events" icon={Newspaper} iconColor="text-blue-400" count={newsEvents.length}>
              {newsEvents.length === 0 ? (
                <EmptyState icon={Newspaper} message="No news events tracked yet" sub="News is automatically collected from RSS feeds, GDELT, and SEC filings" />
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {newsEvents.slice(0, 15).map(event => (
                    <div key={event.id} className="p-3 hover:bg-[var(--bg-hover)] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CategoryBadge category={event.category} />
                            <VerificationBadge status={event.verification_status} />
                          </div>
                          <p className="text-[12px] font-bold text-[var(--text-primary)] leading-snug line-clamp-2">{event.headline}</p>
                          {event.summary && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">{event.summary}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-[9px] text-[var(--text-muted)]">
                            <span className="font-bold">{event.source_name}</span>
                            {event.event_date && (
                              <span className="tabular-nums">
                                {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                            {event.funding_amount && (
                              <span className="font-black text-emerald-400">${formatAmount(event.funding_amount)}</span>
                            )}
                          </div>
                        </div>
                        {event.source_url && (
                          <a href={event.source_url} target="_blank" rel="noopener noreferrer"
                             className="shrink-0 p-1 text-[var(--text-muted)] hover:text-[var(--c-primary)] transition-colors">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Timeline */}
            {timeline.length > 0 && (
              <Section title="Company Timeline" icon={Activity} iconColor="text-cyan-400" count={timeline.length}>
                <div className="divide-y divide-[var(--border-subtle)]">
                  {timeline.slice(0, 20).map((event, i) => {
                    const dotColor = { funding: 'bg-emerald-400', news: 'bg-blue-400', hiring: 'bg-purple-400' };
                    return (
                      <div key={i} className="p-2.5 flex items-start gap-2.5 hover:bg-[var(--bg-hover)] transition-colors">
                        <div className={`w-1.5 h-1.5 mt-1.5 shrink-0 ${dotColor[event.type] || 'bg-[var(--text-muted)]'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[var(--text-primary)] font-bold truncate">{event.title}</p>
                          {event.detail && <p className="text-[9px] text-[var(--text-muted)] truncate mt-0.5">{event.detail}</p>}
                        </div>
                        {event.date && (
                          <span className="text-[9px] text-[var(--text-muted)] shrink-0 tabular-nums font-semibold">
                            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}
          </div>

          {/* ── Right Column: Sidebar ── */}
          <div className="space-y-4">

            {/* Hiring Metrics */}
            <Section title="Hiring Metrics" icon={BarChart3} iconColor="text-blue-400">
              {(!hiringMetrics || hiringMetrics.totalJobs === 0) ? (
                <EmptyState icon={Briefcase} message="No hiring data" sub="Jobs will appear as they are linked" small />
              ) : (
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    <MetricBox label="Open Jobs" value={hiringMetrics.totalJobs} color="text-[var(--c-primary)]" />
                    <MetricBox label="30d New" value={hiringMetrics.recentJobs} color="text-emerald-400" />
                    <MetricBox label="Growth" value={`${hiringMetrics.growthRate > 0 ? '+' : ''}${hiringMetrics.growthRate}%`}
                               color={hiringMetrics.growthRate >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                    <MetricBox label="Locations" value={Object.keys(hiringMetrics.locations || {}).length} color="text-purple-400" />
                  </div>
                  {hiringMetrics.departments && Object.keys(hiringMetrics.departments).length > 0 && (
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Departments</p>
                      <div className="space-y-1">
                        {Object.entries(hiringMetrics.departments)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 6)
                          .map(([dept, count]) => {
                            const maxCount = Math.max(...Object.values(hiringMetrics.departments));
                            const pct = Math.round((count / maxCount) * 100);
                            return (
                              <div key={dept} className="flex items-center gap-1.5">
                                <span className="w-[70px] text-[9px] text-[var(--text-secondary)] truncate">{dept}</span>
                                <div className="flex-1 h-[4px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                                  <div className="h-full bg-[var(--c-primary)]" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-4 text-right text-[9px] font-black text-[var(--text-primary)] tabular-nums">{count}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Key People */}
            <Section title="Key People" icon={Users} iconColor="text-amber-400" count={founders.length + executives.length}>
              {founders.length === 0 && executives.length === 0 ? (
                <EmptyState icon={Users} message="No people data" sub="People will be populated from company websites and LinkedIn" small />
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {[...founders, ...executives].slice(0, 10).map(person => (
                    <div key={person.id} className="p-2.5 flex items-center gap-2">
                      <div className="w-6 h-6 shrink-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                        <span className="text-[9px] font-black text-[var(--c-secondary)]">
                          {(person.name || '?')[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{person.name}</p>
                        <p className="text-[9px] text-[var(--text-muted)]">
                          {person.title || person.role}
                          {person.is_founder && <span className="text-amber-400 font-bold"> · Founder</span>}
                        </p>
                      </div>
                      {person.linkedin_url && (
                        <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
                           className="text-[var(--text-muted)] hover:text-blue-400 transition-colors">
                          <Link2 size={10} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Investors */}
            <Section title="Investors" icon={TrendingUp} iconColor="text-emerald-400" count={investors.length}>
              {investors.length === 0 ? (
                <div className="p-3">
                  {fundingHistory.some(r => r.lead_investor || r.other_investors?.length > 0) ? (
                    <div className="space-y-1.5">
                      {[...new Set(fundingHistory.flatMap(r => [r.lead_investor, ...(r.other_investors || [])]).filter(Boolean))].map((name, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                          <div className="w-5 h-5 shrink-0 bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                            <span className="text-[8px] font-black text-[var(--c-secondary)]">{name[0]}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-[var(--text-primary)] truncate">{name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={TrendingUp} message="No investor data" sub="Investor details are populated from SEC filings and news" small />
                  )}
                </div>
              ) : (
                <div className="p-2.5 space-y-1.5">
                  {investors.map(investor => (
                    <div key={investor.id} className="p-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 shrink-0 bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                          <span className="text-[9px] font-black text-[var(--c-secondary)]">
                            {(investor.name || '?')[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{investor.name}</p>
                          <p className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider">{investor.type || 'Investor'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Enrichment: Founders (from Deep Scan) ── */}
            {enrichedFounders.length > 0 && (
              <Section title="Founders" icon={Users} iconColor="text-orange-400" count={enrichedFounders.length}>
                <div className="p-2.5 space-y-1.5">
                  {enrichedFounders.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                      <div className="w-6 h-6 shrink-0 bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                        <span className="text-[9px] font-black text-orange-400">{(f.name || '?')[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{f.name}</p>
                        {f.title && <p className="text-[9px] text-[var(--text-muted)]">{f.title}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Enrichment: Products/Services ── */}
            {enrichedProducts.length > 0 && (
              <Section title="Products & Services" icon={Package} iconColor="text-cyan-400" count={enrichedProducts.length}>
                <div className="p-2.5 flex flex-wrap gap-1">
                  {enrichedProducts.map((p, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[9px] font-bold bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                      {p}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Enrichment: Competitors ── */}
            {enrichedCompetitors.length > 0 && (
              <Section title="Competitors" icon={Swords} iconColor="text-red-400" count={enrichedCompetitors.length}>
                <div className="p-2.5 space-y-1">
                  {enrichedCompetitors.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 p-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                      <div className="w-4 h-4 shrink-0 bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                        <span className="text-[7px] font-black text-red-400">{(c || '?')[0]}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-[var(--text-primary)] truncate">{c}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Enrichment: Tech Stack ── */}
            {enrichedTechStack.length > 0 && (
              <Section title="Tech Stack" icon={Code} iconColor="text-green-400" count={enrichedTechStack.length}>
                <div className="p-2.5 flex flex-wrap gap-1">
                  {enrichedTechStack.map((t, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[9px] font-bold font-mono bg-[rgba(16,185,129,0.1)] text-emerald-400 border border-[rgba(16,185,129,0.25)]">
                      {t}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Enrichment: Careers (from website scrape) ── */}
            {enrichedCareers.jobCount > 0 && (
              <Section title="Careers Page" icon={Briefcase} iconColor="text-violet-400">
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[var(--text-muted)]">Open Positions</span>
                    <span className="text-[14px] font-black text-violet-400 tabular-nums">{enrichedCareers.jobCount}</span>
                  </div>
                  {enrichedCareers.departments?.length > 0 && (
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Departments Hiring</p>
                      <div className="flex flex-wrap gap-1">
                        {enrichedCareers.departments.map((d, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-[8px] font-bold bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {enrichedCareers.lastScraped && (
                    <p className="text-[8px] text-[var(--text-muted)] pt-1">
                      Last checked: {new Date(enrichedCareers.lastScraped).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </Section>
            )}

            {/* Data Sources */}
            <Section title="Data Sources" icon={Shield} iconColor="text-[var(--text-muted)]">
              <div className="p-2.5 space-y-1">
                {[...new Set([
                  ...fundingHistory.flatMap(r => r.source_urls || []),
                  ...newsEvents.map(e => e.source_url).filter(Boolean),
                ])].slice(0, 8).map((url, i) => {
                  const domain = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1.5 p-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--c-primary)] transition-colors group">
                      <ExternalLink size={9} className="shrink-0" />
                      <span className="truncate group-hover:underline">{domain}</span>
                    </a>
                  );
                })}
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

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className={`${bg || 'bg-[var(--bg-surface)]'} border border-[var(--border-subtle)] p-2.5`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={10} className={color} />
        <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      </div>
      <p className={`text-[16px] font-black tabular-nums leading-none mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function MetricBox({ label, value, color }) {
  return (
    <div className="p-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
      <p className="text-[7px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-0.5">{label}</p>
      <p className={`text-[14px] font-black tabular-nums leading-none ${color}`}>{value}</p>
    </div>
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
      className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest border leading-none"
      style={{ backgroundColor: catStyle.bg, color: catStyle.text, borderColor: catStyle.border }}
    >
      {category}
    </span>
  );
}

function EmptyState({ icon: Icon, message, sub, small }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 ${small ? 'p-3' : 'p-6'} bg-[var(--bg-surface)]`}>
      <Icon size={small ? 16 : 24} className="text-[var(--text-muted)] opacity-40" />
      <p className={`${small ? 'text-[10px]' : 'text-[12px]'} font-bold text-[var(--text-secondary)]`}>{message}</p>
      {sub && <p className={`${small ? 'text-[9px]' : 'text-[10px]'} text-[var(--text-muted)] text-center max-w-xs`}>{sub}</p>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 md:p-5 w-full h-full space-y-4">
      <div className="h-4 w-24 bg-[var(--bg-elevated)] animate-pulse" />
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5">
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-[var(--bg-elevated)] animate-pulse" />
          <div className="flex-1 space-y-2.5">
            <div className="h-5 w-56 bg-[var(--bg-elevated)] animate-pulse" />
            <div className="h-3 w-80 bg-[var(--bg-elevated)] animate-pulse" />
            <div className="h-2 w-40 bg-[var(--bg-elevated)] animate-pulse" />
          </div>
          <div className="w-32 h-20 bg-[var(--bg-elevated)] animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-96 bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
        <div className="h-96 bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="p-5 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
      <Building2 size={40} className="text-[var(--text-muted)] mb-3" />
      <h2 className="text-[16px] font-black text-[var(--text-primary)]">Company Not Found</h2>
      <p className="text-[11px] text-[var(--text-muted)] mt-1">The company you&apos;re looking for doesn&apos;t exist in our database.</p>
      <Link href="/fundings" className="mt-4 text-[11px] font-bold text-[var(--c-primary)] hover:underline">
        ← Back to Fundings
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
