"use client";
import {
  X,
  Clock,
  Send,
  Eye,
  MousePointerClick,
  MessageSquare,
  Briefcase,
  FileDown,
  UserX,
  Loader2,
  CheckCircle2,
  Trash2,
  Mail,
  Globe,
  Monitor,
  MapPin,
  Activity,
  ChevronDown,
  Reply,
  Bell,
  Search,
  Heart,
  HelpCircle,
  ThumbsUp,
  Sparkles,
  Phone,
  Check,
} from "lucide-react";

import { useApplications, useTrackingEvents } from '@/shared/hooks';
import { useEffect, useState, useRef } from "react";
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const EVENT_ICONS = {
  DRAFT_SAVED: <Clock size={14} className="text-gray-400" />,
  SCHEDULED: <Clock size={14} className="text-blue-400" />,
  SENT: <Send size={14} className="text-gray-300" />,
  DELIVERED: <CheckCircle2 size={14} className="text-green-400" />,
  VIEWED: <Eye size={14} className="text-yellow-400" />,
  OPENED: <Eye size={14} className="text-yellow-400" />,
  MULTIPLE_OPENS: <Eye size={14} className="text-orange-500" />,
  LINK_CLICKED: <MousePointerClick size={14} className="text-purple-400" />,
  ATTACHMENT_DOWNLOADED: <FileDown size={14} className="text-indigo-400" />,
  DOWNLOADED: <FileDown size={14} className="text-indigo-400" />,
  REPLY_RECEIVED: <MessageSquare size={14} className="text-green-500" />,
  AUTO_REPLY: <MessageSquare size={14} className="text-gray-400" />,
  INTERVIEW_INVITE: <Briefcase size={14} className="text-[var(--c-accent)]" />,
  REJECTED: <UserX size={14} className="text-[var(--c-danger)]" />,
  NO_RESPONSE: <Clock size={14} className="text-[var(--text-disabled)]" />,
  FOLLOW_UP_SENT: <Send size={14} className="text-blue-500" />,
};

