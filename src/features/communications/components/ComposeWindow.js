'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { X, Send, User, ChevronDown, Clock, Paperclip, Loader2, Save, Minus, Maximize2, Sparkles, FileText, Image as ImageIcon, FileArchive, FileSpreadsheet, FileCode, File as FileGeneric, LayoutTemplate } from 'lucide-react';
import { useCompose } from '@/app/context/ComposeContext';
import { toast } from 'sonner';
import { EMAIL_TEMPLATES } from './EmailTemplates';
import { useEmails } from '@/shared/hooks';
import { apiFetch } from '@/shared/utils/apiFetch';

export default function ComposeWindow({ session }) {
  const { id, isMinimized, isFullScreen, data: composeData } = session;
  const { closeCompose, toggleMinimize, toggleFullScreen } = useCompose();
  const { addEmail } = useEmails();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [attachments, setAttachments] = useState([]);

  // Undo Send state
  const [undoTimer, setUndoTimer] = useState(null);
  const [isSending, setIsSending] = useState(false);

  // Schedule Send state
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [isClosingSuccess, setIsClosingSuccess] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      closeCompose(id);
    }, 400);
  };

  const [formData, setFormData] = useState(() => {
    let signature = '\n\n--\nSent from Get My Job';
    if (typeof window !== 'undefined') {
      signature = localStorage.getItem('email_signature') || signature;
    }
    const initialBody = (composeData.body || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return {
      to: composeData.to || '',
      cc: composeData.cc || '',
      bcc: composeData.bcc || '',
      subject: composeData.subject || '',
      body: initialBody.includes(signature) ? initialBody : initialBody + signature
    };
  });

  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');

  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPortalTarget(document.getElementById('inbox-right-pane'));
    }
  }, [isFullScreen]);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.to);
  const canSend = isValidEmail && formData.subject.trim() && formData.body.trim();

  const handleFileAttachment = (e) => {
    const files = Array.from(e.target.files);
    let totalSize = attachments.reduce((sum, att) => sum + att.size, 0);

    files.forEach(file => {
      if (totalSize + file.size > 25 * 1024 * 1024) {
        toast.error(`Attachment limit exceeded (25MB max). Skipped ${file.name}`);
        return;
      }
      totalSize += file.size;
      const reader = new FileReader();
      const fileType = file.type || 'application/octet-stream';
      reader.onload = (event) => {
        const base64 = event.target.result.split(',')[1];
        setAttachments(prev => [...prev, {
          name: file.name,
          type: fileType,
          content: base64,
          encoding: 'base64',
          size: file.size
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const [aiTone, setAiTone] = useState('professional and engaging');

  const executeAIDraft = async () => {
    if (!aiInstruction.trim()) return;
    setAiDrafting(true);
    try {
      const res = await apiFetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          to: formData.to,
          threadHistory: composeData.body || '',
          instruction: aiInstruction,
          tone: aiTone
        })
      });

      if (!res.ok) throw new Error('Failed to generate draft');

      const data = await res.json();
      if (data.draft) {
        setFormData(prev => ({ ...prev, body: data.draft }));
      }
    } catch (e) {
      console.error(e);
      toast.error('AI Draft failed: ' + e.message);
    } finally {
      setAiDrafting(false);
      setShowAiPrompt(false);
      setAiInstruction('');
    }
  };

  const applyTemplate = (template) => {
    setFormData(prev => ({
      ...prev,
      subject: template.subject,
      body: template.body
    }));
    setShowTemplates(false);
  };

  const executeSend = async (type, scheduledAt = null) => {
    try {
      let sentEmailData = null;
      if (type === 'sent') {
        // Convert plain text body to HTML for proper rendering in email clients
        // Preserves any existing HTML (e.g. from reply/forward quoted content)
        const hasHtmlTags = /<[a-z][\s\S]*>/i.test(formData.body);
        const htmlBody = hasHtmlTags
          ? formData.body
          : formData.body
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\n/g, '<br>')
              .replace(/  /g, '&nbsp; ');

        const payload = {
          to: formData.to,
          cc: formData.cc,
          bcc: formData.bcc,
          subject: formData.subject,
          body: htmlBody,
          thread_id: composeData.thread_id,
          in_reply_to: composeData.in_reply_to,
          references: composeData.references,
          attachments: attachments
        };
        
        setIsClosingSuccess(true);
        const animationPromise = new Promise(resolve => setTimeout(resolve, 1200));
        
        const apiPromise = apiFetch('/api/emails/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(async res => {
          const d = await res.json();
          if (!res.ok) {
            throw new Error(d.details ? `${d.error}: ${d.details}` : d.error || 'Failed to send email');
          }
          return d;
        });

        try {
          const [_, d] = await Promise.all([animationPromise, apiPromise]);
          sentEmailData = d;
          
          mutate(
            (key) => Array.isArray(key) && (key[0] === 'emails' || key[0] === 'emailCounts'),
            undefined,
            { revalidate: true }
          );
          
          toast.success('Message sent');
          closeCompose(id);
          if (sentEmailData?.email?.id) {
            router.push(`/inbox?email_id=${sentEmailData.email.id}`);
          }
        } catch (apiError) {
          setIsClosingSuccess(false);
          toast.error('Error: ' + apiError.message);
        }
      } else {
        const payload = {
          to_email: formData.to,
          cc_email: formData.cc,
          bcc_email: formData.bcc,
          subject: formData.subject,
          body_html: formData.body,
          type: type,
          scheduled_at: scheduledAt
        };

        await addEmail(payload);
        if (type === 'scheduled') toast.success('Message scheduled');
        else toast.success('Draft saved');
        handleClose();
      }
    } catch (e) {
      console.error(e);
      toast.error('Error: ' + e.message);
    } finally {
      setLoading(false);
      setIsSending(false);
    }
  };

  const handleAction = async (type) => {
    if (type === 'sent') {
      // Undo Send Implementation (5s delay)
      setIsSending(true);
      toast.success('Sending... (Click Undo to cancel)', {
        action: {
          label: 'Undo',
          onClick: () => {
            clearTimeout(timerId);
            setIsSending(false);
            setUndoTimer(null);
            toast.success('Sending cancelled');
          }
        },
        duration: 5000
      });
      const timerId = setTimeout(() => {
        executeSend('sent');
      }, 5000);
      setUndoTimer(timerId);
    } else if (type === 'scheduled') {
      setLoading(true);
      executeSend('scheduled', scheduleDate);
    } else {
      setLoading(true);
      executeSend(type);
    }
  };

  const getHeaderTitle = () => {
    if (!isMinimized) return "New Message";
    if (formData.to) return formData.to;
    return "New Message";
  };

  // ==========================================
  // FULL SCREEN VIEW (Portaled to Right Pane)
  // ==========================================
  if (isFullScreen) {
    const fullScreenView = (
      <div className={`absolute inset-0 bg-[var(--bg-base)] flex flex-col h-full overflow-hidden z-[100] pointer-events-auto ${!isClosingSuccess && !isExiting ? 'animate-page-in transition-all duration-700 ease-[var(--ease-spring)]' : ''} ${isClosingSuccess ? 'animate-shake-slide' : ''} ${isExiting && !isClosingSuccess ? 'animate-slide-down' : ''}`}>
        
        {isClosingSuccess && (
          <div className="absolute inset-0 bg-[var(--bg-base)]/80 backdrop-blur-sm z-[999] flex flex-col items-center justify-center animate-in fade-in duration-300">
            <span className="text-[var(--c-primary)] font-black tracking-widest text-[24px] uppercase animate-pulse drop-shadow-md">Sending...</span>
          </div>
        )}

        {/* Top Action Bar */}
        <div className="px-8 py-5 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0 bg-[var(--bg-surface)] z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-[14px] font-black shrink-0">
              Y
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-[var(--text-primary)] tracking-tight">You</span>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-none bg-[var(--c-primary)]/10 text-[var(--c-primary)] border border-[var(--c-primary)]/50 shadow-none">DRAFT</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setShowAiPrompt(p => !p); setShowTemplates(false); }} disabled={aiDrafting} className={`w-9 h-9 rounded-none flex items-center justify-center border transition-all bg-[var(--bg-surface)] ${showAiPrompt ? 'border-[var(--c-primary)] bg-[var(--c-primary)]/10 text-[var(--c-primary)]' : 'border-[var(--border-subtle)] hover:border-[var(--c-primary)] hover:bg-[var(--c-primary)]/10 hover:text-[var(--c-primary)] text-[var(--text-secondary)]'}`} title="Draft with AI" aria-label="Draft with AI" aria-expanded={showAiPrompt}>
              {aiDrafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            </button>
            <button onClick={() => { setShowTemplates(p => !p); setShowAiPrompt(false); }} className={`w-9 h-9 rounded-none flex items-center justify-center border transition-all bg-[var(--bg-surface)] ${showTemplates ? 'border-[var(--c-primary)] bg-[var(--c-primary)]/10 text-[var(--c-primary)]' : 'border-[var(--border-subtle)] hover:border-[var(--c-primary)] hover:bg-[var(--c-primary)]/10 hover:text-[var(--c-primary)] text-[var(--text-secondary)]'}`} title="Templates" aria-label="Insert template" aria-expanded={showTemplates}>
              <LayoutTemplate size={14} />
            </button>
            <label className="w-9 h-9 rounded-none flex items-center justify-center border border-[var(--border-subtle)] hover:border-[var(--c-primary)] hover:bg-[var(--c-primary)]/10 hover:text-[var(--c-primary)] text-[var(--text-secondary)] transition-all bg-[var(--bg-surface)] cursor-pointer" title="Attach Files">
              <input type="file" multiple className="hidden" onChange={handleFileAttachment} />
              <Paperclip size={14} />
            </label>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <button onClick={() => handleAction('draft')} disabled={loading} className="px-4 py-2 rounded-none border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-bold text-[11px] tracking-widest uppercase transition-all bg-[var(--bg-surface)] flex items-center gap-2" title="Save Draft">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Draft
            </button>
            <div className="flex bg-white hover:bg-[var(--c-primary)] group relative rounded-none transition-colors">
              <button onClick={() => handleAction('sent')} disabled={loading || !canSend || isSending} className="px-4 py-2 rounded-none text-black group-hover:text-white font-bold text-[11px] tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-50">
                {loading || isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {isSending ? 'SENDING...' : 'SEND'}
              </button>
              <div className="w-px bg-black/20 group-hover:bg-white/20 my-1 transition-colors" />
              <button onClick={() => setShowSchedule(!showSchedule)} disabled={loading || !canSend || isSending} className="px-2 rounded-none text-black group-hover:text-white disabled:opacity-50 transition-colors">
                <ChevronDown size={14} />
              </button>
              {showSchedule && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-elevated)] border-2 border-[var(--border-strong)] p-3 rounded-none shadow-none z-50">
                  <div className="text-xs font-bold text-[var(--text-secondary)] mb-2 uppercase">Schedule Send</div>
                  <input type="datetime-local" className="w-full text-xs p-2 bg-[#111] border border-[var(--border-subtle)] rounded-none outline-none mb-3 text-[var(--text-primary)]" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
                  <button onClick={() => { setShowSchedule(false); handleAction('scheduled'); }} disabled={!scheduleDate} className="w-full btn-primary text-xs py-1.5 rounded-none">Schedule</button>
                </div>
              )}
            </div>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <button onClick={() => toggleFullScreen(id)} className="w-9 h-9 rounded-none flex items-center justify-center border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-all bg-[var(--bg-surface)]" title={isFullScreen ? "Restore down" : "Maximize"} aria-label={isFullScreen ? "Restore down" : "Maximize"}>
              <Minus size={14} />
            </button>
            <button onClick={() => handleClose()} className="w-9 h-9 rounded-none flex items-center justify-center border border-[var(--border-subtle)] hover:border-red-500 hover:bg-red-500/10 hover:text-red-400 text-[var(--text-secondary)] transition-all bg-[var(--bg-surface)]" title="Close" aria-label="Close compose window">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Form Fields: To, Cc, Subject */}
        <div className="flex flex-col border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 z-10">
          <div className="flex items-center px-8 py-3 border-b border-[var(--border-subtle)] group">
            <span className="text-[12px] font-bold text-[var(--text-muted)] w-16 uppercase tracking-widest group-focus-within:text-[var(--c-primary)] transition-colors">To</span>
            <input
              type="email"
              className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-zinc-700"
              placeholder="recipient@example.com"
              value={formData.to}
              onChange={e => setFormData({ ...formData, to: e.target.value })}
            />
          </div>
          <div className="flex items-center px-8 py-3 border-b border-[var(--border-subtle)] group">
            <span className="text-[12px] font-bold text-[var(--text-muted)] w-16 uppercase tracking-widest group-focus-within:text-[var(--c-primary)] transition-colors">Cc</span>
            <input
              type="email"
              className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-zinc-700"
              placeholder="cc@example.com"
              value={formData.cc}
              onChange={e => setFormData({ ...formData, cc: e.target.value })}
            />
          </div>
          <div className="flex items-center px-8 py-3 border-b border-[var(--border-subtle)] group">
            <span className="text-[12px] font-bold text-[var(--text-muted)] w-16 uppercase tracking-widest group-focus-within:text-[var(--c-primary)] transition-colors">Bcc</span>
            <input
              type="email"
              className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-zinc-700"
              placeholder="bcc@example.com"
              value={formData.bcc}
              onChange={e => setFormData({ ...formData, bcc: e.target.value })}
            />
          </div>
          <div className="flex items-center px-8 py-4 group">
            <span className="text-[12px] font-bold text-[var(--text-muted)] w-16 uppercase tracking-widest group-focus-within:text-[var(--c-primary)] transition-colors">Sub</span>
            <input
              type="text"
              className="flex-1 bg-transparent outline-none text-[18px] font-bold text-[var(--text-primary)] placeholder:text-zinc-700"
              placeholder="Subject..."
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
            />
          </div>
        </div>

        {/* Email Body */}
        <div className="flex-1 relative bg-[var(--bg-base)] flex flex-col">
          <textarea
            className="flex-1 w-full bg-transparent outline-none text-[14px] leading-relaxed text-[var(--text-primary)] resize-none placeholder:text-zinc-700 p-8 custom-scrollbar"
            placeholder="Write your email here..."
            value={formData.body}
            onChange={e => setFormData({ ...formData, body: e.target.value })}
          />

          {/* Full Screen Attachments UI */}
          {attachments.length > 0 && (
            <div className="px-8 pb-8 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap gap-4 shrink-0 bg-[var(--bg-base)]">
              {attachments.map((att, i) => {
                let Icon = FileGeneric;
                const t = (att.name || '').toLowerCase();
                if (t.includes('pdf') || t.includes('doc') || t.includes('txt')) Icon = FileText;
                else if (t.includes('jpg') || t.includes('png') || t.includes('jpeg')) Icon = ImageIcon;
                else if (t.includes('zip') || t.includes('rar')) Icon = FileArchive;
                else if (t.includes('xls') || t.includes('csv')) Icon = FileSpreadsheet;
                else if (t.includes('json') || t.includes('html')) Icon = FileCode;

                return (
                  <div key={i} className="flex items-center gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] min-w-[200px] relative group">
                    <div className="w-8 h-8 bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-secondary)]">
                      <Icon size={14} />
                    </div>
                    <div className="flex flex-col pr-6">
                      <span className="text-[12px] font-bold text-[var(--text-primary)] max-w-[200px] whitespace-normal break-all">{att.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">Attachment</span>
                    </div>
                    <button onClick={() => removeAttachment(i)} className="absolute right-2 top-2 text-[var(--text-muted)] hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Instructions Panel - Sleek full-width panel that slides up */}
        {showAiPrompt && (
          <div className="border-t-2 border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6 shadow-[0_-8px_0_0_rgba(255,255,255,0.02)] z-[110] relative shrink-0">
            <div className="flex justify-between items-center mb-3 max-w-4xl mx-auto w-full">
              <span className="text-[14px] font-black text-[var(--c-primary)] flex items-center gap-2 uppercase tracking-widest"><Sparkles size={16} /> AI Instructions</span>
              <button onClick={() => setShowAiPrompt(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 hover:bg-[var(--bg-hover)] transition-colors rounded-none"><X size={16} /></button>
            </div>
            <div className="max-w-4xl mx-auto w-full">
              <div className="flex gap-2 mb-2">
                <select
                  className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] p-2 outline-none )] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                  value={aiTone}
                  onChange={e => setAiTone(e.target.value)}
                >
                  <option value="professional and engaging">Tone: Professional</option>
                  <option value="warm, enthusiastic, and polite">Tone: Warm & Enthusiastic</option>
                  <option value="direct, concise, and firm">Tone: Direct & Concise</option>
                  <option value="persuasive, confident, and visionary">Tone: Confident & Visionary</option>
                </select>
              </div>
              <textarea
                className="w-full bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] p-4 outline-none )] )] resize-none h-24 placeholder:text-[var(--text-muted)] shadow-none focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                placeholder="e.g. Write a polite follow-up email mentioning I completed the technical assessment..."
                value={aiInstruction}
                onChange={e => setAiInstruction(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end mt-4">
                <button onClick={executeAIDraft} disabled={!aiInstruction.trim()} className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-base)] text-[12px] font-black uppercase tracking-[0.1em] disabled:opacity-50 hover:bg-white border-2 border-transparent hover:border-black shadow-none transition-none">Generate Draft</button>
              </div>
            </div>
          </div>
        )}

        {showTemplates && (
          <div className="border-t-2 border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6 shadow-[0_-8px_0_0_rgba(255,255,255,0.02)] z-[110] relative shrink-0">
            <div className="flex justify-between items-center mb-4 max-w-4xl mx-auto w-full">
              <span className="text-[14px] font-black text-[var(--c-primary)] flex items-center gap-2 uppercase tracking-widest"><LayoutTemplate size={16} /> Email Templates</span>
              <button onClick={() => setShowTemplates(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 hover:bg-[var(--bg-hover)] transition-colors rounded-none"><X size={16} /></button>
            </div>
            <div className="max-w-4xl mx-auto w-full grid grid-cols-2 md:grid-cols-4 gap-3 overflow-y-auto max-h-[150px] custom-scrollbar pr-2">
              {EMAIL_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)} className="flex flex-col items-start p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--c-primary)]/50 hover:bg-[var(--bg-hover)] text-left transition-colors">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] mb-1 whitespace-normal break-words w-full">{t.name}</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${t.type === 'short' ? 'text-emerald-500' : 'text-blue-500'}`}>{t.type}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );

    if (portalTarget) {
      return createPortal(fullScreenView, portalTarget);
    }
    return (
      <div className="fixed top-0 bottom-0 right-0 w-[calc(100vw-250px)] z-[200] pointer-events-auto shadow-none">
        {fullScreenView}
      </div>
    );
  }

  // ==========================================
  // NORMAL MINIMIZED OR FLOATING VIEW
  // ==========================================
  return (
    <div
      className={`relative flex flex-col overflow-hidden pointer-events-auto bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] shadow-none rounded-none ${isMinimized ? 'w-[300px] h-[48px]' : 'w-[500px] h-[600px] max-h-[85vh]'} ${(!isClosingSuccess && !isExiting) ? 'transition-all duration-700 ease-[var(--ease-spring)]' : ''} ${isClosingSuccess ? 'animate-shake-slide' : ''} ${isExiting && !isClosingSuccess ? 'animate-slide-down' : ''}`}
    >
      {isClosingSuccess && (
        <div className="absolute inset-0 bg-[var(--bg-base)]/80 backdrop-blur-sm z-[999] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <span className="text-[var(--c-primary)] font-black tracking-widest text-[20px] uppercase animate-pulse drop-shadow-md">Sending...</span>
        </div>
      )}
      <div
        className="p-3 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-elevated)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
        onClick={() => toggleMinimize(id)}
      >
        <h2 className="text-[13px] font-bold text-[var(--text-primary)] flex items-center gap-2 whitespace-normal break-words">
          <div className="w-6 h-6 rounded-none bg-[var(--c-primary)]/10 flex items-center justify-center text-[var(--c-primary)] shrink-0">
            <Send size={12} />
          </div>
          <span className="whitespace-normal break-words pr-4">{getHeaderTitle()}</span>
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          {!isMinimized && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullScreen(id); }}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] p-1.5 transition-all"
              title="Full Screen"
            >
              <Maximize2 size={12} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleMinimize(id); }}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] p-1.5 transition-all"
            title={isMinimized ? "Maximize" : "Minimize"}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-rose-500/20 hover:text-rose-400 p-1.5 transition-all"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className={`flex flex-col flex-1 relative ${isMinimized ? 'hidden' : 'flex'}`}>
        <div className="flex items-center group relative border-b border-[var(--border-subtle)]">
          <span className="text-[12px] font-medium text-[var(--text-muted)] w-12 absolute left-4 transition-colors group-focus-within:text-[var(--c-primary)]">To</span>
          <input
            type="email"
            className="w-full bg-transparent outline-none rounded-none text-[13px] text-[var(--text-primary)] pl-12 pr-4 py-2.5 focus:bg-white/[0.02] transition-colors placeholder:text-zinc-700"
            placeholder="recruiter@company.com"
            value={formData.to}
            onChange={e => setFormData({ ...formData, to: e.target.value })}
          />
        </div>

        <div className="flex items-center group relative border-b border-[var(--border-subtle)]">
          <span className="text-[12px] font-medium text-[var(--text-muted)] w-12 absolute left-4 transition-colors group-focus-within:text-[var(--c-primary)]">Sub</span>
          <input
            type="text"
            className="w-full bg-transparent outline-none rounded-none text-[13px] text-[var(--text-primary)] font-semibold pl-12 pr-4 py-2.5 focus:bg-white/[0.02] transition-colors placeholder:text-zinc-700"
            placeholder="Application for Product Manager"
            value={formData.subject}
            onChange={e => setFormData({ ...formData, subject: e.target.value })}
          />
        </div>

        <div className="flex-1 relative">
          <textarea
            className="absolute inset-0 w-full h-full bg-transparent outline-none rounded-none text-[13px] leading-relaxed text-[var(--text-primary)] p-4 resize-none focus:bg-white/[0.01] transition-colors placeholder:text-zinc-700"
            placeholder="Write your email here..."
            value={formData.body}
            onChange={e => setFormData({ ...formData, body: e.target.value })}
          />
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-4 bg-transparent">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] transition-colors px-2 py-1 rounded-none group">
                <div className="w-4 h-4 rounded-none bg-white/10 flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                  <Paperclip size={10} />
                </div>
                <span className="text-[11px] font-medium text-[var(--text-primary)] whitespace-normal break-all max-w-[100px]">{att.name}</span>
                <button onClick={() => removeAttachment(i)} className="text-[var(--text-muted)] hover:text-rose-400 ml-1 transition-colors">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-between items-center relative z-20">
          <div className="flex gap-1">
            <label className="flex items-center justify-center w-8 h-8 rounded-none hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer" title="Attach Files">
              <input type="file" multiple className="hidden" onChange={handleFileAttachment} />
              <Paperclip size={14} />
            </label>
            <button
              onClick={() => { setShowAiPrompt(p => !p); setShowTemplates(false); }}
              disabled={aiDrafting}
              className={`flex items-center justify-center w-8 h-8 rounded-none transition-colors disabled:opacity-50 ${showAiPrompt ? 'bg-[var(--c-primary)] text-[var(--text-primary)]' : 'hover:bg-[var(--c-primary)]/20 text-[var(--text-secondary)] hover:text-[var(--c-primary)]'}`}
              title="Draft with AI"
            >
              {aiDrafting ? <Loader2 size={14} className="animate-spin text-[var(--c-primary)]" /> : <Sparkles size={14} />}
            </button>
            <button
              onClick={() => { setShowTemplates(p => !p); setShowAiPrompt(false); }}
              className={`flex items-center justify-center w-8 h-8 rounded-none transition-colors ${showTemplates ? 'bg-[var(--c-primary)] text-[var(--text-primary)]' : 'hover:bg-[var(--c-primary)]/20 text-[var(--text-secondary)] hover:text-[var(--c-primary)]'}`}
              title="Templates"
            >
              <LayoutTemplate size={14} />
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => handleAction('draft')} disabled={loading} className="px-4 py-2 rounded-none border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-bold text-[11px] tracking-widest uppercase transition-all bg-[var(--bg-surface)] flex items-center gap-2" title="Save Draft">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              DRAFT
            </button>
            <button onClick={() => handleAction('sent')} disabled={loading || !canSend || isSending} className="px-4 py-2 rounded-none bg-white hover:bg-[var(--c-primary)] text-black hover:text-white font-bold text-[11px] tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-50">
              {loading || isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {isSending ? 'SENDING...' : 'SEND'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Prompt Overlay for minimized/default view */}
      {showAiPrompt && !isMinimized && (
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/90 to-transparent flex flex-col justify-end z-[100] min-h-[300px]">
          <div className="bg-[var(--bg-elevated)] border-2 border-[var(--border-strong)] shadow-none p-3 flex flex-col gap-2 max-w-3xl mx-auto w-full">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[12px] font-bold text-[var(--c-primary)] flex items-center gap-1.5 uppercase tracking-wider"><Sparkles size={12} /> AI Instructions</span>
              <button onClick={() => setShowAiPrompt(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={12} /></button>
            </div>
            <select
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] p-1.5 outline-none )] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
              value={aiTone}
              onChange={e => setAiTone(e.target.value)}
            >
              <option value="professional and engaging">Tone: Professional</option>
              <option value="warm, enthusiastic, and polite">Tone: Warm & Enthusiastic</option>
              <option value="direct, concise, and firm">Tone: Direct & Concise</option>
              <option value="persuasive, confident, and visionary">Tone: Confident & Visionary</option>
            </select>
            <textarea
              className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] p-2 outline-none resize-none h-20 placeholder:text-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
              placeholder="e.g. Write a polite follow-up email mentioning I completed the technical assessment..."
              value={aiInstruction}
              onChange={e => setAiInstruction(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end mt-1">
              <button onClick={executeAIDraft} disabled={!aiInstruction.trim()} className="px-4 py-1.5 bg-white hover:bg-[var(--c-primary)] text-black hover:text-white text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 transition-colors rounded-none">Generate Draft</button>
            </div>
          </div>
        </div>
      )}

      {showTemplates && !isMinimized && (
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/90 to-transparent flex flex-col justify-end z-[100] min-h-[300px]">
          <div className="bg-[var(--bg-elevated)] border-2 border-[var(--border-strong)] shadow-none p-3 flex flex-col gap-2 max-w-3xl mx-auto w-full">
            <div className="flex justify-between items-center mb-2 border-b border-[var(--border-subtle)] pb-2">
              <span className="text-[12px] font-bold text-[var(--c-primary)] flex items-center gap-1.5 uppercase tracking-wider"><LayoutTemplate size={12} /> Email Templates</span>
              <button onClick={() => setShowTemplates(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={12} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
              {EMAIL_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)} className="flex flex-col items-start p-2.5 bg-[var(--bg-base)] border border-[var(--border-subtle)] hover:border-[var(--c-primary)]/50 hover:bg-[var(--c-primary)]/10 text-left transition-colors group">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] mb-0.5 whitespace-normal break-words w-full group-hover:text-[var(--c-primary)] transition-colors">{t.name}</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${t.type === 'short' ? 'text-emerald-400' : 'text-blue-400'}`}>{t.type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
