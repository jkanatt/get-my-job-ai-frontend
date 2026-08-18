'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Send, Target, MessageSquare, Trophy, Plus, ArrowRight, Search, CheckCircle2, Loader2, UserCircle, LayoutDashboard, Activity, Calendar, ChevronDown, Video, ExternalLink, Clock, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/shared/design-system/components/StateMessages';
import ConfirmDialog from '@/shared/design-system/components/ConfirmDialog';
import StatsCard from '@/shared/design-system/components/StatsCard';
import { StatsCardSkeleton, JobCardSkeleton, ListRowSkeleton, DashboardPipelineSkeleton } from '@/shared/design-system/components/Skeletons';
import JobCard from '@/features/jobs/components/JobCard';
import ActivityFeed from '@/features/dashboard/components/ActivityFeed';
import { Button, Card, Input, Pagination } from '@/shared/design-system/components';
import { brand } from '@/config/brand.config';
import { ApplicationActivityChart, PipelineFunnelChart } from '@/features/dashboard/components/DashboardCharts';
import PageHeader from '@/shared/design-system/components/PageHeader';
import { useJobs, useApplications, useSettings, useDashboardStats } from '@/shared/hooks';
import { useDebounce } from '@/shared/hooks/usePerformance';
import { getHashColor } from '@/shared/utils/ui-helpers';

