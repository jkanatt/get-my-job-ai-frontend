"use client";
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { useState } from "react";

/**
 * SendProgressToast
 * 
 * Fixed bottom-right floating panel showing live email sending progress.
 * Each entry shows: Queued → Sending → Sent ✅ / Failed ❌
 */
export default function SendProgressToast({ items = [], isActive, onDismiss }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!isActive && items.length === 0) return null;

  const sent = items.filter(i => i.status === 'sent').length;
  const failed = items.filter(i => i.status === 'failed').length;
  const total = items.length;
  const allDone = sent + failed === total && total > 0;
  const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[380px] bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-[6px_6px_0px_rgba(0,0,0,0.4)] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-blue-400" />
          <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-primary)]/80">
            {allDone ? 'Sending Complete' : 'Sending Emails...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[var(--text-primary)]/50">
            {sent + failed}/{total}
          </span>
          <button
            onClick={() => setCollapsed(prev => !prev)}
            className="p-1 hover:bg-white/[0.06] transition-colors"
          >
            {collapsed ? <ChevronUp size={12} className="text-[var(--text-primary)]/40" /> : <ChevronDown size={12} className="text-[var(--text-primary)]/40" />}
          </button>
          {allDone && (
            <button
              onClick={onDismiss}
              className="text-[9px] font-bold text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/60 uppercase tracking-widest transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-[3px] bg-[var(--bg-surface)]">
        <div
          className={`h-full transition-all duration-700 ease-out ${allDone && failed === 0 ? 'bg-green-500' : allDone ? 'bg-yellow-500' : 'bg-blue-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Items List */}
      {!collapsed && (
        <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
          {items.map((item, idx) => (
            <div
              key={item.id || idx}
              className={`flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)]/30 last:border-b-0 transition-all duration-500 ${
                item.status === 'sent' ? 'bg-green-500/[0.04]' :
                item.status === 'failed' ? 'bg-red-500/[0.04]' :
                item.status === 'sending' ? 'bg-blue-500/[0.06]' :
                'bg-transparent'
              }`}
            >
              {/* Status Icon */}
              <div className="shrink-0">
                {item.status === 'queued' && (
                  <div className="w-5 h-5 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--text-primary)]/20" />
                  </div>
                )}
                {item.status === 'sending' && (
                  <Loader2 size={16} className="text-blue-400 animate-spin" />
                )}
                {item.status === 'sent' && (
                  <CheckCircle2 size={16} className="text-green-400" />
                )}
                {item.status === 'failed' && (
                  <XCircle size={16} className="text-red-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold truncate ${
                    item.status === 'sent' ? 'text-green-400' :
                    item.status === 'failed' ? 'text-red-400' :
                    item.status === 'sending' ? 'text-blue-400' :
                    'text-[var(--text-primary)]/50'
                  }`}>
                    {item.recruiterName || 'Recruiter'}
                  </span>
                  <span className="text-[9px] text-[var(--text-primary)]/25 font-mono">·</span>
                  <span className="text-[10px] text-[var(--text-primary)]/40 truncate">{item.company}</span>
                </div>
              </div>

              {/* Status Label */}
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] shrink-0 ${
                item.status === 'sent' ? 'text-green-400' :
                item.status === 'failed' ? 'text-red-400' :
                item.status === 'sending' ? 'text-blue-400' :
                'text-[var(--text-primary)]/20'
              }`}>
                {item.status === 'queued' ? 'Queued' :
                 item.status === 'sending' ? 'Sending' :
                 item.status === 'sent' ? 'Done' :
                 'Failed'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Summary Footer */}
      {allDone && (
        <div className={`px-4 py-2.5 border-t border-[var(--border-subtle)] ${failed > 0 ? 'bg-yellow-500/[0.05]' : 'bg-green-500/[0.05]'}`}>
          <span className="text-[10px] font-bold text-[var(--text-primary)]/60">
            {failed === 0
              ? `All ${sent} emails sent successfully!`
              : `${sent} sent, ${failed} failed`}
          </span>
        </div>
      )}
    </div>
  );
}
