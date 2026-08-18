'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Download, Upload, Plus, Calendar, Building, Building2, Briefcase, ChevronRight, Filter, Search, Edit3, Trash2, Link as LinkIcon, FileText, CheckCircle2, MessageSquare, List as ListIcon, LayoutGrid, Clock, Loader2, ListTodo, Send, MessageCircle, Target, Ban, Eye, X, User, AlertTriangle, RefreshCw, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useApplications, useEmailSyncEngine, useSettings } from '@/shared/hooks';
import PageHeader from '@/shared/design-system/components/PageHeader';
import StatsCard from '@/shared/design-system/components/StatsCard';
import { ErrorState } from '@/shared/design-system/components/StateMessages';
import { KanbanCardSkeleton } from '@/shared/design-system/components/Skeletons';
import { DateTimePicker } from '@/shared/design-system/components/DateTimePicker';
import { STATUSES, normalizeStatus, EVENT_BADGE_MAP, FALLBACK_BADGE_MAP } from '@/config/status.config';

// Lazy-load heavy modal (658 lines) — only fetched when user clicks a card
const AppDetailModal = dynamic(() => import('@/features/applications/components/AppDetailModal'), { ssr: false });
const BulkNotifyModal = dynamic(() => import('@/features/applications/components/BulkNotifyModal'), { ssr: false });
const SendProgressToast = dynamic(() => import('@/features/applications/components/SendProgressToast'), { ssr: false });

const COLUMNS = STATUSES;

// ─── System/non-recruiter sender detection (shared blocklist) ───
const SYSTEM_SENDER_PATTERNS = [
  'mailer-daemon', 'mail-delivery-subsystem', 'postmaster@',
  'hello@mail.', 'team@mail.', 'noreply@', 'no-reply@',
  'donotreply@', 'do-not-reply@', 'notifications@', 'notification@',
  'newsletter@', 'news@', 'updates@', 'marketing@',
  'support@', 'info@', 'service@', 'system@', 'accounts@',
  'spline.design', 'rocket.new', 'descript.com', 'speechify.com', 'loom.com',
  'quillbot', 'chegg.com', 'ocr.space', 'googlemail.com',
];

const isSystemOrSelf = (emailAddr, userEmail) => {
  if (!emailAddr) return true;
  const lower = emailAddr.toLowerCase();
  // Check system senders
  if (SYSTEM_SENDER_PATTERNS.some(p => lower.includes(p))) return true;
  // Check if it's the user's own email (handle aliases like joshuakanatt66, joshuakanatt201, etc.)
  if (userEmail) {
    const bareEmail = lower.match(/<([^>]+)>/) ? lower.match(/<([^>]+)>/)[1] : lower;
    if (bareEmail.includes(userEmail.toLowerCase())) return true;
    // Check alias pattern: same alphabetic base before numbers
    const primaryBase = userEmail.split('@')[0].replace(/\d+$/, '').toLowerCase();
    const testLocal = bareEmail.split('@')[0].replace(/\d+$/, '').toLowerCase();
    const testDomain = bareEmail.split('@')[1] || '';
    const primaryDomain = (userEmail.split('@')[1] || '').toLowerCase();
    if (primaryBase.length >= 4 && primaryBase === testLocal && testDomain === primaryDomain) return true;
  }
  // Hardcoded fallback for the known user email pattern
  if (lower.includes('joshuakanatt')) return true;
  return false;
};