// Lazy-load heavy modals
const ApplyModal = dynamic(() => import('@/features/applications/components/ApplyModal'), { ssr: false });
const JobDetailsModal = dynamic(() => import('@/features/jobs/components/JobDetailsModal'), { ssr: false });
const AppDetailModal = dynamic(() => import('@/features/applications/components/AppDetailModal'), { ssr: false });
const BuildEngineModal = dynamic(() => import('@/features/applications/components/BuildEngineModal'), { ssr: false });

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedDetailsJob, setSelectedDetailsJob] = useState(null);
  const [showConfirmApproveAll, setShowConfirmApproveAll] = useState(false);
  const { jobs, isLoading: jobsLoading, updateJob } = useJobs();
  const { applications, isLoading: appsLoading, mutate, bulkUpdateApplications } = useApplications();
  const { settings } = useSettings();

  const [timeFilter, setTimeFilter] = useState('all');
  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const TABLE_PAGE_SIZE = 20;
  const { stats, isLoading: statsLoading } = useDashboardStats(timeFilter);
  const { metrics, sparklineData, funnelData, nextInterview, activityFeed } = stats;

  // Show success toast when Google OAuth completes and redirects here
  useEffect(() => {
    if (searchParams.get('google_connected') === '1') {
      toast.success('✅ Google account connected! Gmail and Calendar are now syncing.');
      // Remove the query param from URL without triggering a navigation
      const url = new URL(window.location.href);
      url.searchParams.delete('google_connected');
      window.history.replaceState({}, '', url.toString());
    }
    if (searchParams.get('oauth_error')) {
      toast.error(`Google connection failed: ${searchParams.get('oauth_error')}. Please try again in Settings.`);
    }
  }, [searchParams]);

  // Filter apps by tab
  const getFilteredApps = () => {
    let apps = [...applications].sort((a, b) => new Date(b.created_at || b.applied_at || 0) - new Date(a.created_at || a.applied_at || 0));

    const debouncedSearch = debouncedQuery.toLowerCase();
    if (debouncedSearch) {
      apps = apps.filter(a => a.company?.toLowerCase().includes(debouncedSearch) || a.role?.toLowerCase().includes(debouncedSearch));
    }

    if (activeTab === 'All') return apps;
    if (activeTab === 'Submitted') return apps.filter(a => a.status === 'Sent');
    if (activeTab === 'In flight') return apps.filter(a => ['Viewed', 'Responded', 'Interview'].includes(a.status));
    if (activeTab === 'Failed') return apps.filter(a => a.status === 'Rejected');
    if (activeTab === 'Needs you') return apps.filter(a => a.status === 'Sent' && (new Date() - new Date(a.created_at || a.applied_at)) > 7 * 24 * 60 * 60 * 1000);
    if (activeTab === 'Offers') return apps.filter(a => a.status === 'Offer');
    return apps;
  };

  const filteredApps = getFilteredApps();
  const totalPages = Math.max(1, Math.ceil(filteredApps.length / TABLE_PAGE_SIZE));
  // Clamp tablePage if tab/filter reduces items below current page
  const safeTablePage = Math.min(tablePage, totalPages);
  const paginatedApps = filteredApps.slice((safeTablePage - 1) * TABLE_PAGE_SIZE, safeTablePage * TABLE_PAGE_SIZE);

  const TABS = [
    { label: 'All', count: applications.length },
    { label: 'Submitted', count: applications.filter(a => a.status === 'Sent').length },
    { label: 'In flight', count: applications.filter(a => ['Viewed', 'Responded', 'Interview'].includes(a.status)).length },
    { label: 'Needs you', count: applications.filter(a => a.status === 'Sent' && (new Date() - new Date(a.created_at || a.applied_at)) > 7 * 24 * 60 * 60 * 1000).length },
    { label: 'Offers', count: applications.filter(a => a.status === 'Offer').length },
    { label: 'Failed', count: applications.filter(a => a.status === 'Rejected').length },
  ];

  // Reset page to 1 whenever tab or search changes
  useEffect(() => {
    setTablePage(1);
  }, [activeTab, debouncedQuery]);

  const getColor = (name) => {
    return getHashColor(name);
  };

  const handleApplyAll = () => {
    const topJobs = jobs.filter(j => j.status !== 'Passed' && j.status !== 'Saved').slice(0, 4);
    if (topJobs.length === 0) return toast.error('No available jobs to apply to.');
    // Open apply modal for the first top match
    setSelectedJob(topJobs[0]);
    setShowApplyModal(true);
  };

  const handleApproveAll = () => {
    setShowConfirmApproveAll(true);
  };

  const executeApproveAll = async () => {
    setShowConfirmApproveAll(false);
    const needsYouApps = applications.filter(a => a.status === 'Sent' && (new Date() - new Date(a.created_at || a.applied_at)) > 7 * 24 * 60 * 60 * 1000);
    const ids = needsYouApps.map(a => a.id);

    if (ids.length === 0) return;

    try {
      await bulkUpdateApplications(ids, { status: 'Interview' });
      mutate();
    } catch (err) {
      console.error("Bulk update failed", err);
      toast.error("Failed to approve applications.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] flex flex-col gap-8 relative pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 pb-8 border-b border-[var(--border-subtle)] relative">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-transparent blur-3xl -z-10" />
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-none bg-[var(--c-primary)] border-2 border-black flex items-center justify-center shrink-0 shadow-none relative overflow-hidden">
            <UserCircle className="text-[var(--c-primary)] relative z-10" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]/90">{(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })()}{settings?.sender_name ? `, ${settings.sender_name}` : ''}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Here&apos;s what&apos;s happening with your job search today.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative">
          <div className="relative z-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/40 z-10" />
            <Input className="!pl-9 w-64" placeholder="Search companies, roles..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={() => setShowBuildModal(true)} className="gap-2">
            <Target size={14} /> Build
          </Button>
          <Button variant="primary" onClick={() => setShowApplyModal(true)}>
            <Plus size={14} /> Add Application
          </Button>
        </div>
      </div>

      {/* Goal Progress & Trends & Activity Feed */}
      {!statsLoading && (
        <div className="flex flex-col xl:flex-row gap-6 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex-[3] flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Summary Card */}
              <Card className="p-6 flex-[1.2] flex flex-col justify-center relative group rounded-none shadow-sm border-[var(--border-strong)]">
                <div className="flex items-center justify-between mb-5 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center shadow-sm">
                      <Target size={16} className="text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-[var(--text-primary)] tracking-wide">Summary</h3>
                      <p className="text-[11px] text-[var(--text-muted)] tracking-wider uppercase mt-0.5">Timeline breakdown</p>
                    </div>
                  </div>
                  <div className="relative z-50">
                    <button 
                      onClick={() => setIsTimeFilterOpen(!isTimeFilterOpen)}
                      className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-strong)] hover:border-[var(--text-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1.5 transition-all text-[10px] font-bold tracking-widest uppercase rounded-none"
                    >
                      {timeFilter === 'today' ? 'Today' :
                       timeFilter === 'week' ? 'This Week' :
                       timeFilter === 'month' ? 'This Month' :
                       timeFilter === 'year' ? 'This Year' : 'All Time'}
                      <ChevronDown size={12} className={`transition-transform duration-200 ${isTimeFilterOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isTimeFilterOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsTimeFilterOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-xl z-50 py-1">
                          {[
                            { value: 'today', label: 'Today' },
                            { value: 'week', label: 'This Week' },
                            { value: 'month', label: 'This Month' },
                            { value: 'year', label: 'This Year' },
                            { value: 'all', label: 'All Time' },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => { setTimeFilter(opt.value); setIsTimeFilterOpen(false); }}
                              className={`w-full text-left px-4 py-2.5 text-[10px] font-bold tracking-widest uppercase transition-colors ${timeFilter === opt.value ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] border-l-2 border-[var(--c-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-l-2 border-transparent'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-[1px] bg-[var(--border-strong)] border border-[var(--border-strong)] rounded-sm overflow-hidden shadow-sm">
                  <div className="flex flex-col p-4 bg-[var(--bg-surface)] transition-colors">
                    <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Send size={10} /> Applied</span>
                    <span className="text-2xl font-bold text-[var(--text-primary)]">{funnelData?.find(d => d.name === 'Applied')?.value || 0}</span>
                  </div>
                  <div className="flex flex-col p-4 bg-[var(--bg-surface)] transition-colors">
                    <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><MessageSquare size={10} /> Viewed</span>
                    <span className="text-2xl font-bold text-[var(--text-primary)]">{funnelData?.find(d => d.name === 'Viewed')?.value || 0}</span>
                  </div>
                  <div className="flex flex-col p-4 bg-[var(--bg-surface)] transition-colors">
                    <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Calendar size={10} /> Interview</span>
                    <span className="text-2xl font-bold text-[var(--text-primary)]">{funnelData?.find(d => d.name === 'Interview')?.value || 0}</span>
                  </div>
                  <div className="flex flex-col p-4 bg-[var(--bg-surface)] relative overflow-hidden group/offer">
                    <div className="absolute inset-0 bg-[var(--c-info)] opacity-[0.03] group-hover/offer:opacity-[0.06] transition-opacity"></div>
                    <span className="text-[10px] text-[var(--c-info)] font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1.5 relative z-10"><Trophy size={10} /> Offer</span>
                    <span className="text-2xl font-bold text-[var(--c-info)] relative z-10">{funnelData?.find(d => d.name === 'Offer')?.value || 0}</span>
                  </div>
                </div>
              </Card>

              {/* 7-Day Sparkline (AreaChart) */}
              <Card className="p-6 flex-[2] flex flex-col justify-center rounded-none">
                <div className="flex items-center gap-3 mb-4 relative z-10 border-b border-[var(--border-subtle)] pb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center shadow-sm">
                    <Activity size={16} className="text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[var(--text-primary)] tracking-wide">Application Activity</h3>
                    <p className="text-[11px] text-[var(--text-muted)] tracking-wider uppercase mt-0.5">
                      {timeFilter === 'today' ? 'Today (24h)' :
                       timeFilter === 'week' ? 'Last 7 days' :
                       timeFilter === 'month' ? 'Last 30 days' :
                       timeFilter === 'year' ? 'Last 12 months' : 'All Time'}
                    </p>
                  </div>
                </div>
                <div className="h-full min-h-[140px] -ml-2 mt-2">
                  <ApplicationActivityChart data={sparklineData} />
                </div>
              </Card>
            </div>

            {/* Funnel Chart & Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <Card className="p-6 flex flex-col justify-center md:col-span-2 rounded-none">
                <div className="flex items-center gap-3 mb-6 relative z-10 border-b border-[var(--border-subtle)] pb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center shadow-sm">
                    <LayoutDashboard size={16} className="text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[var(--text-primary)] tracking-wide">Conversion Pipeline</h3>
                    <p className="text-[11px] text-[var(--text-muted)] tracking-wider uppercase mt-0.5">Current state</p>
                  </div>
                </div>
                <PipelineFunnelChart data={funnelData} />
              </Card>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-5 shrink-0 md:col-span-3">
                <StatsCard icon={Send} label="TOTAL APPLICATIONS" value={metrics?.totalApps || 0} accentColor="var(--c-primary)" />
                <StatsCard icon={CheckCircle2} label="AVG ATS SCORE" value={`${metrics?.avgAts || 0}%`} accentColor="var(--c-accent)" />
                <StatsCard icon={MessageSquare} label="RESPONSE RATE" value={`${metrics?.responseRate || 0}%`} accentColor="var(--c-warning)" />
                <StatsCard icon={Trophy} label="OFFER RATE" value={`${metrics?.offerRate || 0}%`} accentColor="var(--c-info)" />
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[320px] flex flex-col min-h-0">
            <ActivityFeed 
              feed={activityFeed} 
              onItemClick={(item) => {
                if (item.email_id) {
                  router.push(`/inbox?email_id=${item.email_id}`);
                } else if (item.application_id) {
                  const app = applications.find(a => a.id === item.application_id);
                  if (app) {
                    setSelectedApp(app);
                    setShowAppModal(true);
                  } else {
                    toast.error('Application details not found');
                  }
                }
              }}
            />
          </div>

        </div>
      )}
      {statsLoading && (
        <DashboardPipelineSkeleton />
      )}

      {/* Top Job Matches */}
      <div className="shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="h2">Top job matches</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSelectedJob(null); setShowApplyModal(true); }}><Plus size={12} />Apply / Add JD</Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/jobs')}><Search size={12} />Browse jobs</Button>
            <Button variant="primary" size="sm" onClick={handleApplyAll}>Apply to all <ArrowRight size={12} /></Button>
          </div>
        </div>

        {jobsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <JobCardSkeleton /><JobCardSkeleton /><JobCardSkeleton /><JobCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {jobs.slice(0, 4).map((job, index) => (
              <div key={job.id} className="h-[280px] animate-in fade-in zoom-in-95 duration-300 fill-mode-both" style={{ animationDelay: `${index * 50}ms` }}>
                <JobCard
                  job={job}
                  onApply={() => { setShowDetailsModal(false); setSelectedJob(job); setShowApplyModal(true); }}
                  onPass={async () => {
                    await updateJob(job.id, { status: 'Passed' });
                  }}
                  onSave={async () => {
                    await updateJob(job.id, { status: 'Saved' });
                  }}
                  onDetails={() => { setSelectedDetailsJob(job); setShowDetailsModal(true); }}
                />
              </div>
            ))}
            {jobs.length === 0 && (
              <div className="w-full text-center p-8 text-[var(--text-muted)] col-span-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] rounded-none">
                No jobs found in database.
                <button className="text-[var(--c-primary)] underline hover:text-[var(--text-primary)] ml-2" onClick={() => router.push('/jobs')}>Find Jobs Now</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* All Applications */}
      <div className="flex flex-col mt-4">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="h2">All applications</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/tracker')}>Open tracker</Button>
            <Button variant="primary" size="sm" onClick={handleApproveAll}><CheckCircle2 size={12} />Approve all</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar shrink-0 p-1.5 bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] rounded-none w-max shadow-none relative z-10">
          {TABS.map(tab => {
            const isActive = activeTab === tab.label;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`relative px-5 py-2.5 text-[11px] font-black tracking-[0.15em] uppercase transition-all duration-300 rounded-none whitespace-nowrap overflow-hidden group ${isActive ? 'text-white' : 'text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--c-primary)] to-blue-600 opacity-100 shadow-[0_0_15px_rgba(99,102,241,0.4)]" />
                )}
                {isActive && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/20 transition-opacity duration-300" />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab.label}
                  <span className={`px-2 py-0.5 text-[10px] rounded-none transition-colors duration-300 ${isActive ? 'bg-white/20 text-white border border-white/20' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]/60 border border-[var(--border-subtle)] group-hover:bg-[var(--bg-hover)] group-hover:text-[var(--text-primary)]'}`}>
                    {tab.count}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <Card className="flex flex-col overflow-hidden">
          <div className="w-full overflow-x-auto relative">
            {appsLoading ? (
              <div className="flex flex-col gap-px bg-[var(--border-subtle)]">
                <ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton />
              </div>
            ) : (
              <table className="table-grid w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-base)] border-y border-[var(--border-subtle)] text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)] relative z-20">
                    <th className="py-5 text-center bg-[var(--bg-base)]">Company</th>
                    <th className="py-5 text-center bg-[var(--bg-base)]">Sent To</th>
                    <th className="py-5 text-center bg-[var(--bg-base)]">Role</th>
                    <th className="py-5 text-center bg-[var(--bg-base)]">Domain</th>
                    <th className="py-5 text-center bg-[var(--bg-base)]">Status</th>
                    <th className="py-5 text-center bg-[var(--bg-base)]">ATS Score</th>
                    <th className="py-5 text-center bg-[var(--bg-base)]">Applied On</th>
                    <th className="py-5 text-center bg-[var(--bg-base)]">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedApps.map((app, index) => {
                    let toEmail = 'Unknown';
                    if (app.emails && app.emails.length > 0) {
                      const sentEmail = app.emails.find(e => e.type === 'sent');
                      if (sentEmail && sentEmail.to_email) {
                        toEmail = sentEmail.to_email;
                      } else {
                        const inboxEmail = app.emails.find(e => e.type === 'inbox' || e.type === 'received');
                        if (inboxEmail && inboxEmail.from_email) {
                          toEmail = inboxEmail.from_email;
                        } else {
                          toEmail = app.emails[0].to_email || 'Unknown';
                        }
                      }
                    }

                    let sentToName = 'Hiring Team';
                    let domain = app.company ? `${app.company.toLowerCase().replace(/\s+/g, '')}.com` : 'N/A';
                    
                    if (toEmail !== 'Unknown') {
                      // Extract name if format is "Name" <email@domain.com> or Name <email@domain.com>
                      const nameMatch = toEmail.match(/^"?([^"<]+)"?\s*</);
                      if (nameMatch && nameMatch[1]) {
                        sentToName = nameMatch[1].trim();
                      }
                      
                      // Extract raw email address
                      const emailMatch = toEmail.match(/<([^>]+)>/);
                      const cleanEmail = emailMatch ? emailMatch[1] : toEmail;
                      
                      if (!nameMatch) {
                        sentToName = cleanEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      }
                      
                      if (cleanEmail.includes('@')) {
                        domain = cleanEmail.split('@')[1];
                      }
                    }
                    if (app.recruiter_name) sentToName = app.recruiter_name;

                    const dateObj = new Date(app.applied_at || app.created_at);
                    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                    return (
                      <tr key={app.id} className="cursor-pointer bg-transparent hover:bg-[var(--bg-hover)] border-b-2 border-transparent hover:border-black transition-none group relative z-0 hover:z-10 animate-in fade-in slide-in-from-bottom-2 fill-mode-both" style={{ animationDelay: `${index * 30}ms` }} onClick={() => router.push('/tracker')}>
                        {/* Company */}
                        <td className="py-5 pl-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 flex items-center justify-center text-[var(--text-primary)] text-[12px] font-black rounded-none shadow-none border-2 border-[var(--border-strong)] shrink-0" style={{ background: getColor(app.company) }}>
                              {(app.company || 'XX').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="text-[var(--text-primary)]/90 font-bold text-[14px] tracking-tight">{app.company}</div>
                          </div>
                        </td>

                        {/* Sent To */}
                        <td className="py-5">
                          <div className="flex items-center justify-center gap-2">
                            <UserCircle size={14} className="text-[var(--text-primary)]/30 shrink-0" />
                            <div className="text-[var(--text-primary)]/80 text-[13px] font-medium">{sentToName}</div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-5 text-center">
                          <div className="text-[12px] text-[var(--text-primary)]/70 font-semibold tracking-wide max-w-[200px] whitespace-normal break-words mx-auto">
                            {app.role || 'General Application'}
                          </div>
                        </td>

                        {/* Domain */}
                        <td className="py-5 text-center">
                          <div className="text-[11px] text-[var(--text-primary)]/40 tracking-wider font-mono">
                            {domain}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-5 text-center">
                          <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-none text-[10px] font-bold uppercase tracking-widest border ${app.status === 'Rejected' ? 'bg-[var(--c-danger)]/10 text-[var(--c-danger)] border-[var(--c-danger)]/20' :
                              app.status === 'Interview' ? 'bg-[var(--c-accent)]/10 text-[var(--c-accent)] border-[var(--c-accent)]/20' :
                                app.status === 'Sent' ? 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]' :
                                  app.status === 'Viewed' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                    app.status === 'Responded' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                      app.status === 'Offer' ? 'bg-[var(--c-primary)] text-white border-[var(--c-primary)]' :
                                        'bg-[var(--bg-hover)] text-[var(--text-primary)]/50 border-[var(--border-subtle)]'
                            }`}>
                            <span className="w-1.5 h-1.5 rounded-none bg-current opacity-70 shrink-0" />
                            {app.status}
                          </span>
                        </td>

                        {/* ATS Score */}
                        <td className="py-5 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className="text-[var(--text-primary)]/90 text-[14px] font-black">{app.ats_score || '--'}%</span>
                            {app.metrics?.improvement ? (
                              <span className="text-emerald-500 text-[10px] font-bold tracking-wider">+{app.metrics.improvement}%</span>
                            ) : null}
                          </div>
                        </td>

                        {/* Applied On */}
                        <td className="py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[var(--text-primary)]/80 text-[13px] font-medium">{formattedDate}</span>
                            <span className="w-px h-3 bg-[var(--border-strong)]"></span>
                            <span className="text-[var(--text-muted)] text-[11px] tracking-wide">{formattedTime}</span>
                          </div>
                        </td>

                        {/* View Button */}
                        <td className="py-5 pr-6 text-right">
                          <Button
                            variant="primary" size="icon"
                            aria-label={`View details for ${app.company}`}
                          >
                            <ArrowRight size={14} className="-rotate-45" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredApps.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-16">
                        <EmptyState icon={Search} title="No applications found" message="You haven't tracked any applications yet." />
                      </td>
                    </tr>
                  )}
                  {filteredApps.length > 0 && paginatedApps.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-16 text-center text-[var(--text-muted)]">
                        No more applications on this page.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <Pagination
            page={safeTablePage}
            setPage={(fn) => {
              const newPage = typeof fn === 'function' ? fn(safeTablePage) : fn;
              setTablePage(Math.max(1, Math.min(newPage, totalPages)));
            }}
            total={filteredApps.length}
            hasMore={safeTablePage < totalPages}
            limit={TABLE_PAGE_SIZE}
            itemName="applications"
          />
        </Card>
      </div>

      {showDetailsModal && (
        <JobDetailsModal
          job={selectedDetailsJob}
          onClose={() => { setShowDetailsModal(false); setSelectedDetailsJob(null); }}
          onApply={() => { setShowDetailsModal(false); setSelectedJob(selectedDetailsJob); setShowApplyModal(true); }}
          onPass={async () => {
            await updateJob(selectedDetailsJob.id, { status: 'Passed' });
            setShowDetailsModal(false);
          }}
        />
      )}

      {showApplyModal && (
        <ApplyModal job={selectedJob} onClose={() => { setShowApplyModal(false); setSelectedJob(null); }} />
      )}

      {showAppModal && selectedApp && (
        <AppDetailModal
          application={selectedApp}
          onClose={() => { setShowAppModal(false); setSelectedApp(null); }}
          onUpdate={() => mutate()}
        />
      )}

      <BuildEngineModal isOpen={showBuildModal} onClose={() => setShowBuildModal(false)} />

      <ConfirmDialog
        open={showConfirmApproveAll}
        title="Approve Applications"
        message='Are you sure you want to approve all "Needs you" applications?'
        confirmLabel="Approve All"
        cancelLabel="Cancel"
        variant="default"
        onConfirm={executeApproveAll}
        onCancel={() => setShowConfirmApproveAll(false)}
      />
    </div>
  );
}
