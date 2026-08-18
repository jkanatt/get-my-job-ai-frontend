"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Send, Bell, Search, Heart, HelpCircle, ThumbsUp, Sparkles, Phone,
  Clock, Check, ChevronDown, Loader2, Mail, Eye, Minus, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

const FOLLOW_UP_OPTIONS = [
  { value: 'gentle_reminder', label: 'Gentle Reminder', icon: Bell, color: 'text-yellow-400' },
  { value: 'application_status', label: 'Application Status', icon: Search, color: 'text-blue-400' },
  { value: 'express_interest', label: 'Express Interest', icon: Heart, color: 'text-pink-400' },
  { value: 'availability_check', label: 'Availability Check', icon: HelpCircle, color: 'text-cyan-400' },
  { value: 'request_conversation', label: 'Request a Quick Call', icon: Phone, color: 'text-green-400' },
  { value: 'thank_you_interview', label: 'Thank You (Interview)', icon: ThumbsUp, color: 'text-emerald-400' },
  { value: 'next_steps', label: 'Inquire Next Steps', icon: Clock, color: 'text-orange-400' },
  { value: 'share_update', label: 'Share an Update', icon: Sparkles, color: 'text-purple-400' },
];

/**
 * Custom Checkbox Component
 */
const CustomCheckbox = ({ checked, indeterminate, onChange, disabled }) => {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative w-[15px] h-[15px] rounded-sm flex items-center justify-center border transition-all duration-200 shadow-sm ${checked || indeterminate
        ? 'bg-blue-500 border-blue-500'
        : 'bg-transparent border-[var(--border-strong)] hover:border-blue-500/60 hover:bg-white/[0.02]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {checked && <Check size={11} className="text-white" strokeWidth={4} />}
      {indeterminate && !checked && <Minus size={11} className="text-white" strokeWidth={4} />}
    </button>
  );
};

/**
 * Returns the best template based on days since last email.
 */
function autoSelectTemplate(daysSince) {
  if (daysSince <= 3) return 'gentle_reminder';
  if (daysSince <= 7) return 'application_status';
  if (daysSince <= 14) return 'express_interest';
  if (daysSince <= 21) return 'next_steps';
  if (daysSince <= 30) return 'availability_check';
  return 'request_conversation';
}

/**
 * Extract recruiter info from an application's emails
 */
function getRecruiterInfo(app) {
  const emails = app.emails || [];
  const sorted = [...emails].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const lastSent = sorted.find(e => e.type === 'sent');
  const lastIncoming = sorted.find(e => e.type === 'inbox' || e.type === 'received');

  let email = null, name = null;
  const source = lastIncoming || lastSent;
  const field = lastIncoming ? 'from_email' : 'to_email';

  if (source && source[field]) {
    const m = source[field].match(/^"?([^"<]+)"?\s*<([^>]+)>/);
    if (m) { name = m[1].trim(); email = m[2].trim(); }
    else { email = source[field]; name = email.split('@')[0]; }
  }

  const lastEmailDate = lastSent?.created_at || app.created_at;
  const daysSince = Math.floor((Date.now() - new Date(lastEmailDate).getTime()) / (1000 * 60 * 60 * 24));

  return { email, name, daysSince, lastEmailDate, lastSubject: lastSent?.subject };
}

/**
 * TemplateDropdown — per-row custom dropdown
 */
function TemplateDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = FOLLOW_UP_OPTIONS.find(o => o.value === value) || FOLLOW_UP_OPTIONS[0];
  const Icon = selected.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[11px] font-bold text-[var(--text-primary)]/80 transition-colors min-w-[180px]"
      >
        <Icon size={12} className={selected.color} />
        <span className="flex-1 text-left truncate">{selected.label}</span>
        <ChevronDown size={10} className={`text-[var(--text-primary)]/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[60] top-full left-0 mt-1 w-[240px] bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-[4px_4px_0px_rgba(0,0,0,0.3)] max-h-[260px] overflow-y-auto custom-scrollbar">
          {FOLLOW_UP_OPTIONS.map(opt => {
            const OptIcon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all border-b border-[var(--border-subtle)]/30 last:border-b-0 ${value === opt.value ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
                  }`}
              >
                <OptIcon size={13} className={opt.color} />
                <span className={`text-[11px] font-bold ${value === opt.value ? 'text-blue-400' : 'text-[var(--text-primary)]/80'}`}>
                  {opt.label}
                </span>
                {value === opt.value && <Check size={11} className="text-blue-400 ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * BulkNotifyModal
 */
export default function BulkNotifyModal({ applications = [], isOpen, onClose, onSendProgress }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSending, setIsSending] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const sendingRef = useRef(false);

  // Build candidate list on open
  useEffect(() => {
    if (!isOpen) return;

    const eligible = applications.filter(app => {
      const emails = app.emails || [];
      const hasSent = emails.some(e => e.type === 'sent');
      const hasResponse = emails.some(e => e.type === 'inbox' || e.type === 'received');
      const status = (app.status || '').toLowerCase();
      return hasSent && !hasResponse && (status === 'sent' || status === 'viewed');
    });

    const mapped = eligible.map(app => {
      const info = getRecruiterInfo(app);
      return {
        id: app.id,
        company: app.company,
        role: app.role,
        recruiterEmail: info.email,
        recruiterName: info.name,
        daysSince: info.daysSince,
        lastSubject: info.lastSubject,
        template: autoSelectTemplate(info.daysSince),
      };
    }).filter(c => c.recruiterEmail); // only include those with a valid email

    setCandidates(mapped);
    setSelectedIds(new Set(mapped.map(c => c.id)));
    setPreviewId(null);
    setPreviewData(null);
  }, [isOpen, applications]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)));
    }
  };

  const updateTemplate = (id, template) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, template } : c));
    // Clear preview if it was for this candidate
    if (previewId === id) { setPreviewData(null); setPreviewId(null); }
  };

  const handlePreview = async (candidate) => {
    if (previewId === candidate.id && previewData) {
      setPreviewId(null);
      setPreviewData(null);
      return;
    }
    setPreviewId(candidate.id);
    setIsLoadingPreview(true);
    setPreviewData(null);
    try {
      const res = await fetch('/api/emails/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: candidate.id, followUpType: candidate.template, preview: true }),
      });
      const data = await res.json();
      if (data.success) setPreviewData(data);
      else toast.error(`Preview failed: ${data.error}`);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSend = useCallback(async (onlySelected = true) => {
    const toSend = onlySelected
      ? candidates.filter(c => selectedIds.has(c.id))
      : [...candidates];

    if (toSend.length === 0) {
      toast.error('No candidates selected');
      return;
    }

    setIsSending(true);
    sendingRef.current = true;

    // Initialize progress items
    const progressItems = toSend.map(c => ({
      id: c.id,
      company: c.company,
      recruiterName: c.recruiterName,
      status: 'queued',
    }));
    onSendProgress?.(progressItems, true);

    for (let i = 0; i < toSend.length; i++) {
      if (!sendingRef.current) break; // user cancelled

      const candidate = toSend[i];

      // Update to "sending"
      progressItems[i] = { ...progressItems[i], status: 'sending' };
      onSendProgress?.([...progressItems], true);

      try {
        const res = await fetch('/api/emails/followup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationId: candidate.id,
            followUpType: candidate.template,
          }),
        });
        const data = await res.json();

        if (data.success) {
          progressItems[i] = { ...progressItems[i], status: 'sent' };
        } else {
          progressItems[i] = { ...progressItems[i], status: 'failed' };
        }
      } catch {
        progressItems[i] = { ...progressItems[i], status: 'failed' };
      }

      onSendProgress?.([...progressItems], true);

      // Delay before next email (except last)
      if (i < toSend.length - 1 && sendingRef.current) {
        const randomDelay = Math.floor(Math.random() * 4000) + 1000;
        await new Promise(resolve => setTimeout(resolve, randomDelay));
      }
    }

    setIsSending(false);
    sendingRef.current = false;

    const sentCount = progressItems.filter(p => p.status === 'sent').length;
    const failedCount = progressItems.filter(p => p.status === 'failed').length;

    // Signal completion — pass isActive=false so the progress toast knows we're done
    onSendProgress?.([...progressItems], false);

    if (failedCount === 0) {
      toast.success(`All ${sentCount} follow-ups sent successfully!`);
    } else {
      toast.warning(`${sentCount} sent, ${failedCount} failed`);
    }
  }, [candidates, selectedIds, onSendProgress]);

  if (!isOpen) return null;

  const allSelected = selectedIds.size === candidates.length && candidates.length > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < candidates.length;

  const GRID_COLS = "grid grid-cols-[50px_minmax(120px,1.2fr)_minmax(120px,1.5fr)_minmax(120px,1fr)_80px_220px_80px] w-full items-center";


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!isSending ? onClose : undefined} />

      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-[8px_8px_0px_rgba(0,0,0,0.4)] flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-strong)] bg-[var(--bg-elevated)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Bell size={18} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-[14px] font-black text-[var(--text-primary)] uppercase tracking-[0.1em]">
                Bulk Follow-Up Notifier
              </h2>
              <p className="text-[10px] text-[var(--text-primary)]/40 mt-0.5">
                {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} awaiting response · {selectedIds.size} selected
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSending}
            className="p-2 hover:bg-white/[0.06] transition-colors disabled:opacity-30"
          >
            <X size={18} className="text-[var(--text-primary)]/40" />
          </button>
        </div>

        {/* Table Header */}
        <div className={`${GRID_COLS} bg-[var(--bg-elevated)] border-y border-[var(--border-strong)] text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]/40 shrink-0`}>
          <div className="flex items-center justify-center py-3 border-r border-[var(--border-strong)] h-full">
            <CustomCheckbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleAll}
            />
          </div>
          <div className="px-4 py-3 border-r border-[var(--border-strong)] h-full flex items-center">Company</div>
          <div className="px-4 py-3 border-r border-[var(--border-strong)] h-full flex items-center">Role</div>
          <div className="px-4 py-3 border-r border-[var(--border-strong)] h-full flex items-center">Recruiter</div>
          <div className="px-4 py-3 border-r border-[var(--border-strong)] h-full flex items-center justify-center">Days</div>
          <div className="px-4 py-3 border-r border-[var(--border-strong)] h-full flex items-center justify-center">Template</div>
          <div className="px-4 py-3 h-full flex items-center justify-center">Preview</div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle2 size={32} className="text-green-400/50" />
              <p className="text-[12px] text-[var(--text-primary)]/40 font-bold">All caught up! No candidates need follow-ups right now.</p>
            </div>
          ) : (
            candidates.map(candidate => (
              <div key={candidate.id}>
                {/* Row */}
                <div className={`${GRID_COLS} border-b border-[var(--border-subtle)] transition-all duration-300 group ${selectedIds.has(candidate.id) ? 'bg-blue-500/[0.04] hover:bg-blue-500/[0.06]' : 'bg-transparent hover:bg-white/[0.02]'
                  }`}>
                  {/* Checkbox */}
                  <div className="flex items-center justify-center py-3 border-r border-[var(--border-subtle)] h-full">
                    <CustomCheckbox
                      checked={selectedIds.has(candidate.id)}
                      onChange={() => toggleSelect(candidate.id)}
                      disabled={isSending}
                    />
                  </div>

                  {/* Company */}
                  <div className="px-4 py-3 border-r border-[var(--border-subtle)] h-full flex items-center min-w-0">
                    <span className="text-[12px] font-bold text-[var(--text-primary)]/90 truncate w-full">{candidate.company}</span>
                  </div>

                  {/* Role */}
                  <div className="px-4 py-3 border-r border-[var(--border-subtle)] h-full flex items-center min-w-0">
                    <span className="text-[11px] text-[var(--text-primary)]/60 truncate w-full">{candidate.role}</span>
                  </div>

                  {/* Recruiter */}
                  <div className="px-4 py-3 border-r border-[var(--border-subtle)] h-full flex items-center min-w-0">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]/70 truncate w-full">{candidate.recruiterName}</span>
                  </div>

                  {/* Days */}
                  <div className="px-4 py-3 border-r border-[var(--border-subtle)] h-full flex items-center justify-center">
                    <span className={`text-[12px] font-black ${candidate.daysSince > 14 ? 'text-red-400' :
                      candidate.daysSince > 7 ? 'text-orange-400' :
                        'text-[var(--text-primary)]/50'
                      }`}>{candidate.daysSince}d</span>
                  </div>

                  {/* Template Dropdown */}
                  <div className="px-4 py-2 border-r border-[var(--border-subtle)] h-full flex items-center justify-center">
                    <TemplateDropdown
                      value={candidate.template}
                      onChange={(t) => updateTemplate(candidate.id, t)}
                    />
                  </div>

                  {/* Preview Button */}
                  <div className="px-4 py-2 h-full flex items-center justify-center">
                    <button
                      onClick={() => handlePreview(candidate)}
                      className={`p-2 transition-all rounded hover:scale-110 active:scale-95 ${previewId === candidate.id ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/[0.08] text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/70'
                        }`}
                    >
                      {isLoadingPreview && previewId === candidate.id
                        ? <Loader2 size={14} className="animate-spin text-blue-400" />
                        : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Inline Preview Panel */}
                {previewId === candidate.id && previewData && (
                  <div className="px-6 py-4 bg-blue-500/[0.03] border-b border-blue-500/20">
                    <div className="border border-blue-500/20 bg-[var(--bg-elevated)] overflow-hidden max-w-3xl mx-auto">
                      <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/15 flex items-center gap-2">
                        <Mail size={11} className="text-blue-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Preview</span>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-[var(--text-primary)]/25 uppercase tracking-widest w-14">To</span>
                          <span className="text-[11px] text-[var(--text-primary)]/70 font-mono">{previewData.to}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-[var(--text-primary)]/25 uppercase tracking-widest w-14">Subject</span>
                          <span className="text-[11px] text-[var(--text-primary)]/80 font-bold">{previewData.subject}</span>
                        </div>
                        <div className="h-px bg-[var(--border-subtle)]" />
                        <div
                          className="text-[12px] text-[var(--text-primary)]/70 leading-relaxed [&_p]:mb-2 [&_strong]:text-[var(--text-primary)] [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-500 [&_blockquote]:pl-3 [&_blockquote]:text-[var(--text-primary)]/40 [&_blockquote]:text-[11px]"
                          dangerouslySetInnerHTML={{ __html: previewData.body }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {candidates.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-strong)] bg-[var(--bg-elevated)] shrink-0">
            {/* Random Delay Note */}
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold text-[var(--text-primary)]/40 uppercase tracking-widest">
                Delay: Auto (Random 1-5s)
              </span>
            </div>

            {/* Send Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSend(true)}
                disabled={isSending || selectedIds.size === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900/50 disabled:text-blue-200/50 disabled:cursor-not-allowed text-white border border-blue-500 hover:border-blue-600 transition-all font-black text-[10px] uppercase tracking-[0.12em]"
              >
                {isSending ? (
                  <><Loader2 size={13} className="animate-spin" /> Sending...</>
                ) : (
                  <><Send size={13} /> Send Selected ({selectedIds.size})</>
                )}
              </button>

              <button
                onClick={() => handleSend(false)}
                disabled={isSending}
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] text-[var(--text-primary)] hover:text-white transition-all font-black text-[10px] uppercase tracking-[0.12em] disabled:opacity-30"
              >
                <Send size={13} /> Send All ({candidates.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