const getRecruiterName = (app, settings) => {
  // 1. Check application-level recruiter name (set by AI sync engine)
  if (app.metadata?.recruiter_name) {
    const name = app.metadata.recruiter_name;
    // Don't use recruiter_name if it's the user's own name
    if (name.toLowerCase().includes('joshua')) {
      // Fall through to email-based extraction
    } else {
      return (name.length > 20 ? name.substring(0, 20) + '...' : name).toUpperCase();
    }
  }

  if (!app.emails || app.emails.length === 0) return null;

  const userEmail = settings?.gmail_user || process.env.NEXT_PUBLIC_GMAIL_USER || '';

  // Find the most recent REAL incoming email (not from the user, not from system senders)
  const incomingEmail = [...app.emails].reverse().find(e => {
    if (!e.from_email || e.type !== 'inbox') return false;
    return !isSystemOrSelf(e.from_email, userEmail);
  });

  if (incomingEmail) {
    // 2. Check email metadata for display name
    if (incomingEmail.metadata?.from_name) {
      const name = incomingEmail.metadata.from_name;
      if (!name.toLowerCase().includes('joshua')) {
        return (name.length > 20 ? name.substring(0, 20) + '...' : name).toUpperCase();
      }
    }

    // 3. Try regex parsing of formatted "Name" <email> strings
    const match = incomingEmail.from_email.match(/^"?([^"<]+)"?\s*</);
    if (match && match[1]) {
      const name = match[1].trim();
      if (!name.toLowerCase().includes('joshua')) {
        return (name.length > 20 ? name.substring(0, 20) + '...' : name).toUpperCase();
      }
    }

    // 4. Fallback: title-case the email username portion
    const emailMatch = incomingEmail.from_email.match(/<([^>]+)>/) || [null, incomingEmail.from_email];
    const username = emailMatch[1].split('@')[0];
    return username.replace(/[._-]/g, ' ').toUpperCase();
  }

  // Fallback: If no incoming email, show who we sent it to (the actual recruiter)
  const sentEmail = [...app.emails].reverse().find(
    e => (e.type === 'sent' || e.type === 'archive') && e.to_email && !isSystemOrSelf(e.to_email, userEmail)
  );
  if (sentEmail) {
    if (sentEmail.metadata?.to_name) {
      const name = sentEmail.metadata.to_name;
      return (name.length > 20 ? name.substring(0, 20) + '...' : name).toUpperCase();
    }

    const match = sentEmail.to_email.match(/^"?([^"<]+)"?\s*</);
    if (match && match[1]) {
      const name = match[1].trim();
      return (name.length > 20 ? name.substring(0, 20) + '...' : name).toUpperCase();
    }
    const emailMatch = sentEmail.to_email.match(/<([^>]+)>/) || [null, sentEmail.to_email];
    const username = emailMatch[1].split('@')[0];
    return username.replace(/[._-]/g, ' ').toUpperCase();
  }

  return null;
};

