'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Mail, Loader2, AlertCircle, Inbox, Send, Archive, Trash2, CheckCircle2, Edit2, Clock, CornerUpLeft, Forward, RefreshCw, Search, Paperclip, FileText, Image as ImageIcon, FileArchive, FileSpreadsheet, FileCode, File as FileGeneric, Star } from 'lucide-react';
import { auth } from '@/infrastructure/_legacy_firebase/client';
import { EmptyState, ErrorState } from '@/shared/design-system/components/StateMessages';
import { useCompose } from '@/app/context/ComposeContext';
import { useEmails, useEmailCounts } from '@/shared/hooks';
import { Pagination, ConfirmDialog } from '@/shared/design-system/components';
import Ripple from '@/shared/design-system/components/Ripple';

const fetcher = url => fetch(url).then(async res => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch');
  return data;
});

import { sanitizeHtml } from '@/shared/utils/sanitize';


// Utility to parse Name and Email from a string like "Name <email@example.com>"
function parseEmail(fullStr) {
  if (!fullStr) return { name: '', email: '' };
  const match = fullStr.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (!match) return { name: '', email: fullStr };
  return { name: match[1]?.trim() || '', email: match[2]?.trim() || fullStr };
}

import { useAuth } from '@/shared/context/AuthContext';

