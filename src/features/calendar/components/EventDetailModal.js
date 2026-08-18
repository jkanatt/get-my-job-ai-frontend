'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Download, Mail, Clock, Building2, Briefcase, ChevronDown, ChevronUp, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext';

/**
 * EventDetailModal — Displays full application details when a calendar event is clicked.
 * Shows: Company, Role, Status, Cover Letter (text + PDF), Resume PDF, Sent Email preview.
 */
export default function EventDetailModal({ event, isOpen, onClose, onEdit }) {
  const [documents, setDocuments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCL, setExpandedCL] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState(false);
  const { user, session } = useAuth();

  useEffect(() => {
    if (!isOpen || !event?.application_id) {
      setDocuments(null);
      return;
    }
    fetchDocuments();
  }, [isOpen, event?.application_id]);

  async function fetchDocuments() {
    setLoading(true);
    setError(null);
    try {
      const token = session?.access_token || await user?.getIdToken?.() || 'mock-token';
      const res = await fetch(`/api/applications/${event.application_id}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setDocuments(data.documents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !event) return null;

  const statusColors = {
    Sent: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    Viewed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Responded: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Interview: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    Rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
    Offer: 'bg-green-500/15 text-green-400 border-green-500/30',
  };

  const handleDownload = async (url, filename) => {
    try {
      const token = session?.access_token || await user?.getIdToken?.() || 'mock-token';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed: ' + err.message);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 py-12 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto custom-scrollbar"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] rounded-none w-full max-w-3xl shadow-none animate-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[var(--border-strong)] bg-[var(--text-primary)] shrink-0">
          <div className="flex items-center gap-3">
            <Building2 size={16} className="text-[var(--bg-base)]" />
            <span className="font-black tracking-widest uppercase text-[11px] text-[var(--bg-base)]">
              Application Details
            </span>
          </div>
          <button onClick={onClose} className="text-[var(--bg-base)] hover:text-[var(--bg-elevated)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Title Section */}
        <div className="px-8 pt-6 pb-4 border-b border-[var(--border-subtle)] shrink-0">
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {event.title?.replace(/^(Applied: |🎯 Interview: )/, '') || 'Untitled Event'}
          </h2>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {documents?.application?.status && (
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 border ${statusColors[documents.application.status] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
                {documents.application.status}
              </span>
            )}
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <Clock size={12} />
              {new Date(event.start_time).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {documents?.sentEmail?.to && (
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Mail size={12} />
                {documents.sentEmail.to.length > 40 ? documents.sentEmail.to.substring(0, 40) + '...' : documents.sentEmail.to}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="animate-spin text-[var(--c-primary)]" />
              <span className="text-sm text-[var(--text-secondary)] font-medium">Loading documents...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={fetchDocuments} className="text-xs text-[var(--c-primary)] mt-2 underline">Retry</button>
            </div>
          ) : !event.application_id ? (
            <div className="p-8">
              <div className="p-4 border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <p className="text-sm text-[var(--text-secondary)]">{event.description || 'No description'}</p>
              </div>
            </div>
          ) : documents ? (
            <div className="p-6 space-y-5">
              {/* Download Buttons Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Resume Download */}
                <button
                  disabled={!documents.resume?.downloadUrl}
                  onClick={() => handleDownload(documents.resume.downloadUrl, documents.resume.pdfFilename)}
                  className={`flex items-center gap-3 p-4 border-2 transition-all group ${
                    documents.resume?.downloadUrl 
                      ? 'border-[var(--border-strong)] hover:border-[var(--c-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer' 
                      : 'border-[var(--border-subtle)] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 border border-blue-500/20 shrink-0">
                    <FileText size={18} className="text-blue-400" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Resume</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {documents.resume?.pdfFilename || 'Not available'}
                    </p>
                  </div>
                  {documents.resume?.downloadUrl && (
                    <Download size={16} className="text-[var(--text-muted)] group-hover:text-[var(--c-primary)] transition-colors shrink-0" />
                  )}
                </button>

                {/* Cover Letter PDF Download */}
                <button
                  disabled={!documents.coverLetter?.downloadUrl}
                  onClick={() => handleDownload(documents.coverLetter.downloadUrl, documents.coverLetter.pdfFilename)}
                  className={`flex items-center gap-3 p-4 border-2 transition-all group ${
                    documents.coverLetter?.downloadUrl 
                      ? 'border-[var(--border-strong)] hover:border-[var(--c-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer' 
                      : 'border-[var(--border-subtle)] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                    <Mail size={18} className="text-emerald-400" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Cover Letter PDF</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {documents.coverLetter?.pdfFilename || 'Not available'}
                    </p>
                  </div>
                  {documents.coverLetter?.downloadUrl && (
                    <Download size={16} className="text-[var(--text-muted)] group-hover:text-[var(--c-primary)] transition-colors shrink-0" />
                  )}
                </button>
              </div>

              {/* Cover Letter Text */}
              {documents.coverLetter?.text && (
                <div className="border-2 border-[var(--border-strong)]">
                  <button
                    onClick={() => setExpandedCL(!expandedCL)}
                    className="w-full flex items-center justify-between px-5 py-3 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                      <Mail size={12} className="text-emerald-400" />
                      Cover Letter (Email Body)
                    </span>
                    {expandedCL ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedCL && (
                    <div className="px-6 py-5 border-t border-[var(--border-subtle)]">
                      <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap font-sans leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar">
                        {documents.coverLetter.text}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Original Sent Email */}
              {documents.sentEmail && (
                <div className="border border-[var(--border-subtle)]">
                  <button
                    onClick={() => setExpandedEmail(!expandedEmail)}
                    className="w-full flex items-center justify-between px-5 py-3 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                      <Mail size={12} />
                      Original Sent Email
                    </span>
                    {expandedEmail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedEmail && (
                    <div className="px-5 py-4 border-t border-[var(--border-subtle)] space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Subject</span>
                        <span className="text-sm text-[var(--text-primary)] font-medium">{documents.sentEmail.subject}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">To</span>
                        <span className="text-sm text-[var(--text-secondary)]">{documents.sentEmail.to}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Date</span>
                        <span className="text-sm text-[var(--text-secondary)]">
                          {new Date(documents.sentEmail.date).toLocaleString('en-IN')}
                        </span>
                      </div>
                      {documents.sentEmail.attachments?.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Attachments</span>
                          <div className="flex flex-wrap gap-2">
                            {documents.sentEmail.attachments.map((att, i) => (
                              <span key={i} className="text-xs bg-[var(--bg-elevated)] px-2 py-1 border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                                📎 {att.filename}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">
              No application data linked to this event.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-[var(--border-strong)] bg-[var(--bg-elevated)] flex justify-between items-center shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {documents?.allAttachments?.length > 0 && `${documents.allAttachments.length} attachment(s)`}
          </div>
          <div className="flex items-center gap-3">
            {event.meeting_url && (
              <a href={event.meeting_url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <ExternalLink size={12} /> Join Meeting
              </a>
            )}
            <button onClick={onClose}
              className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-4 py-2 border border-[var(--border-strong)] hover:bg-[var(--bg-hover)]">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