export default function TrackerPage() {
  const router = useRouter();

  // Initialize background sync engine
  useEmailSyncEngine(60000); // sync every 60 seconds

  const { applications, isLoading, isError, errorDetails, mutate, addApplication, updateApplication, bulkUpdateApplications, deleteApplication } = useApplications(1, 500);
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [appToDelete, setAppToDelete] = useState(null);
  const [newApp, setNewApp] = useState({ company: '', role: '', status: 'Sent', created_at: new Date().toISOString().split('T')[0] });
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Bulk Notify state
  const [showBulkNotify, setShowBulkNotify] = useState(false);
  const [sendProgressItems, setSendProgressItems] = useState([]);
  const [isSendProgressActive, setIsSendProgressActive] = useState(false);

  const [draggedAppId, setDraggedAppId] = useState(null);

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState([]);

  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ remoteOnly: false, minSalary: '', dateFrom: '' });

  // Modal scroll lock
  useEffect(() => {
    if (showAddModal || appToDelete || showBulkNotify) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAddModal, appToDelete, showBulkNotify]);

  // Compute metrics
  const totalApps = applications.length;
  const responded = applications.filter(a => normalizeStatus(a.status) === 'Responded').length;
  const interviews = applications.filter(a => normalizeStatus(a.status) === 'Interview').length;
  const rejections = applications.filter(a => normalizeStatus(a.status) === 'Rejected').length;

  const filteredApps = applications.filter(app => {
    const matchesSearch = app.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.role?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesRemote = true;
    if (filters.remoteOnly) matchesRemote = app.is_remote === true || (app.role && app.role.toLowerCase().includes('remote'));

    let matchesSalary = true;
    if (filters.minSalary) {
      const minSal = parseInt(filters.minSalary, 10) || 0;
      const appSal = typeof app.salary === 'number' ? app.salary : parseInt((app.salary || '').toString().replace(/\D/g, ''), 10) || 0;
      matchesSalary = appSal >= minSal;
    }

    let matchesDate = true;
    if (filters.dateFrom) {
      matchesDate = new Date(app.created_at) >= new Date(filters.dateFrom);
    }

    return matchesSearch && matchesRemote && matchesSalary && matchesDate;
  });

  const handleBulkUpdate = async (newStatus) => {
    if (selectedIds.length === 0) return;
    try {
      await bulkUpdateApplications(selectedIds, { status: newStatus });
      setSelectedIds([]);
      toast.success(`Updated ${selectedIds.length} application(s)`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update applications');
    }
  };

  const handleExportCSV = () => {
    const headers = 'Company,Role,Status,Applied Date\n';
    const rows = applications.map(a => `"${a.company || ''}","${a.role || ''}","${a.status || ''}","${new Date(a.created_at).toLocaleDateString()}"`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'applications.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const rows = text.split('\n').slice(1); // skip header
      for (const row of rows) {
        if (!row.trim()) continue;
        const cols = row.match(/(?:"[^"]*"|[^,])+/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || [];
        if (cols.length >= 4) {
          await addApplication({
            company: cols[0],
            role: cols[1],
            status: cols[2],
            created_at: new Date(cols[3]).toISOString()
          });
        }
      }
      toast.success('Import complete!');
    };
    input.click();
  };

  const handleAddApp = async () => {
    if (!newApp.company || !newApp.role) return toast.error('Company and Role are required');
    // Combine the selected date with the current time so it doesn't default to midnight UTC
    const now = new Date();
    const [year, month, day] = newApp.created_at.split('-');
    now.setFullYear(year, month - 1, day);

    await addApplication({
      company: newApp.company,
      role: newApp.role,
      status: newApp.status,
      created_at: now.toISOString()
    });
    setNewApp({ company: '', role: '', status: 'Sent', created_at: new Date().toISOString().split('T')[0] });
    mutate();
    setShowAddModal(false);
  };

  const handleDeleteApp = (appId) => {
    const app = applications.find(a => a.id === appId);
    if (app) {
      setAppToDelete(app);
    }
  };

  const confirmDeleteApp = async () => {
    if (!appToDelete) return;
    const appId = appToDelete.id;
    setAppToDelete(null);

    // Optimistic UI update
    const previousApps = [...applications];
    mutate({ applications: previousApps.filter(a => a.id !== appId) }, false);

    try {
      await deleteApplication(appId);
      mutate();
    } catch (err) {
      console.error(err);
      mutate({ applications: previousApps });
      toast.error('Failed to delete application.');
    }
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e, appId) => {
    setDraggedAppId(appId);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set
    e.dataTransfer.setData('text/plain', appId);

    // Add a slight transparency to the dragged element
    setTimeout(() => {
      if (e.target) e.target.style.opacity = '0.4';
    }, 0);
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    setDraggedAppId(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const appId = draggedAppId || e.dataTransfer.getData('text/plain');
    if (!appId) return;

    // Optimistic UI update
    const previousApps = [...applications];
    mutate(
      { applications: previousApps.map(a => a.id === appId ? { ...a, status: newStatus } : a) },
      false // don't revalidate immediately
    );

    try {
      await updateApplication(appId, { status: newStatus });
    } catch (err) {
      console.error(err);
      // Revert on error
      mutate({ applications: previousApps });
      toast.error('Failed to update status.');
    }
  };

  const renderEventBadge = (app, fallbackStatus) => {
    let badgeText = fallbackStatus;
    let badgeClass = 'bg-[var(--bg-hover)] text-[var(--text-primary)]/50 border border-[var(--border-subtle)]';
    let Icon = null;

    if (app.tracking_events && app.tracking_events.length > 0) {
      const events = [...app.tracking_events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latest = events[0];
      const eventBadge = EVENT_BADGE_MAP[latest.event_type];
      if (eventBadge) {
        badgeText = eventBadge.text;
        badgeClass = `${eventBadge.color} ${eventBadge.textColor}`;
        Icon = eventBadge.icon;
      } else if (latest.event_type === 'OPENED') {
        badgeText = 'OPENED'; badgeClass = 'bg-[var(--c-info)] text-[var(--text-primary)]'; Icon = Eye;
      }
    } else {
      const fb = FALLBACK_BADGE_MAP[fallbackStatus];
      if (fb) {
        badgeText = fb.text;
        badgeClass = `${fb.color} ${fb.textColor}`;
        Icon = fb.icon;
      }
    }

    return (
      <div className={`flex items-center gap-1.5 text-[9px] font-black px-2 py-1 rounded-none uppercase tracking-[0.2em] ${badgeClass}`}>
        {Icon && <Icon size={10} className="opacity-70" />}
        {badgeText}
      </div>
    );
  };

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 pb-8 border-b border-[var(--border-subtle)] relative">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-transparent blur-3xl -z-10" />
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-none bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-none relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 opacity-50" />
            <ListTodo size={26} className="text-blue-400 relative z-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="h1">Application Tracker</h1>
            <p className="body-text">Track and manage your entire job search funnel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportCSV}
            className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition-all duration-150 active:scale-[0.97]"
          >
            <Upload size={13} /> Import CSV
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition-all duration-150 active:scale-[0.97]"
          >
            <Download size={13} /> Export CSV
          </button>

          <div className="w-px h-6 bg-[var(--bg-hover)] mx-1" />

          <button
            disabled={isReanalyzing}
            onClick={async () => {
              setIsReanalyzing(true);
              toast.info('Re-analyzing all emails... This may take a minute.');
              try {
                const res = await fetch('/api/emails/reanalyze', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  toast.success(`Re-analysis complete! Updated ${data.summary?.statuses_updated || 0} applications, removed ${data.summary?.deleted_fake_apps || 0} fake apps.`);
                  mutate();
                } else {
                  toast.error(data.error || 'Re-analysis failed');
                }
              } catch (err) {
                toast.error('Re-analysis failed: ' + err.message);
              } finally {
                setIsReanalyzing(false);
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-black bg-amber-500 hover:bg-amber-400 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isReanalyzing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {isReanalyzing ? 'Re-analyzing...' : 'Re-sync & Fix'}
          </button>

          <button
            onClick={() => setShowBulkNotify(true)}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white bg-blue-600 hover:bg-blue-500 transition-all duration-150 active:scale-[0.97]"
          >
            <Bell size={13} /> Notify
          </button>

          <div className="w-px h-6 bg-[var(--bg-hover)] mx-1" />

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] bg-white text-zinc-900 hover:bg-[var(--bg-hover)] border border-[var(--border-default)] transition-all duration-150 active:scale-[0.97]"
          >
            <Plus size={14} strokeWidth={3} /> Add Application
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-4 shrink-0 mb-2">
        <StatsCard icon={Send} label="TOTAL APPLICATIONS" value={totalApps} accentColor="var(--c-primary)" />
        <StatsCard icon={MessageCircle} label="RESPONDED" value={responded} accentColor="var(--c-warning)" />
        <StatsCard icon={Target} label="INTERVIEW" value={interviews} accentColor="var(--c-accent)" />
        <StatsCard icon={Ban} label="REJECTED" value={rejections} accentColor="var(--c-danger)" />
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col gap-2 relative z-20">
        <div className="flex items-stretch border border-[var(--border-strong)] rounded-none shrink-0 focus-within:border-[var(--c-primary)] transition-colors bg-[var(--bg-surface)]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/40" />
            <input
              className="w-full h-full bg-transparent border-none pl-11 pr-4 py-3 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-0 placeholder:text-[var(--text-primary)]/30 font-medium"
              placeholder="Search company or role..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 border-l border-[var(--border-strong)] transition-colors flex items-center gap-2 ${showFilters ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'bg-transparent text-[var(--text-primary)]/50 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'}`}
          >
            <Filter size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.1em]">Filters</span>
          </button>
          <div className="flex items-center justify-center px-6 border-l border-[var(--border-strong)] bg-[var(--bg-elevated)] min-w-[200px]">
            <span className="text-[10px] text-[var(--text-primary)]/50 font-black uppercase tracking-[0.15em]">
              Showing <span className="text-[var(--text-primary)] mx-1">{filteredApps.length}</span>
            </span>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="flex flex-col md:flex-row gap-3 p-4 border-t border-[var(--border-strong)] bg-[var(--bg-elevated)]/50 backdrop-blur-md">

            <div className="flex-1 bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] focus-within:border-[var(--text-primary)] transition-none flex items-center relative group h-12">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--c-primary)] opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="px-4 border-r border-[var(--border-strong)] bg-[var(--bg-elevated)] h-full flex items-center shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] group-focus-within:text-[var(--c-primary)] transition-colors">Min Salary</span>
              </div>
              <div className="flex items-center flex-1 h-full px-3">
                <span className="text-[var(--text-muted)] mr-2 font-bold">$</span>
                <input type="number" placeholder="e.g. 100000" className="w-full bg-transparent border-none text-[13px] outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium" value={filters.minSalary} onChange={e => setFilters({ ...filters, minSalary: e.target.value })} />
              </div>
            </div>

            <div className="flex-1 bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] focus-within:border-[var(--text-primary)] transition-none flex items-center relative group h-12">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--c-primary)] opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="px-4 border-r border-[var(--border-strong)] bg-[var(--bg-elevated)] h-full flex items-center shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] group-focus-within:text-[var(--c-primary)] transition-colors">Applied After</span>
              </div>
              <div className="flex-1 h-full flex relative">
                <DateTimePicker
                  mode="date"
                  name="dateFrom"
                  value={filters.dateFrom}
                  onChange={e => setFilters({ ...filters, dateFrom: e.target.value })}
                  placeholder="Select date"
                  className="!bg-transparent !border-none !shadow-none !ring-0 focus:!border-none focus:!ring-0 h-full !py-0 px-3 w-full text-[13px]"
                />
              </div>
            </div>

            <label className="flex items-center justify-center gap-3 bg-[var(--bg-surface)] border border-[var(--border-strong)] hover:border-[var(--c-primary)] hover:bg-[var(--bg-hover)] transition-colors h-12 px-6 cursor-pointer shrink-0">
              <input type="checkbox" checked={filters.remoteOnly} onChange={e => setFilters({ ...filters, remoteOnly: e.target.checked })} className="w-4 h-4 bg-transparent border border-[var(--border-strong)] rounded-none accent-[var(--c-primary)] cursor-pointer" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]">Remote Only</span>
            </label>

          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--bg-elevated)] border-2 border-[var(--text-primary)] shadow-none p-2 z-50 flex items-center gap-4 rounded-none">
          <div className="px-4 text-[12px] font-bold text-white uppercase tracking-widest border-r border-white/10">
            {selectedIds.length} Selected
          </div>
          <div className="flex items-center gap-2 pr-2">
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mr-2">Move to:</span>
            {COLUMNS.map(col => (
              <button key={col} onClick={() => handleBulkUpdate(col)} className="btn btn-outline px-3 py-1 text-[10px]">
                {col}
              </button>
            ))}
            <div className="w-px h-4 bg-white/10 mx-2" />
            <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm btn-icon">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        {isError ? (
          <div className="flex justify-center items-center h-full w-full bg-[var(--bg-hover)] border border-[var(--border-subtle)]">
            <ErrorState title="Failed to load tracking board" message={typeof errorDetails === 'string' ? errorDetails : errorDetails?.error || errorDetails?.message || 'There was an error loading your job applications.'} />
          </div>
        ) : isLoading ? (
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map(col => (
              <div key={`skel-${col}`} className="w-[320px] flex flex-col bg-transparent rounded-none border border-[var(--border-subtle)]">
                <div className="p-4 border-b border-[var(--border-strong)] flex justify-center items-center gap-3 bg-[var(--bg-kanban-sent)] text-white/90 shrink-0">
                  <h3 className="font-black text-[13px] uppercase tracking-[0.15em] relative z-10 drop-shadow-sm">{col}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  <KanbanCardSkeleton />
                  <KanbanCardSkeleton />
                  <KanbanCardSkeleton />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map(columnStatus => {
              const columnApps = filteredApps.filter(a => normalizeStatus(a.status) === columnStatus);

              // Column Colors
              const colColor =
                columnStatus === 'Sent' ? 'border-[var(--border-subtle)]' :
                  columnStatus === 'Viewed' ? 'border-purple-500/30' :
                    columnStatus === 'Responded' ? 'border-blue-400/30' :
                      columnStatus === 'Interview' ? 'border-blue-600/30' :
                        columnStatus === 'Offer' ? 'border-green-500/30' :
                          columnStatus === 'Rejected' ? 'border-red-500/30' :
                            'border-[var(--border-subtle)]';

              const headerBgColor =
                columnStatus === 'Sent' ? 'bg-[var(--bg-kanban-sent)]' :
                  columnStatus === 'Viewed' ? 'bg-[var(--bg-kanban-viewed)]' :
                    columnStatus === 'Responded' ? 'bg-[var(--bg-kanban-responded)]' :
                      columnStatus === 'Interview' ? 'bg-[var(--bg-kanban-interview)]' :
                        columnStatus === 'Offer' ? 'bg-[var(--bg-kanban-offer)]' :
                          columnStatus === 'Rejected' ? 'bg-[var(--bg-kanban-rejected)]' :
                            'bg-[var(--bg-kanban-sent)]';

              const headerTextColor = 'text-white/90';

              return (
                <div
                  key={columnStatus}
                  className={`w-[320px] flex flex-col bg-transparent rounded-none border ${colColor}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, columnStatus)}
                >
                  <div className={`p-4 border-b-2 border-[var(--border-strong)] flex justify-center items-center gap-3 ${headerBgColor} ${headerTextColor} shrink-0 group relative overflow-hidden cursor-default`}>

                    {/* Motion effect overlay */}
                    <div className="absolute top-0 bottom-0 left-0 w-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[800ms] ease-in-out pointer-events-none" />

                    <h3 className="font-black text-[13px] uppercase tracking-[0.15em] relative z-10 drop-shadow-sm">{columnStatus}</h3>
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-none bg-white/20 text-white relative z-10 shadow-none backdrop-blur-sm">
                      {columnApps.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {columnApps.map((app, index) => {
                      return (
                        <div
                          key={app.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, app.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedApp(app)}
                          className={`group relative bg-[var(--bg-surface)] border-2 ${selectedIds.includes(app.id) ? 'border-[var(--text-primary)]' : 'border-[var(--border-strong)]'} p-5 cursor-grab active:cursor-grabbing hover:border-[var(--text-primary)] rounded-none flex flex-col animate-in fade-in zoom-in-95 duration-300 fill-mode-both hover:-translate-y-1 transition-transform`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: selectedIds.includes(app.id) ? 1 : undefined }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(app.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (e.target.checked) setSelectedIds([...selectedIds, app.id]);
                                else setSelectedIds(selectedIds.filter(id => id !== app.id));
                              }}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 rounded-sm bg-[var(--bg-surface)] border-[var(--border-strong)] cursor-pointer"
                            />
                          </div>

                          <div className="flex items-center justify-between mb-3 pl-2">
                            <div className="flex items-center gap-3 w-full">
                              <div className="w-8 h-8 bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center shrink-0">
                                <Building2 size={14} className="text-[var(--text-primary)]/50" />
                              </div>
                              <h4 className="font-bold text-[14px] text-[var(--text-primary)] tracking-tight whitespace-normal break-words flex-1 pr-4">{app.company}</h4>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-5 right-5 bg-[var(--bg-surface)] pl-2">
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}>
                                <MoreHorizontal size={14} />
                              </button>
                              <button className="btn btn-ghost btn-sm btn-icon hover:text-red-500 dark:hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDeleteApp(app.id); }}>
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          {getRecruiterName(app, settings) ? (
                            <div className="mb-5 space-y-1.5">
                              <div className="text-[12px] text-[var(--text-primary)]/60 font-medium tracking-wide line-clamp-1">
                                {app.role ? app.role.split(' - ')[0].split(' – ')[0].trim() : 'General Application'}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-primary)]/50 font-bold uppercase tracking-widest">
                                <User size={10} className="text-[var(--text-primary)]/40" />
                                {getRecruiterName(app, settings)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[12px] text-[var(--text-primary)]/60 font-medium tracking-wide line-clamp-1 mb-5">
                              {app.role ? app.role.split(' - ')[0].split(' – ')[0].trim() : 'General Application'}
                            </div>
                          )}

                          <div className="h-px bg-[var(--border-strong)] w-full mb-4" />

                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-primary)]/50 font-bold font-mono uppercase tracking-widest">
                              {(() => {
                                // Show event-specific timestamp instead of just created_at
                                if (app.tracking_events && app.tracking_events.length > 0) {
                                  const events = [...app.tracking_events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                                  const latestEvent = events[0];
                                  const d = new Date(latestEvent.created_at);
                                  return (
                                    <>
                                      <span>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</span>
                                      <div className="w-px h-2.5 bg-[var(--border-strong)]" />
                                      <span className="text-[var(--text-muted)] font-medium">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                                    </>
                                  );
                                }
                                const d = new Date(app.created_at);
                                return (
                                  <>
                                    <span>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</span>
                                    <div className="w-px h-2.5 bg-[var(--border-strong)]" />
                                    <span className="text-[var(--text-muted)] font-medium">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                                  </>
                                );
                              })()}
                            </div>
                            {renderEventBadge(app, columnStatus)}
                          </div>
                        </div>
                      );
                    })}

                    {columnApps.length === 0 && (
                      <div className="h-32 flex flex-col items-center justify-center text-[var(--text-muted)] bg-[var(--bg-base)] border border-dashed border-[var(--border-strong)] m-3 group transition-colors">
                        <LayoutGrid size={24} className="mb-2 opacity-30 group-hover:opacity-50 transition-opacity" />
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">Drop Here</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Add Modal */}
      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-6">
          <div className="w-full max-w-2xl bg-[var(--bg-base)] border-2 border-[var(--border-strong)] shadow-none rounded-none overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-[var(--border-strong)] flex justify-between items-center flex-shrink-0 bg-[var(--bg-surface)] shadow-sm">
              <h2 className="text-[18px] font-black uppercase tracking-widest text-[var(--text-primary)]">Add Application</h2>
              <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>

            {/* Body */}
            <div className="p-8 flex-1 overflow-y-auto bg-[var(--bg-base)] space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold tracking-widest uppercase text-[var(--text-muted)]">Company</label>
                <input className="input-base w-full p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[14px]" value={newApp.company} onChange={e => setNewApp({ ...newApp, company: e.target.value })} placeholder="e.g. Acme Corp" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold tracking-widest uppercase text-[var(--text-muted)]">Role</label>
                <input className="input-base w-full p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[14px]" value={newApp.role} onChange={e => setNewApp({ ...newApp, role: e.target.value })} placeholder="e.g. Senior PM" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold tracking-widest uppercase text-[var(--text-muted)]">Status</label>
                  <select className="input-base w-full p-3 appearance-none bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[14px]" value={newApp.status} onChange={e => setNewApp({ ...newApp, status: e.target.value })}>
                    {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Applied Date</label>
                  <DateTimePicker
                    mode="date"
                    name="created_at"
                    value={newApp.created_at}
                    onChange={e => setNewApp({ ...newApp, created_at: e.target.value })}
                    placeholder="YYYY-MM-DD"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] shadow-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[var(--border-strong)] bg-[var(--bg-surface)] flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setShowAddModal(false)} className="btn btn-outline">Cancel</button>
              <button onClick={handleAddApp} className="btn btn-primary" disabled={!newApp.company || !newApp.role}>Save Application</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {appToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-6 transition-all animate-in fade-in duration-200" onClick={() => setAppToDelete(null)}>
          <div className="card-brutal w-full max-w-md bg-[var(--bg-surface)] relative flex flex-col border-2 border-red-500/50 shadow-none rounded-none" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 pb-4 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[16px] font-black uppercase tracking-widest text-[var(--text-primary)]/90 leading-none mt-1">Delete Application</h2>
                  <p className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Irreversible Action</p>
                </div>
              </div>
              <button onClick={() => setAppToDelete(null)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>

            {/* Body */}
            <div className="p-6 pt-2">
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-6">
                Are you sure you want to delete your application for <span className="font-bold text-[var(--text-primary)] tracking-wide">{appToDelete.role}</span> at <span className="font-bold text-[var(--text-primary)] tracking-wide">{appToDelete.company}</span>?
              </p>

              <div className="p-4 bg-red-500/5 border border-red-500/20 flex items-start gap-3">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-[13px] text-red-400 font-medium leading-relaxed">
                  This action cannot be undone. All data, notes, and metrics associated with this application will be permanently removed.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-0 flex justify-end gap-3 mt-2">
              <button
                onClick={() => setAppToDelete(null)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteApp}
                className="btn btn-destructive"
              >
                Delete <X size={14} className="opacity-50" />
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedApp && (
        <AppDetailModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}

      {showBulkNotify && (
        <BulkNotifyModal
          isOpen={showBulkNotify}
          onClose={() => {
            setShowBulkNotify(false);
            if (!isSendProgressActive) mutate(); // Refresh tracker data if we sent things
          }}
          applications={applications}
          onSendProgress={(items, isActive) => {
            setSendProgressItems(items);
            setIsSendProgressActive(isActive);
            if (!isActive) mutate(); // Refresh data when done
          }}
        />
      )}

      <SendProgressToast
        items={sendProgressItems}
        isActive={isSendProgressActive}
        onDismiss={() => {
          setIsSendProgressActive(false);
          setSendProgressItems([]);
        }}
      />
    </div>
  );
}