export default function InboxPage() {
  const { user, session } = useAuth();
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const { openCompose, minimizeAllFullScreen } = useCompose();
  const [page, setPage] = useState(1);
  const [confirmState, setConfirmState] = useState({ open: false, action: null, payload: null, title: '', message: '' });
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Reset page when folder or search changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [activeFolder, searchQuery]);

  // Fetch emails based on selected folder and search query (polls every 5s for live updates)
  const limitCount = 50;
  const offset = (page - 1) * limitCount;
  
  // Use our native Firebase hook instead of the crashing backend API
  const { emails, total, hasMore, isLoading, isError: error, mutate } = useEmails(activeFolder, searchQuery, limitCount, offset);
  const { counts, mutate: mutateCounts } = useEmailCounts();

  // Auto-sync on mount (Recursive to fetch 100% of emails without timing out)
  useEffect(() => {
    let isMounted = true;
    const syncEmails = async () => {
      try {
        if (!user) return;
        
        let shouldContinue = true;
        let totalSynced = 0;
        while (shouldContinue && isMounted) {
          const res = await fetch('/api/emails/sync', { 
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          });
          if (!res.ok) break;
          const data = await res.json();
          totalSynced += data.count || 0;
          if (isMounted) {
            mutate();
            mutateCounts();
          }
          // Backend returns has_more flag to indicate if there are more emails to process
          if (!data.success || !data.has_more || data.count === 0) {
            shouldContinue = false;
          }
        }
        if (totalSynced > 0) {
          console.log(`[email-sync] ✅ Complete: ${totalSynced} total emails synced`);
        }
      } catch (error) {
        console.error('Failed to sync emails:', error);
      }
    };
    if (user) syncEmails();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Deep linking — handles cross-folder email navigation from tracker timeline
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailId = params.get('email_id');
    if (!emailId || selectedEmail) return;

    // Map email types to valid sidebar folder IDs
    // 'archive' emails don't have a folder — show them in 'sent' since they're archived sent emails
    const mapToFolder = (type) => {
      if (type === 'archive') return 'sent';
      if (!type) return 'inbox';
      return type;
    };

    // Try to find in the currently loaded emails first
    if (emails && emails.length > 0) {
      const target = emails.find(e => e.id === emailId);
      if (target) {
        const folder = mapToFolder(target.type);
        if (folder !== activeFolder) {
          setActiveFolder(folder);
        }
        setSelectedEmail(target);
        window.history.replaceState(null, '', '/inbox');
        return;
      }
    }

    // Not found in current folder — fetch directly from API (cross-folder deep link)
    const fetchDeepLinkedEmail = async () => {
      try {
        const res = await fetch(`/api/emails?type=all&limit=2000`, {
          headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const target = (data.emails || []).find(e => e.id === emailId);
        if (target) {
          const folder = mapToFolder(target.type);
          if (folder !== activeFolder) {
            setActiveFolder(folder);
          }
          setSelectedEmail(target);
          window.history.replaceState(null, '', '/inbox');
        }
      } catch (err) {
        console.error('[deep-link] Failed to fetch email:', err);
      }
    };

    fetchDeepLinkedEmail();
  }, [emails, selectedEmail, activeFolder, session]);

  const FILTERS = ['All', 'Primary', 'Recruiters', 'Assessments', 'Rejections'];
  const SIDEBAR_ITEMS = [
    { id: 'inbox', icon: Inbox, label: 'Inbox', count: counts?.inbox || 0 },
    { id: 'starred', icon: Star, label: 'Starred', count: counts?.starred || 0 },
    { id: 'sent', icon: Send, label: 'Sent', count: counts?.sent || 0 },
    { id: 'draft', icon: Edit2, label: 'Drafts', count: counts?.draft || 0 },
    { id: 'scheduled', icon: Clock, label: 'Scheduled', count: counts?.scheduled || 0 },
    { id: 'trash', icon: Trash2, label: 'Trash', count: counts?.trash || 0 },
  ];

  // Client-side filtering and search
  const filteredEmails = (emails || []).filter(email => {
    let matchesSearch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      matchesSearch =
        (email.subject && email.subject.toLowerCase().includes(q)) ||
        (email.from_email && email.from_email.toLowerCase().includes(q)) ||
        (email.to_email && email.to_email.toLowerCase().includes(q)) ||
        (email.preview && email.preview.toLowerCase().includes(q));
    }

    let matchesFilter = true;
    if (activeFilter === 'Recruiters') {
      matchesFilter = email.from_email?.match(/talent|careers|hr|recruiting/i) || email.subject?.match(/opportunity|role|position/i);
    } else if (activeFilter === 'Rejections') {
      matchesFilter = email.subject?.match(/update on|status of your|regret to|moving forward with other/i) || email.preview?.match(/regret to|other candidates|not selected/i);
    } else if (activeFilter === 'Assessments') {
      matchesFilter = email.subject?.match(/assessment|test|hackerrank|coderpad/i);
    }

    return matchesSearch && matchesFilter;
  });

  // Group into threads
  const threads = Object.values(filteredEmails.reduce((acc, email) => {
    const key = email.thread_id || email.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(email);
    return acc;
  }, {}));

  // Sort threads by latest email
  threads.sort((a, b) => new Date(b[0].created_at) - new Date(a[0].created_at));

  const handleReply = () => {
    openCompose({
      to: selectedEmail.from_email,
      subject: selectedEmail.subject?.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
      body: `<br><br><div class="gmail_quote">On ${new Date(selectedEmail.created_at).toLocaleString()}, ${selectedEmail.from_email} wrote:<br><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">${selectedEmail.body_html || selectedEmail.preview}</blockquote></div>`,
      thread_id: selectedEmail.thread_id || selectedEmail.gmail_id || selectedEmail.id,
      in_reply_to: selectedEmail.gmail_id,
      references: selectedEmail.gmail_id
    });
  };

  const handleForward = () => {
    openCompose({
      subject: selectedEmail.subject?.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject}`,
      body: `<br><br><div class="gmail_quote">---------- Forwarded message ---------<br>From: ${selectedEmail.from_email}<br>Date: ${new Date(selectedEmail.created_at).toLocaleString()}<br>Subject: ${selectedEmail.subject}<br>To: ${selectedEmail.to_email}<br><br>${selectedEmail.body_html || selectedEmail.preview}</div>`,
      thread_id: selectedEmail.thread_id || selectedEmail.gmail_id || selectedEmail.id,
      references: selectedEmail.gmail_id
    });
  };

  const handleBulkAction = async (action, ids) => {
    try {
      const updates = {};
      let isDelete = false;

      switch (action) {
        case 'trash': updates.type = 'trash'; break;
        case 'archive': updates.type = 'archive'; break;
        case 'read': updates.is_read = true; break;
        case 'unread': updates.is_read = false; break;
        case 'restore': updates.type = 'inbox'; break;
        case 'delete': isDelete = true; break;
        default: return;
      }

      // Optimistic Update
      let optimisticEmails = [...(emails || [])];
      
      if (isDelete) {
        optimisticEmails = optimisticEmails.filter(e => !ids.includes(e.id));
      } else {
        ids.forEach(id => {
          const idx = optimisticEmails.findIndex(e => e.id === id);
          if (idx !== -1) {
            optimisticEmails[idx] = { ...optimisticEmails[idx], ...updates };
          }
        });
      }

      mutate(optimisticEmails, false);
      setSelectedIds([]);

      if (isDelete) {
        await fetch('/api/emails', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids })
        });
        toast.success(`Deleted ${ids.length} emails`);
      } else {
        await fetch('/api/emails', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, ...updates })
        });
        toast.success(
          action === 'trash' ? `Moved ${ids.length} emails to Trash` :
          action === 'archive' ? `Archived ${ids.length} emails` :
          action === 'read' ? `Marked ${ids.length} as Read` :
          action === 'unread' ? `Marked ${ids.length} as Unread` :
          action === 'restore' ? `Restored ${ids.length} emails` : `Updated ${ids.length} emails`
        );
      }
      mutate();
      mutateCounts();
      if (ids.includes(selectedEmail?.id)) setSelectedEmail(null);
    } catch (e) {
      console.error('Bulk action failed', e);
      toast.error('Action failed');
    }
  };

  const toggleStar = async (email, e) => {
    if (e) e.stopPropagation();
    try {
      const isStarred = !email.is_starred;
      mutate(emails.map(m => m.id === email.id ? { ...m, is_starred: isStarred } : m), false);
      await fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: email.id, is_starred: isStarred })
      });
      mutate();
      mutateCounts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to star email');
    }
  };

  const handleTrash = () => {
    if (activeFolder === 'trash') {
      setConfirmState({
        open: true,
        action: 'delete',
        payload: [selectedEmail.id],
        title: 'Delete Forever',
        message: 'Are you sure you want to permanently delete this email? This cannot be undone.'
      });
    } else {
      handleBulkAction('trash', [selectedEmail.id]);
    }
  };

  const handleRestore = () => handleBulkAction('restore', [selectedEmail.id]);

  return (
    <div className="flex h-screen -mx-10 -my-8 bg-[var(--bg-base)]">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-[var(--border-subtle)] flex flex-col h-full bg-[var(--bg-base)] shrink-0 pt-8">
        <div className="px-6 mb-8">
          <button onClick={() => openCompose({})} className="w-full relative overflow-hidden py-3.5 bg-white text-black text-[12px] font-black tracking-[0.1em] uppercase flex items-center justify-center gap-2 transition-all duration-300 hover:bg-blue-600 hover:text-white hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] rounded-none group border border-transparent hover:border-blue-600">
            <Edit2 size={14} strokeWidth={2.5} className="group-hover:scale-110 transition-transform duration-300" /> Compose
          </button>
        </div>
        <div className="flex flex-col flex-1 px-4">
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveFolder(item.id); setSelectedEmail(null); minimizeAllFullScreen(); }}
              className={`w-full group flex items-center justify-between px-4 py-3 mb-2 relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] border border-transparent ${activeFolder === item.id
                  ? 'bg-white/[0.02] border-[var(--border-subtle)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.01] hover:border-[var(--border-subtle)]'
                }`}
            >
              <Ripple />
              {/* Motion Hover Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--c-primary)]/10 via-[var(--c-primary)]/5 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-0" />

              {/* Active Border */}
              {activeFolder === item.id && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-primary)] shadow-[0_0_12px_rgba(99,102,241,0.8)] z-10" />
              )}

              <div className="relative z-10 flex items-center gap-3">
                <item.icon size={16} strokeWidth={activeFolder === item.id ? 2.5 : 2} className={`transition-all duration-300 ${activeFolder === item.id ? 'text-[var(--c-primary)]' : 'group-hover:text-[var(--c-primary)]/70'}`} />
                <span className={`text-[12px] font-bold tracking-wide uppercase transition-all duration-300 ${activeFolder === item.id ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>{item.label}</span>
              </div>

              {item.count > 0 && (
                <span className={`relative z-10 text-[10px] font-black min-w-[28px] h-6 px-1.5 flex items-center justify-center rounded-none border transition-all ${activeFolder === item.id
                    ? 'bg-[var(--c-primary)] text-white border-[var(--c-primary)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)] group-hover:bg-[var(--bg-hover)] group-hover:text-[var(--text-secondary)]'
                  }`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Middle Pane: Email List */}
      <div className="w-[400px] border-r border-[var(--border-subtle)] flex flex-col h-full bg-[var(--bg-surface)] shrink-0 pt-8">
        <div className="px-6 pb-5 border-b border-[var(--border-subtle)] flex flex-col gap-5 bg-[var(--bg-surface)] z-10 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-[18px] font-black tracking-tight text-[var(--text-primary)] uppercase">{activeFolder} ({emails?.length || 0})</h2>
            <button
              disabled={isManualSyncing}
              onClick={async () => {
                try {
                  setIsManualSyncing(true);
                  let shouldContinue = true;
                  let totalSynced = 0;
                  while (shouldContinue) {
                    const res = await fetch('/api/emails/sync', { 
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                      }
                    });
                    if (!res.ok) {
                      if (res.status === 403) {
                        window.location.href = `/api/auth/google?uid=${encodeURIComponent(user?.uid || user?.id)}&token=${encodeURIComponent(session?.access_token || '')}`;
                      } else if (res.status === 401) {
                        toast.error('Session expired. Please log in again.');
                      } else {
                        toast.error((await res.json()).error || 'Failed to sync');
                      }
                      break;
                    }
                    const data = await res.json();
                    totalSynced += data.count || 0;
                    mutate();
                    mutateCounts();
                    if (!data.success || data.count < 100) {
                      shouldContinue = false;
                    }
                  }
                  toast.success(`Sync complete. ${totalSynced} new emails fetched.`);
                } catch (e) {
                  console.error(e);
                } finally {
                  setIsManualSyncing(false);
                }
              }}
              className={`text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ${isManualSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Sync Emails"
            >
              <RefreshCw size={14} className={isManualSyncing || isLoading ? "animate-spin text-[var(--c-primary)]" : ""} />
            </button>
            <button
              disabled={isAnalyzing}
              onClick={async () => {
                setIsAnalyzing(true);
                toast.info('Analyzing all emails & rebuilding tracker...');
                try {
                  const res = await fetch('/api/emails/reanalyze', { method: 'POST' });
                  const data = await res.json();
                  if (data.success) {
                    toast.success(`Analysis complete! Fixed ${data.summary?.statuses_updated || 0} statuses, removed ${data.summary?.deleted_fake_apps || 0} fake apps.`);
                    mutate();
                    mutateCounts();
                  } else {
                    toast.error(data.error || 'Analysis failed');
                  }
                } catch (err) {
                  toast.error('Analysis failed: ' + err.message);
                } finally {
                  setIsAnalyzing(false);
                }
              }}
              className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Re-analyze all emails & rebuild tracker data"
            >
              {isAnalyzing ? <Loader2 size={12} className="animate-spin inline mr-1" /> : <CheckCircle2 size={12} className="inline mr-1" />}
              {isAnalyzing ? 'Analyzing...' : 'Analyze All'}
            </button>
          </div>

          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--c-primary)] transition-colors" />
            <input
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-none py-2.5 pl-9 pr-4 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex bg-[var(--bg-hover)] p-1 overflow-x-auto hide-scrollbar">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all ${activeFilter === f ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[var(--border-subtle)]' : 'bg-transparent text-[var(--text-primary)]/40 hover:text-[var(--text-primary)] border border-transparent'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
              <Loader2 className="animate-spin mb-3 text-[var(--c-primary)]" size={24} />
              <div className="text-[12px] font-mono tracking-widest uppercase">Syncing...</div>
            </div>
          ) : error ? (
            <ErrorState
              icon={AlertCircle}
              title="Connection Error"
              message={error.message}
            />
          ) : threads.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Inbox Zero"
              message={searchQuery || activeFilter !== 'All' ? 'No emails match your current filters.' : 'You have no emails in this folder. Enjoy the silence.'}
            />
          ) : (
            <>
              {selectedIds.length > 0 && (
                <div className="sticky top-0 z-20 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] p-2 flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-3 pl-2">
                    <input type="checkbox" className="w-3.5 h-3.5 accent-[var(--c-primary)]" checked onChange={() => setSelectedIds([])} />
                    <span className="text-xs font-bold text-[var(--text-primary)]">{selectedIds.length} selected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {activeFolder === 'trash' ? (
                      <>
                        <button onClick={() => handleBulkAction('restore', selectedIds)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors tooltip" title="Restore to Inbox"><Inbox size={14} /></button>
                        <button onClick={() => setConfirmState({ open: true, action: 'delete', payload: selectedIds, title: 'Delete Forever', message: `Permanently delete ${selectedIds.length} email(s)?` })} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors tooltip" title="Delete Forever"><Trash2 size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleBulkAction('read', selectedIds)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors tooltip" title="Mark as Read"><CheckCircle2 size={14} /></button>
                        <button onClick={() => handleBulkAction('unread', selectedIds)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors tooltip" title="Mark as Unread"><Clock size={14} /></button>
                        <button onClick={() => handleBulkAction('archive', selectedIds)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors tooltip" title="Archive"><Archive size={14} /></button>
                        <button onClick={() => handleBulkAction('trash', selectedIds)} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors tooltip" title="Trash"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              )}
              {threads.map((thread, index) => {
                const email = thread[0];
                const count = thread.length;
                const isSelected = selectedEmail?.id === email.id;
                const isChecked = selectedIds.includes(email.id);
                const date = new Date(email.created_at);
                const isToday = new Date().toDateString() === date.toDateString();
                const timeStr = isToday ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                return (
                  <div
                    key={email.id}
                    onClick={(e) => {
                      if (e.target.type === 'checkbox') return;
                      setSelectedEmail(email);
                      minimizeAllFullScreen();
                      if (!email.is_read) {
                        mutate(emails.map(m => m.id === email.id ? { ...m, is_read: true } : m), false);
                        fetch('/api/emails', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: email.id, is_read: true })
                        }).then(() => mutate());
                      }
                    }}
                    className={`p-4 border-b border-[var(--border-subtle)] cursor-pointer transition-all group flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300 fill-mode-both ${isSelected ? 'bg-[var(--bg-elevated)] border-l-2 border-l-[var(--c-primary)]' : 'hover:bg-[var(--bg-hover)] border-l-2 border-l-transparent'} ${!email.is_read ? 'bg-[var(--bg-surface)]' : 'opacity-80'}`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex flex-col items-center gap-3 pt-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 accent-[var(--c-primary)] cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(prev => [...prev, email.id]);
                          else setSelectedIds(prev => prev.filter(id => id !== email.id));
                        }}
                      />
                      <button onClick={(e) => toggleStar(email, e)} className="text-[var(--text-muted)] hover:text-yellow-500 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={email.is_starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={email.is_starred ? "text-yellow-500" : ""}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[13px] truncate pr-2 ${!email.is_read ? 'font-black text-[var(--text-primary)]' : 'font-semibold text-[var(--text-primary)]/70'}`}>
                          {((email.type === 'sent' ? email.to_email : email.from_email) || 'Unknown').split('@')[0]}
                          {count > 1 && <span className="ml-2 text-[9px] font-black bg-[var(--border-subtle)] text-[var(--text-primary)] px-1.5 py-0.5 rounded-none">{count}</span>}
                        </span>
                        <span suppressHydrationWarning className={`text-[10px] font-mono whitespace-nowrap ${isSelected ? 'text-[var(--c-primary)]' : 'text-[var(--text-primary)]/40'}`}>
                          {timeStr}
                        </span>
                      </div>
                      <div className={`text-[12px] mb-1 whitespace-normal break-words ${!email.is_read ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]/60'}`}>
                        {email.subject || '(no subject)'}
                      </div>
                      <div className="text-[11px] text-[var(--text-primary)]/40 line-clamp-2 leading-relaxed">
                        {email.preview}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <div className="mt-auto border-t border-[var(--border-subtle)]">
            <Pagination page={page} setPage={setPage} total={total} hasMore={hasMore} itemName="emails" />
          </div>
        </div>
      </div>

      {/* Right Pane: Email Detail */}
      <div id="inbox-right-pane" className="flex-1 bg-[var(--bg-base)] flex flex-col h-full relative overflow-hidden pt-8">
        {selectedEmail ? (() => {
          // Find the thread that contains the selected email
          const currentThread = threads.find(t => t.some(e => e.id === selectedEmail.id)) || [selectedEmail];
          // Sort thread chronologically (oldest first)
          const sortedThread = [...currentThread].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

          return (
            <div className="flex flex-col h-full">
              {/* Action Bar */}
              <div className="px-8 pb-5 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {(() => {
                    const isSent = selectedEmail.type === 'sent';
                    const primaryEmailStr = isSent ? selectedEmail.to_email : selectedEmail.from_email;
                    const secondaryEmailStr = isSent ? `From: ${selectedEmail.from_email}` : `To: ${selectedEmail.to_email}`;
                    const { name, email } = parseEmail(primaryEmailStr || '');
                    return (
                      <>
                        <div className="w-10 h-10 rounded-none bg-[var(--bg-base)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-secondary)] text-[14px] font-black shrink-0">
                          {(name || email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">
                            {name ? `${name} ` : ''}
                            <span className="text-[var(--text-secondary)] font-normal">&lt;{email}&gt;</span>
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">{secondaryEmailStr}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  {activeFolder === 'draft' ? (
                    <button onClick={() => openCompose({})} className="px-4 py-2 bg-[var(--c-primary)] hover:opacity-90 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"><Edit2 size={12} /> Resume</button>
                  ) : (
                    <>
                      <button onClick={handleReply} className="w-9 h-9 flex items-center justify-center bg-[var(--bg-hover)] hover:bg-[var(--c-primary)] hover:text-white text-[var(--text-primary)]/50 transition-all" title="Reply"><CornerUpLeft size={14} /></button>
                      <button onClick={handleForward} className="w-9 h-9 flex items-center justify-center bg-[var(--bg-hover)] hover:bg-[var(--c-primary)] hover:text-white text-[var(--text-primary)]/50 transition-all" title="Forward"><Forward size={14} /></button>
                    </>
                  )}
                  <div className="w-px h-6 bg-[var(--border-subtle)] mx-2" />
                  {activeFolder === 'trash' && (
                    <button onClick={handleRestore} className="w-9 h-9 flex items-center justify-center bg-[var(--bg-hover)] hover:bg-[var(--c-primary)] hover:text-white text-[var(--text-primary)]/50 transition-all mr-1" title="Restore to Inbox"><Inbox size={14} /></button>
                  )}
                  <button onClick={handleTrash} className="w-9 h-9 flex items-center justify-center bg-[var(--bg-hover)] hover:bg-red-500 hover:text-white text-[var(--text-primary)]/50 transition-all" title={activeFolder === 'trash' ? 'Delete Forever' : 'Trash'}><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Email Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                {/* Header Area */}
                <div className="px-8 md:px-12 pt-10 pb-8 shrink-0">
                  <h1 className="text-[24px] md:text-[28px] font-black text-[var(--text-primary)] tracking-tight leading-tight mb-8">
                    {selectedEmail.subject || '(no subject)'}
                  </h1>

                  {sortedThread.map((email, idx) => {
                    let attachments = [];
                    const match = email.body_html?.match(/data-attachments='(.*?)'/);
                    if (match) {
                      try {
                        attachments = JSON.parse(match[1].replace(/&#39;/g, "'"));
                      } catch (e) { }
                    }

                    return (
                      <div key={email.id} className={idx > 0 ? "mt-12 pt-12 border-t border-[var(--border-subtle)]" : "mt-0"}>

                        <div className="flex items-start gap-5">
                          {/* Avatar */}
                          {(() => {
                            const { name, email: emailAddr } = parseEmail(email.from_email);
                            const initial = (name || emailAddr || '?').charAt(0).toUpperCase();
                            const colors = ['bg-blue-500/10 text-blue-400 border-blue-500/20', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', 'bg-purple-500/10 text-purple-400 border-purple-500/20', 'bg-amber-500/10 text-amber-400 border-amber-500/20', 'bg-rose-500/10 text-rose-400 border-rose-500/20'];
                            const colorClass = colors[emailAddr.length % colors.length];

                            return (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-black border ${colorClass} shrink-0`}>
                                {initial}
                              </div>
                            );
                          })()}

                          {/* Header Info */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-start justify-between gap-4 mb-1">
                              <div className="flex flex-col gap-1 whitespace-normal break-words">
                                {(() => {
                                  const { name, email: emailAddr } = parseEmail(email.from_email);
                                  return (
                                    <div className="flex items-center gap-3">
                                      <span className="text-[15px] font-bold text-[var(--text-primary)] whitespace-normal break-words">
                                        {name ? name : emailAddr}
                                      </span>
                                      {email.application?.company && (
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[var(--c-primary)]/10 text-[var(--c-primary)] border border-[var(--c-primary)]/20 shrink-0">
                                          {email.application.company} • {email.application.status}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })()}
                                <div className="text-[13px] text-[var(--text-primary)]/60 whitespace-normal break-words flex items-center gap-1.5">
                                  {(() => {
                                    const { name, email: emailAddr } = parseEmail(email.from_email);
                                    const { name: toName, email: toEmailAddr } = parseEmail(email.to_email || '');
                                    return (
                                      <>
                                        <span className="text-[var(--text-primary)]/40">to</span>
                                        {email.type === 'sent' ? (
                                          <span className="font-medium text-[var(--text-primary)]/80">{toName || toEmailAddr || 'me'}</span>
                                        ) : (
                                          <span className="font-medium text-[var(--text-primary)]/80">me</span>
                                        )}
                                        <span className="text-[var(--text-primary)]/30 mx-1">•</span>
                                        <span>&lt;{emailAddr}&gt;</span>
                                      </>
                                    )
                                  })()}
                                </div>
                              </div>
                              <span suppressHydrationWarning className="text-[12px] text-[var(--text-primary)]/50 font-medium whitespace-nowrap shrink-0 pt-1">
                                {new Date(email.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="w-full border-t border-[var(--border-subtle)]" />

                {/* Email Body Area */}
                <div className="w-full px-8 md:px-12 py-10 flex-1">
                  {sortedThread.map((email, idx) => {
                    let attachments = email.metadata?.attachments || [];
                    
                    return (
                      <div key={`body-${email.id}`} className={idx > 0 ? "mt-10" : ""}>
                        <div
                          className="prose prose-zinc max-w-none text-[15px] leading-relaxed text-[var(--text-primary)]/90 
                            [&_a]:!text-[var(--c-primary)] [&_a]:!no-underline hover:[&_a]:!underline
                            [&_blockquote]:!border-l-4 [&_blockquote]:!border-[var(--border-strong)] [&_blockquote]:!bg-[var(--bg-hover)] [&_blockquote]:!p-4 [&_blockquote]:!my-4 [&_blockquote]:!not-italic [&_blockquote]:!text-[var(--text-primary)]/70
                            [&_ul]:!pl-5 [&_ol]:!pl-5 [&_li]:!mb-1
                            [&_h1]:!text-[var(--text-primary)] [&_h2]:!text-[var(--text-primary)] [&_h3]:!text-[var(--text-primary)] [&_h4]:!text-[var(--text-primary)]
                            [&_p]:!mb-4
                            [&_*]:!text-[var(--text-primary)] [&_*]:!bg-transparent [&_img]:!bg-transparent"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body_html || email.preview || '') }}
                        />

                        {/* Attachments UI for this specific message */}
                        {email.metadata?.attachments && email.metadata.attachments.length > 0 && (
                          <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] flex flex-wrap gap-4">
                            {email.metadata.attachments.map((att, i) => {
                              const isAvailable = att.partId != null || att.filename != null;
                              const partParam = att.partId != null ? encodeURIComponent(att.partId) : 'fallback';
                              const fileUrl = isAvailable 
                                ? `/api/attachments?messageId=${encodeURIComponent(email.gmail_id)}&partId=${partParam}&filename=${encodeURIComponent(att.filename || '')}`
                                : "#";
                              let Icon = FileGeneric;
                              const t = (att.contentType || '').toLowerCase();
                              if (t.includes('pdf') || t.includes('document') || t.includes('text')) Icon = FileText;
                              else if (t.includes('image')) Icon = ImageIcon;
                              else if (t.includes('zip') || t.includes('tar') || t.includes('rar')) Icon = FileArchive;
                              else if (t.includes('spreadsheet') || t.includes('excel') || t.includes('csv')) Icon = FileSpreadsheet;
                              else if (t.includes('json') || t.includes('xml') || t.includes('html')) Icon = FileCode;

                              return (
                                <div key={i} className="group flex flex-col w-[260px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--text-primary)] transition-colors">
                                  <div className="p-4 flex items-start gap-4">
                                    <div className="w-10 h-10 bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-primary)]/60 shrink-0">
                                      <Icon size={18} strokeWidth={1.5} />
                                    </div>
                                    <div className="flex flex-col min-w-0 pt-0.5">
                                      <span className="text-[13px] font-bold text-[var(--text-primary)] whitespace-normal break-all">{att.filename}</span>
                                      <span className="text-[11px] text-[var(--text-primary)]/50 font-mono mt-1 uppercase tracking-wider">{Math.round(att.size / 1024)} KB</span>
                                    </div>
                                  </div>
                                  <div className="flex border-t border-[var(--border-subtle)]">
                                    {isAvailable ? (
                                      <>
                                        <a href={`${fileUrl}&action=view`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 text-[11px] font-bold text-center text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border-r border-[var(--border-subtle)] uppercase tracking-widest">
                                          View
                                        </a>
                                        <a href={`${fileUrl}&action=download`} download={att.filename} className="flex-1 py-2.5 text-[11px] font-bold text-center text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white transition-colors uppercase tracking-widest">
                                          Download
                                        </a>
                                      </>
                                    ) : (
                                      <div className="flex-1 py-2.5 text-[11px] font-bold text-center text-[var(--text-primary)]/40 uppercase tracking-widest cursor-not-allowed" title="Please resync to fetch this attachment.">
                                        Unavailable
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })() : (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={Mail}
              title="No email selected"
              message="Choose an email from the list to read its contents."
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={() => {
          handleBulkAction(confirmState.action, confirmState.payload);
          setConfirmState({ ...confirmState, open: false });
        }}
        onCancel={() => setConfirmState({ ...confirmState, open: false })}
      />
    </div>
  );
}