export default function AppDetailModal({ application, onClose }) {
  const { events: data, isLoading, mutate } = useTrackingEvents(application?.id);
  const router = useRouter();

  // Escape key to close & scroll lock
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  useEffect(() => {
    // SWR automatically handles revalidation. Real-time channels are not implemented yet.
  }, [application.id, mutate]);

  const events = data || [];

  const [isEditing, setIsEditing] = useState(false);
  const [editCompany, setEditCompany] = useState(application?.company || "");
  const [editRole, setEditRole] = useState(application?.role || "");
  const [followUpType, setFollowUpType] = useState('gentle_reminder');
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [followUpSuccess, setFollowUpSuccess] = useState(null);
  const [followUpPreview, setFollowUpPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const { updateApplication, deleteApplication } = useApplications();

  useEffect(() => {
    if (application) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditCompany(application.company);
      setEditRole(application.role);
    }
  }, [application]);

  const handleSaveEdits = async () => {
    try {
      await updateApplication(application.id, {
        company: editCompany,
        role: editRole,
      });
      setIsEditing(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("focus"));
      }
    } catch (err) {
      toast.error("Failed to save edits");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    try {
      await deleteApplication(application.id);
      onClose();
      // Trigger SWR revalidation instead of full page reload
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("focus"));
      }
    } catch (err) {
      toast.error("Failed to delete application.");
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="flex h-full items-center justify-center p-4 sm:p-6">
        <div
          className="w-full max-w-6xl max-h-[85vh] flex flex-col relative bg-[var(--bg-base)] border-2 border-[var(--border-strong)] shadow-none rounded-none animate-in zoom-in-95 duration-200 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Premium Header Section */}
          <div className="relative p-5 pb-6 overflow-hidden shrink-0 bg-[var(--bg-surface)] border-b border-[var(--border-strong)] shadow-sm">
            {/* Atmospheric Mesh Gradients */}
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--c-primary)]/5 to-transparent opacity-50" />
            <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[var(--c-primary)]/20 via-[#070709]/5 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="relative flex justify-between items-start z-10 gap-8">
              <div className="flex-1 min-w-0 flex flex-col justify-end pt-2">
                {isEditing ? (
                  <div className="space-y-3 mb-2 pr-4">
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-[var(--text-primary)]/40 mb-1 block">
                        Company Name
                      </label>
                      <input
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] p-2 text-xl font-black focus:outline-none )] rounded-none focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-[var(--text-primary)]/40 mb-1 block">
                        Role / Subject
                      </label>
                      <input
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]/80 p-2 text-sm focus:outline-none )] rounded-none focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                      />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleSaveEdits}
                        className="px-4 py-1.5 bg-white text-black hover:bg-[var(--bg-hover)] transition-colors text-[10px] font-bold uppercase tracking-widest rounded-none"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditCompany(application.company);
                          setEditRole(application.role);
                        }}
                        className="px-4 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)] text-[10px] font-bold uppercase tracking-widest rounded-none"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="group cursor-pointer w-full flex items-start gap-5"
                      onClick={() => setIsEditing(true)}
                    >
                      {/* Brutalist Company Avatar */}
                      <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] shadow-[2px_2px_0px_rgba(255,255,255,0.05)] transition-transform group-hover:-translate-y-1">
                        <span className="text-xl font-black text-[var(--text-primary)]">
                          {application.company ? application.company.charAt(0).toUpperCase() : '?'}
                        </span>
                      </div>
                      
                      <div className="flex flex-col justify-center pt-0">
                        <div className="flex items-center gap-3">
                          <h2
                            className="text-2xl md:text-3xl font-black tracking-tight text-[var(--text-primary)] leading-none whitespace-normal group-hover:opacity-80 transition-opacity"
                            title={application.company}
                          >
                            {application.company}
                          </h2>
                          <svg
                            className="w-4 h-4 text-[var(--text-primary)]/20 group-hover:text-[var(--text-primary)]/60 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </div>
                        
                        {/* Role moved to recruiter section below */}
                      </div>
                    </div>
                    {(() => {
                      // ─── System/non-recruiter sender detection ───
                      const SYSTEM_SENDER_PATTERNS = [
                        'mailer-daemon', 'postmaster', 'noreply', 'no-reply',
                        'donotreply', 'do-not-reply', 'notifications@',
                        'notification@', 'newsletter@', 'news@', 'updates@',
                        'marketing@', 'support@', 'info@', 'hello@mail.',
                        'team@mail.', 'accounts@', 'service@', 'system@',
                        'spline.design', 'rocket.new', 'descript.com', 'speechify.com',
                        'loom.com', 'quillbot', 'chegg.com', 'ocr.space',
                        'mail-delivery-subsystem', 'googlemail.com',
                      ];
                      
                      const isSystemSender = (fromEmail) => {
                        if (!fromEmail) return false;
                        const lower = fromEmail.toLowerCase();
                        return SYSTEM_SENDER_PATTERNS.some(p => lower.includes(p));
                      };

                      const getRecruiterDetails = (app) => {
                        if (!app.emails || app.emails.length === 0) return null;
                        
                        // Check incoming emails first — filter out system senders
                        const incomingEmail = [...app.emails].reverse().find(
                          e => e.from_email && e.type === 'inbox' && !isSystemSender(e.from_email)
                        );
                        if (incomingEmail) {
                          const match = incomingEmail.from_email.match(/^"?([^"<]+)"?\s*<([^>]+)>/);
                          if (match) return { name: match[1].trim(), email: match[2].trim() };
                          return { name: incomingEmail.from_email.split('@')[0], email: incomingEmail.from_email };
                        }

                        // Fallback: check sent emails (the person Joshua contacted)
                        const sentEmail = [...app.emails].reverse().find(
                          e => (e.type === 'sent' || e.type === 'archive') && e.to_email && !isSystemSender(e.to_email)
                        );
                        if (sentEmail) {
                          const match = sentEmail.to_email.match(/^"?([^"<]+)"?\s*<([^>]+)>/);
                          if (match) return { name: match[1].trim(), email: match[2].trim() };
                          return { name: sentEmail.to_email.split('@')[0], email: sentEmail.to_email };
                        }
                        return null;
                      };
                      
                      const recruiter = getRecruiterDetails(application);
                      return (
                        <div className="mt-5 flex flex-wrap w-full items-stretch border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[2px_2px_0px_rgba(255,255,255,0.05)] overflow-hidden">
                           {/* Role Section */}
                           <div className="flex flex-col px-4 py-2 bg-[var(--bg-elevated)] border-b sm:border-b-0 sm:border-r border-[var(--border-strong)] min-w-[150px] flex-1 shrink-0">
                             <span className="text-[8px] text-[var(--text-primary)]/40 uppercase tracking-widest mb-0.5">Role</span>
                             <span className="font-bold text-[12px] text-[var(--text-primary)] tracking-wide truncate">{application.role}</span>
                           </div>

                           {/* Recruiter Section */}
                           {recruiter && (
                             <div className="flex flex-1 min-w-[280px] items-stretch">
                               <div className="flex items-center justify-center px-4 py-2 bg-[var(--bg-elevated)] border-r border-[var(--border-strong)] shrink-0">
                                 <UserX size={14} className="text-[var(--text-primary)]/60" />
                               </div>
                               <div className="flex flex-col px-4 py-2 border-r border-[var(--border-strong)] flex-1 min-w-0">
                                 <span className="text-[8px] text-[var(--text-primary)]/40 uppercase tracking-widest mb-0.5">Recruiter</span>
                                 <span className="font-bold text-[12px] text-[var(--text-primary)] tracking-wide truncate">{recruiter.name}</span>
                               </div>
                               <div className="flex flex-col px-4 py-2 flex-[2] min-w-0">
                                 <span className="text-[8px] text-[var(--text-primary)]/40 uppercase tracking-widest mb-0.5">Contact</span>
                                 <span className="text-[12px] text-[var(--text-primary)]/70 tracking-wide font-mono truncate">{recruiter.email}</span>
                               </div>
                             </div>
                           )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              <div className="flex items-start gap-3 shrink-0">
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white border border-red-500 transition-all font-bold text-[10px] uppercase tracking-widest shadow-[2px_2px_0px_rgba(220,38,38,0.4)]"
                  title="Delete Application"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[var(--text-primary)] transition-all font-bold text-[10px] uppercase tracking-widest shadow-[2px_2px_0px_rgba(255,255,255,0.05)]"
                >
                  <X size={14} />
                  Close
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            {/* Stats Overview */}
            {!isLoading && (() => {
              // Compute real metrics from emails and events
              const appEmails = application?.emails || [];
              const sentEmails = appEmails.filter(e => e.type === 'sent' || e.type === 'archive');
              const inboxEmails = appEmails.filter(e => e.type === 'inbox');
              const totalEmails = appEmails.length;
              const totalReplies = inboxEmails.length;

              // Timeline: first sent and first reply
              const firstSent = sentEmails.length > 0
                ? sentEmails.reduce((earliest, e) => new Date(e.created_at) < new Date(earliest.created_at) ? e : earliest)
                : null;
              const firstReply = inboxEmails.length > 0
                ? inboxEmails.reduce((earliest, e) => new Date(e.created_at) < new Date(earliest.created_at) ? e : earliest)
                : null;
              const lastActivity = appEmails.length > 0
                ? appEmails.reduce((latest, e) => new Date(e.created_at) > new Date(latest.created_at) ? e : latest)
                : null;

              const sentTime = firstSent ? new Date(firstSent.created_at) : (application.created_at ? new Date(application.created_at) : null);
              const firstReplyTime = firstReply ? new Date(firstReply.created_at) : null;
              const lastActivityTime = lastActivity ? new Date(lastActivity.created_at) : null;

              // Reply turnaround: time between first sent and first reply
              let replyTurnaround = null;
              if (sentTime && firstReplyTime && firstReplyTime > sentTime) {
                const diffMs = firstReplyTime - sentTime;
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffDays = Math.floor(diffHours / 24);
                if (diffDays > 0) {
                  replyTurnaround = `${diffDays}d ${diffHours % 24}h`;
                } else if (diffHours > 0) {
                  replyTurnaround = `${diffHours}h ${Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))}m`;
                } else {
                  replyTurnaround = `${Math.floor(diffMs / (1000 * 60))}m`;
                }
              }

              // Days since application
              const daysSinceApp = sentTime
                ? Math.max(0, Math.floor((Date.now() - sentTime.getTime()) / (1000 * 60 * 60 * 24)))
                : 0;

              // Engagement score: weighted by quality of interaction
              const engagementScore = (sentEmails.length * 1) + (inboxEmails.length * 5) + (events.filter(e => e.event_type === 'RESPONSE' || e.event_type === 'REPLY_RECEIVED').length * 3);

              // Confidence score (normalized to 0-1 range)
              const rawConf = application.confidence_score || 0;
              const normalizedConf = rawConf > 1 ? rawConf / 100 : rawConf;

              // Status derivation
              let statusLabel = 'SENT';
              let statusColor = 'text-[var(--text-primary)]/60';
              if (totalReplies > 0) { statusLabel = 'REPLIED'; statusColor = 'text-green-600 dark:text-green-400'; }
              else if (events.some(e => e.event_type === 'RESPONSE')) { statusLabel = 'RESPONDED'; statusColor = 'text-green-600 dark:text-green-400'; }
              else if (events.length > 0 && sentEmails.length > 0) { statusLabel = 'DELIVERED'; statusColor = 'text-blue-600 dark:text-blue-400'; }

              const fmtDate = (d) => d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

              return (
                <div className="mb-10 space-y-4">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-4 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-none ${totalReplies > 0 ? 'bg-green-500' : 'bg-[var(--text-primary)]/30'}`} />
                      <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${statusColor}`}>{statusLabel}</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-primary)]/60 font-mono">
                      {totalEmails} email{totalEmails !== 1 ? 's' : ''} in thread
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
                      <div className="text-[9px] font-bold text-[var(--text-primary)]/40 uppercase tracking-[0.2em] mb-2">Sent</div>
                      <div className="text-[12px] font-bold text-[var(--text-primary)]/80 font-mono">{fmtDate(sentTime)}</div>
                    </div>
                    <div className="p-4 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
                      <div className="text-[9px] font-bold text-[var(--text-primary)]/40 uppercase tracking-[0.2em] mb-2">First Reply</div>
                      <div className={`text-[12px] font-bold font-mono ${firstReplyTime ? 'text-green-400' : 'text-[var(--text-primary)]/40'}`}>{fmtDate(firstReplyTime)}</div>
                    </div>
                    <div className="p-4 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
                      <div className="text-[9px] font-bold text-[var(--text-primary)]/40 uppercase tracking-[0.2em] mb-2">Latest Activity</div>
                      <div className="text-[12px] font-bold text-[var(--text-primary)]/80 font-mono">{fmtDate(lastActivityTime)}</div>
                    </div>
                    <div className="p-4 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
                      <div className="text-[9px] font-bold text-[var(--text-primary)]/40 uppercase tracking-[0.2em] mb-2">Reply Time</div>
                      <div className={`text-[12px] font-bold font-mono ${replyTurnaround ? 'text-green-400' : 'text-[var(--text-primary)]/40'}`}>{replyTurnaround || '—'}</div>
                    </div>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-5 gap-3">
                    <div className="p-3 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                      <div className="text-xl font-black text-[var(--text-primary)]/90">{sentEmails.length}</div>
                      <div className="text-[8px] font-bold text-[var(--text-primary)]/30 uppercase tracking-[0.2em] mt-1">Sent</div>
                    </div>
                    <div className="p-3 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                      <div className={`text-xl font-black ${totalReplies > 0 ? 'text-green-400' : 'text-[var(--text-primary)]/90'}`}>{totalReplies}</div>
                      <div className="text-[8px] font-bold text-[var(--text-primary)]/30 uppercase tracking-[0.2em] mt-1">Replies</div>
                    </div>
                    <div className="p-3 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                      <div className="text-xl font-black text-[var(--text-primary)]/90">{daysSinceApp}</div>
                      <div className="text-[8px] font-bold text-[var(--text-primary)]/30 uppercase tracking-[0.2em] mt-1">Days</div>
                    </div>
                    <div className="p-3 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                      <div className="text-xl font-black text-[var(--text-primary)]/90">{engagementScore}</div>
                      <div className="text-[8px] font-bold text-[var(--text-primary)]/30 uppercase tracking-[0.2em] mt-1">Score</div>
                    </div>
                    <div className="p-3 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center" title={application.ai_intent || "No intent detected"}>
                      <div className="text-xl font-black text-[var(--text-primary)]/90">
                        {normalizedConf > 0 ? `${Math.round(normalizedConf * 100)}%` : '—'}
                      </div>
                      <div className="text-[8px] font-bold text-[var(--text-primary)]/30 uppercase tracking-[0.2em] mt-1">AI Conf</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ═══════ FOLLOW-UP NOTIFIER ═══════ */}
            {(() => {
              const appEmails = application?.emails || [];
              const sortedEmails = [...appEmails].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              const lastSent = sortedEmails.find(e => e.type === 'sent');
              const lastIncoming = sortedEmails.find(e => e.type === 'inbox' || e.type === 'received');
              
              let recipientEmail = null;
              let recipientName = null;
              if (lastIncoming && lastIncoming.from_email) {
                const m = lastIncoming.from_email.match(/^"?([^"<]+)"?\s*<([^>]+)>/);
                if (m) { recipientName = m[1].trim(); recipientEmail = m[2].trim(); }
                else { recipientEmail = lastIncoming.from_email; recipientName = recipientEmail.split('@')[0]; }
              } else if (lastSent && lastSent.to_email) {
                const m = lastSent.to_email.match(/^"?([^"<]+)"?\s*<([^>]+)>/);
                if (m) { recipientName = m[1].trim(); recipientEmail = m[2].trim(); }
                else { recipientEmail = lastSent.to_email; recipientName = recipientEmail.split('@')[0]; }
              }

              const lastEmailDate = lastSent?.created_at || application.created_at;
              const daysSince = Math.floor((Date.now() - new Date(lastEmailDate).getTime()) / (1000 * 60 * 60 * 24));
              const daysText = daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`;
              const lastSubject = lastSent?.subject || `Application for ${application.role}`;

              const FOLLOW_UP_OPTIONS = [
                { value: 'gentle_reminder', label: 'Gentle Reminder', desc: `Nudge about your email sent ${daysText}`, icon: <Bell size={14} className="text-yellow-400" /> },
                { value: 'application_status', label: 'Application Status', desc: 'Where does my application stand?', icon: <Search size={14} className="text-blue-400" /> },
                { value: 'express_interest', label: 'Express Interest', desc: 'Reaffirm enthusiasm for the role', icon: <Heart size={14} className="text-pink-400" /> },
                { value: 'availability_check', label: 'Availability Check', desc: 'Is this position still open?', icon: <HelpCircle size={14} className="text-cyan-400" /> },
                { value: 'request_conversation', label: 'Request a Quick Call', desc: 'Ask for 15 min to connect', icon: <Phone size={14} className="text-green-400" /> },
                { value: 'thank_you_interview', label: 'Thank You (Interview)', desc: 'Post-interview thank-you note', icon: <ThumbsUp size={14} className="text-emerald-400" /> },
                { value: 'next_steps', label: 'Inquire Next Steps', desc: 'Ask about timeline & provide docs', icon: <Clock size={14} className="text-orange-400" /> },
                { value: 'share_update', label: 'Share an Update', desc: 'Mention recent relevant work', icon: <Sparkles size={14} className="text-purple-400" /> },
              ];

              const selectedOption = FOLLOW_UP_OPTIONS.find(o => o.value === followUpType) || FOLLOW_UP_OPTIONS[0];

              const handlePreview = async () => {
                setIsLoadingPreview(true);
                setFollowUpPreview(null);
                setFollowUpSuccess(null);
                try {
                  const res = await fetch('/api/emails/followup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ applicationId: application.id, followUpType, preview: true }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setFollowUpPreview(data);
                  } else {
                    toast.error(`Preview failed: ${data.error}`);
                  }
                } catch (err) {
                  toast.error(`Error: ${err.message}`);
                } finally {
                  setIsLoadingPreview(false);
                }
              };

              const handleSendFollowUp = async () => {
                setIsSendingFollowUp(true);
                setFollowUpSuccess(null);
                try {
                  const res = await fetch('/api/emails/followup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ applicationId: application.id, followUpType }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setFollowUpSuccess(`Follow-up sent to ${data.sentTo}`);
                    setFollowUpPreview(null);
                    toast.success(`✅ Follow-up sent to ${data.sentTo}`);
                    if (mutate) mutate();
                  } else {
                    toast.error(`Failed: ${data.error}`);
                  }
                } catch (err) {
                  toast.error(`Error: ${err.message}`);
                } finally {
                  setIsSendingFollowUp(false);
                }
              };

              if (!recipientEmail) return null;

              return (
                <div className="mb-8 p-5 border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[2px_2px_0px_rgba(255,255,255,0.03)]">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-4">
                    <Reply size={14} className="text-blue-400" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]/80">Follow-Up Notifier</span>
                    <div className="h-px flex-1 bg-[var(--border-subtle)]" />
                  </div>

                  {/* Context Bar */}
                  <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-[var(--text-primary)]/40" />
                      <span className="text-[10px] font-bold text-[var(--text-primary)]/40 uppercase tracking-widest">To:</span>
                      <span className="text-[12px] font-bold text-[var(--text-primary)]/90">{recipientName}</span>
                      <span className="text-[10px] text-[var(--text-primary)]/40 font-mono">({recipientEmail})</span>
                    </div>
                    <div className="w-px h-4 bg-[var(--border-strong)]" />
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-[var(--text-primary)]/40" />
                      <span className="text-[10px] text-[var(--text-primary)]/50">Last email: <strong className="text-[var(--text-primary)]/80">{daysText}</strong></span>
                    </div>
                    <div className="w-px h-4 bg-[var(--border-strong)]" />
                    <div className="text-[10px] text-[var(--text-primary)]/40 font-mono truncate max-w-[300px]" title={lastSubject}>
                      "{lastSubject}"
                    </div>
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-stretch gap-3">
                    {/* Custom Dropdown */}
                    <div className="flex-1 relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setDropdownOpen(prev => !prev)}
                        className="w-full flex items-center gap-3 bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] text-[12px] font-bold px-4 py-3 pr-10 text-left transition-colors hover:border-[var(--c-primary)]/50 focus:outline-none focus:border-[var(--c-primary)]"
                      >
                        <span className="shrink-0">{selectedOption.icon}</span>
                        <span className="flex-1 truncate">{selectedOption.label}</span>
                        <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/40 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Panel */}
                      {dropdownOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-[4px_4px_0px_rgba(0,0,0,0.3)] max-h-[320px] overflow-y-auto custom-scrollbar">
                          {FOLLOW_UP_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setFollowUpType(opt.value);
                                setFollowUpSuccess(null);
                                setFollowUpPreview(null);
                                setDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 border-b border-[var(--border-subtle)]/50 last:border-b-0 ${
                                followUpType === opt.value
                                  ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                                  : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
                              }`}
                            >
                              <span className="shrink-0 w-8 h-8 flex items-center justify-center bg-white/[0.04] border border-[var(--border-subtle)]">
                                {opt.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[12px] font-bold ${
                                    followUpType === opt.value ? 'text-blue-400' : 'text-[var(--text-primary)]/90'
                                  }`}>{opt.label}</span>
                                  {followUpType === opt.value && <Check size={12} className="text-blue-400" />}
                                </div>
                                <span className="text-[10px] text-[var(--text-primary)]/40 leading-tight">{opt.desc}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Preview Button */}
                    <button
                      onClick={handlePreview}
                      disabled={isLoadingPreview}
                      className="flex items-center gap-2 px-5 py-3 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[var(--text-primary)] transition-all font-black text-[10px] uppercase tracking-[0.15em] shrink-0 disabled:opacity-50"
                    >
                      {isLoadingPreview ? (
                        <><Loader2 size={14} className="animate-spin" /> Loading...</>
                      ) : (
                        <><Eye size={14} /> Preview</>  
                      )}
                    </button>

                    {/* Send Button */}
                    <button
                      onClick={handleSendFollowUp}
                      disabled={isSendingFollowUp}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white border border-blue-500 transition-all font-black text-[10px] uppercase tracking-[0.15em] shadow-[2px_2px_0px_rgba(37,99,235,0.4)] shrink-0"
                    >
                      {isSendingFollowUp ? (
                        <><Loader2 size={14} className="animate-spin" /> Sending...</>
                      ) : (
                        <><Send size={14} /> Send Now</>  
                      )}
                    </button>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-[10px] text-[var(--text-primary)]/40 tracking-wide">
                    {selectedOption.desc}
                  </p>

                  {/* Email Preview Panel */}
                  {followUpPreview && (
                    <div className="mt-4 border border-blue-500/30 bg-[var(--bg-elevated)] overflow-hidden">
                      <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2">
                        <Mail size={12} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Email Preview</span>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-[var(--text-primary)]/30 uppercase tracking-widest w-16">To</span>
                          <span className="text-[12px] text-[var(--text-primary)]/80 font-mono">{followUpPreview.to}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-[var(--text-primary)]/30 uppercase tracking-widest w-16">Subject</span>
                          <span className="text-[12px] text-[var(--text-primary)]/90 font-bold">{followUpPreview.subject}</span>
                        </div>
                        <div className="h-px bg-[var(--border-subtle)]" />
                        <div
                          className="text-[13px] text-[var(--text-primary)]/80 leading-relaxed [&_p]:mb-3 [&_strong]:text-[var(--text-primary)] [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-500 [&_blockquote]:pl-3 [&_blockquote]:text-[var(--text-primary)]/50 [&_blockquote]:text-[12px]"
                          dangerouslySetInnerHTML={{ __html: followUpPreview.body }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Success Message */}
                  {followUpSuccess && (
                    <div className="mt-3 flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30">
                      <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                      <span className="text-[11px] font-bold text-green-400">{followUpSuccess}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <h3 className="text-[11px] font-bold text-[var(--text-primary)]/40 uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock size={12} />
                Interaction Timeline
              </h3>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 via-white/10 to-transparent" />
            </div>

            {isLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-[var(--text-primary)]/30" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center p-12 text-[var(--text-primary)]/30 text-[13px] border border-dashed border-[var(--border-subtle)] rounded-none bg-[var(--bg-surface)]">
                No tracking events recorded yet.
              </div>
            ) : (
              <div className="relative ml-2 space-y-8 pb-4">
                {/* Vertical line connecting dots */}
                <div className="absolute left-[11px] top-2 bottom-4 w-[2px] bg-gradient-to-b from-white/10 via-white/5 to-transparent rounded-full" />

                {(() => {
                  const seen = new Set();
                  const dedupedEvents = events.filter(event => {
                    const preview = event.metadata?.preview || '';
                    const key = `${event.event_type}_${preview.substring(0, 50)}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                  return dedupedEvents.map((event, idx) => {
                    const iconComponent = EVENT_ICONS[event.event_type] || (
                    <Clock size={12} className="text-[var(--text-primary)]/40" />
                  );
                  const isPositive = [
                    "OPENED",
                    "MULTIPLE_OPENS",
                    "LINK_CLICKED",
                    "DOWNLOADED",
                    "ATTACHMENT_DOWNLOADED",
                    "REPLY_RECEIVED",
                    "INTERVIEW_INVITE",
                  ].includes(event.event_type);
                  const isNegative = ["REJECTED", "NO_RESPONSE"].includes(
                    event.event_type,
                  );

                  let highlightColor = "text-[var(--text-primary)]/50 border-[var(--border-subtle)]";
                  if (isPositive)
                    highlightColor =
                      "text-[var(--c-success)] border-[var(--c-success)]/30";
                  if (isNegative)
                    highlightColor =
                      "text-[var(--c-danger)] border-[var(--c-danger)]/30";

                  // Resolve the email for this event — match by email_id in app's linked emails
                  const eventEmail = event.email_id 
                    ? application?.emails?.find(e => e.id === event.email_id) || null
                    : null;

                  return (
                    <div key={event.id} className="relative pl-10 group">
                      {/* Timeline Dot */}
                      <div
                        className={`absolute w-6 h-6 rounded-none -left-[1px] top-1 flex items-center justify-center bg-[var(--bg-surface)] border-2 transition-none ${highlightColor} shadow-none z-10`}
                      >
                        {iconComponent}
                      </div>

                      <div 
                        onClick={() => {
                          if (eventEmail) {
                            router.push(`/inbox?email_id=${eventEmail.id}`);
                            onClose();
                          }
                        }}
                        className={`p-5 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-white/[0.03] hover:border-[var(--border-subtle)] transition-all duration-300 shadow-sm ${eventEmail ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={`font-bold text-[12px] tracking-widest uppercase ${isPositive ? "text-[var(--text-primary)]/90" : isNegative ? "text-[var(--c-danger)]/90" : "text-[var(--text-primary)]/70"}`}
                            >
                              {event.event_type.replace(/_/g, " ")}
                            </span>
                          </div>
                          <span className="text-[10px] text-[var(--text-primary)]/40 font-mono tracking-wider">
                            {new Date(event.created_at).toLocaleString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                second: "2-digit",
                              },
                            )}
                          </span>
                        </div>

                        {/* Metadata Parsing */}
                        {event.metadata &&
                          Object.keys(event.metadata).length > 0 && (
                            <div className="mt-4 space-y-3">
                              {/* Location + Device Intelligence Row */}
                              {(event.metadata.city || event.metadata.os || event.metadata.device || event.metadata.ip || event.metadata.open_number || event.metadata.click_number) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-[var(--border-subtle)] mt-3 rounded-none overflow-hidden">
                                  
                                  {/* Location Cell */}
                                  {(event.metadata.city || event.metadata.country) && (
                                    <div className="bg-[var(--bg-surface)] p-3 flex flex-col gap-1 col-span-1 md:col-span-2 hover:bg-[var(--bg-hover)] transition-colors">
                                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-primary)]/40 uppercase tracking-[0.2em] mb-0.5">
                                        <MapPin size={10} className="text-[var(--c-primary)]" />
                                        Location
                                      </div>
                                      <div className="flex justify-between items-center text-[12px]">
                                        <span className="text-[var(--text-primary)]/80 font-medium">
                                          {[event.metadata.city, event.metadata.region, event.metadata.country].filter(Boolean).join(', ')}
                                        </span>
                                        {event.metadata.timezone && (
                                          <span className="text-[var(--text-primary)]/30 font-mono text-[10px] bg-[var(--bg-hover)] px-1.5 py-0.5 border border-[var(--border-subtle)]">{event.metadata.timezone}</span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* System / Device Cell */}
                                  <div className="bg-[var(--bg-surface)] p-3 flex flex-col gap-2 hover:bg-[var(--bg-hover)] transition-colors">
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-primary)]/40 uppercase tracking-[0.2em]">
                                      <Monitor size={10} className="text-[var(--c-primary)]" />
                                      System
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {event.metadata.device && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-primary)]/70 rounded-none">
                                          <span>{event.metadata.device}</span>
                                        </div>
                                      )}
                                      {(event.metadata.os || (!event.metadata.device && event.metadata.userAgent)) && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-primary)]/70 rounded-none">
                                          <span>{event.metadata.os || (() => {
                                            const ua = event.metadata.userAgent || '';
                                            if (ua.includes('Mac OS')) return 'macOS';
                                            if (ua.includes('Windows')) return 'Windows';
                                            if (ua.includes('Linux')) return 'Linux';
                                            if (ua.includes('Android')) return 'Android';
                                            if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
                                            return 'Unknown';
                                          })()}</span>
                                        </div>
                                      )}
                                      {(event.metadata.browser || (!event.metadata.device && event.metadata.userAgent)) && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-primary)]/70 rounded-none">
                                          <Globe size={10} className="text-[var(--text-primary)]/40" />
                                          <span>{event.metadata.browser || (() => {
                                            const ua = event.metadata.userAgent || '';
                                            if (ua.includes('Edg')) return 'Edge';
                                            if (ua.includes('Chrome')) return 'Chrome';
                                            if (ua.includes('Firefox')) return 'Firefox';
                                            if (ua.includes('Safari')) return 'Safari';
                                            return 'Unknown';
                                          })()}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Network & Event Stats Cell */}
                                  <div className="bg-[var(--bg-surface)] p-3 flex flex-col gap-2 hover:bg-[var(--bg-hover)] transition-colors">
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-primary)]/40 uppercase tracking-[0.2em]">
                                      <Activity size={10} className="text-[var(--c-primary)]" />
                                      Network & Stats
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {event.metadata.ip && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-primary)]/50 font-mono rounded-none">
                                          {event.metadata.ip}
                                        </div>
                                      )}
                                      {event.metadata.isp && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-primary)]/50 rounded-none whitespace-normal break-all max-w-[120px]" title={event.metadata.isp}>
                                          {event.metadata.isp}
                                        </div>
                                      )}
                                      {event.metadata.open_number && (
                                        <div className="px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-widest rounded-none">
                                          Open #{event.metadata.open_number}
                                        </div>
                                      )}
                                      {event.metadata.click_number && (
                                        <div className="px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-bold text-purple-600 dark:text-purple-500 uppercase tracking-widest rounded-none">
                                          Click #{event.metadata.click_number}
                                        </div>
                                      )}
                                      {event.metadata.is_apple_privacy_relay && (
                                        <div className="px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-bold text-orange-600 dark:text-orange-500 uppercase tracking-widest rounded-none" title="Apple Mail Privacy Protection may proxy this request">
                                          ⚠ Relay
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Link / File Info */}
                              {event.metadata.url && (
                                <div className="text-[11px] text-[var(--text-primary)]/50 flex items-center gap-2">
                                  <strong className="text-[var(--text-primary)]/30 font-bold tracking-widest uppercase text-[9px] shrink-0">
                                    Link:
                                  </strong>
                                  <a
                                    href={event.metadata.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[var(--c-primary)]/80 hover:text-[var(--c-primary)] hover:underline whitespace-normal break-all transition-colors"
                                  >
                                    {event.metadata.url}
                                  </a>
                                </div>
                              )}
                              {event.metadata.attachmentName && (
                                <div className="text-[11px] text-[var(--text-primary)]/50 flex items-center gap-2">
                                  <strong className="text-[var(--text-primary)]/30 font-bold tracking-widest uppercase text-[9px] shrink-0">
                                    File:
                                  </strong>
                                  <span className="whitespace-normal break-all">
                                    {event.metadata.attachmentName}
                                  </span>
                                </div>
                              )}

                              {/* Messages / AI Reasoning */}
                              {(event.metadata.messagePreview ||
                                event.metadata.preview) && (
                                <div className="text-[12px] text-[var(--text-primary)]/70 border-l border-[var(--border-subtle)] pl-4 mt-3 whitespace-pre-wrap font-sans leading-relaxed py-1 italic opacity-80">
                                  {`"${event.metadata?.messagePreview || event.metadata?.preview}"`}
                                </div>
                              )}

                              {/* Fallback for unparsed metadata */}
                              {!event.metadata.ip &&
                                !event.metadata.userAgent &&
                                !event.metadata.city &&
                                !event.metadata.url &&
                                !event.metadata.attachmentName &&
                                !event.metadata.messagePreview &&
                                !event.metadata.preview && (
                                  <div className="p-3 bg-[var(--bg-elevated)] rounded-none border border-[var(--border-subtle)] overflow-x-auto mt-2">
                                    <pre className="text-[10px] text-[var(--text-primary)]/40 font-mono">
                                      {JSON.stringify(event.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                            </div>
                          )}

                        {/* Explainable AI: Engine Metadata Breakdown */}
                        {event.engine_metadata && (
                          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]/50">
                            <div className="flex items-center justify-between cursor-pointer group/engine">
                              <span className="text-[9px] font-bold text-[var(--text-primary)]/30 uppercase tracking-[0.2em] group-hover/engine:text-[var(--c-primary)] transition-colors">
                                Engine Analysis Breakdown
                              </span>
                              <span className="text-[10px] font-mono text-[var(--c-primary)]/80">
                                {event.ai_confidence_score !== undefined ? `${Math.round(event.ai_confidence_score * 100)}% Conf` : ''}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-2 opacity-60 hover:opacity-100 transition-opacity">
                              <div className="p-2 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[9px] font-mono">
                                <strong className="block text-[var(--text-primary)]/60 mb-1">Rules</strong>
                                {event.engine_metadata.rules?.confidence * 100}%
                                {event.engine_metadata.rules?.flags?.length > 0 && (
                                  <div className="text-red-400 mt-1">{event.engine_metadata.rules.flags.join(', ')}</div>
                                )}
                              </div>
                              <div className="p-2 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[9px] font-mono">
                                <strong className="block text-[var(--text-primary)]/60 mb-1">Algo</strong>
                                {Math.round((event.engine_metadata.algorithmic?.confidence || 0) * 100)}%
                                {event.engine_metadata.algorithmic?.features && Object.keys(event.engine_metadata.algorithmic.features).length > 0 && (
                                  <div className="text-blue-400 mt-1">{Object.keys(event.engine_metadata.algorithmic.features).join(', ')}</div>
                                )}
                              </div>
                              <div className="p-2 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[9px] font-mono">
                                <strong className="block text-[var(--text-primary)]/60 mb-1">AI</strong>
                                {Math.round((event.engine_metadata.ai?.confidence || 0) * 100)}%
                                {event.engine_metadata.ai?.intent && event.engine_metadata.ai.intent !== 'NOT_APPLICABLE' && (
                                  <div className="text-green-400 mt-1">{event.engine_metadata.ai.intent}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {eventEmail &&
                          (event.event_type === "REPLY_RECEIVED" ||
                            event.event_type === "SENT" ||
                            event.event_type === "RESPONSE") && (
                            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/inbox?email_id=${eventEmail.id}`);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--bg-base)] bg-[var(--text-primary)] hover:bg-white border-2 border-transparent hover:border-black rounded-none transition-none shadow-none cursor-pointer"
                              >
                                <Mail size={14} /> View Email in Inbox
                              </button>
                              <a
                                href={
                                  eventEmail.message_id
                                    ? `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(eventEmail.message_id)}`
                                    : eventEmail.gmail_id ? `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(eventEmail.gmail_id)}`
                                    : `https://mail.google.com/mail/u/0/#search/to%3A${encodeURIComponent(eventEmail.to_email || application.company)}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] rounded-none transition-all"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  className="w-3.5 h-3.5 fill-current"
                                >
                                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
                                </svg>
                                View in Gmail ↗
                              </a>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })})()}
              </div>
            )}
          </div>
        </div>
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
            height: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        `}</style>
      </div>
    </div>
  );
}
