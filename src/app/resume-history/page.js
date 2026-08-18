'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { Download, Search, FileText, CheckCircle2, History, Loader2, X, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/shared/utils/sanitize';
import { getHashColor } from '@/shared/utils/ui-helpers';

const fetcher = (url) => fetch(url).then((res) => res.json());

import { useJobs } from '@/shared/hooks';
import { apiFetch } from '@/shared/utils/apiFetch';
import { useApplications } from '@/shared/hooks';

export default function ResumeHistoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingEmail, setViewingEmail] = useState(null);
  const [viewingAnalytics, setViewingAnalytics] = useState(null);
  
  const { applications, error, isLoading } = useApplications();
  const data = { applications }; // shim for existing logic

  useEffect(() => {
    if (viewingEmail || viewingAnalytics) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewingEmail, viewingAnalytics]);

  const historyData = (data?.applications || []).map(app => {
    let masterScore = null;
    let modifiedScore = null;
    let pdfUrl = null;
    let emailHtml = null;
    let emailSubject = null;
    
    if (app.emails && app.emails.length > 0) {
      emailHtml = app.emails[0].body_html;
      emailSubject = app.emails[0].subject;
    }
    let tailorData = null;
    let atsData = null;
    let coverLetterUrl = null;
    let resumeFilename = null;
    let coverLetterFilename = null;
    
    try {
      if (app.notes) {
        const notesObj = JSON.parse(app.notes);
        if (notesObj.masterScore !== undefined) masterScore = notesObj.masterScore;
        if (notesObj.modifiedScore !== undefined) modifiedScore = notesObj.modifiedScore;
        if (notesObj.pdfUrl !== undefined) pdfUrl = notesObj.pdfUrl;
        if (notesObj.tailorData !== undefined) tailorData = notesObj.tailorData;
        if (notesObj.atsData !== undefined) atsData = notesObj.atsData;
        if (notesObj.coverLetter !== undefined) coverLetterUrl = notesObj.coverLetter;
        // Attachment filenames from email metadata (set by analyzer script)
        if (notesObj.resumeFilename) resumeFilename = notesObj.resumeFilename;
        if (notesObj.coverLetterFilename) coverLetterFilename = notesObj.coverLetterFilename;
      }
    } catch (e) {
      // notes is not valid JSON
    }

    return {
      id: app.id,
      company: app.company,
      role: app.role,
      masterScore,
      modifiedScore,
      date: app.created_at,
      status: app.status,
      pdfUrl: pdfUrl || resumeFilename,
      coverLetterUrl: coverLetterUrl || coverLetterFilename,
      emailHtml,
      emailSubject,
      tailorData,
      atsData
    };
  });

  const getColor = getHashColor;

  const filteredHistory = historyData.filter(item => 
    (item.company || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-[calc(100vh-3rem)] flex flex-col gap-8 relative pb-12 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 pb-8 border-b border-[var(--border-subtle)] relative">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-transparent blur-3xl -z-10" />
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-none bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-none relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 opacity-50" />
            <FileText size={26} className="text-blue-400 relative z-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="h1">Resume History</h1>
            <p className="body-text">Track your AI-modified resumes and ATS improvements</p>
          </div>
        </div>
      </div>

      <div className="flex items-center w-full shrink-0">
        <div className="relative w-full">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input 
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] )] rounded-none text-[var(--text-primary)] text-[14px] py-3.5 pl-12 pr-4 outline-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] focus:bg-[var(--bg-surface)] placeholder:text-[var(--text-muted)] font-medium focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" 
            placeholder="Search companies, roles..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="flex flex-col mt-4">
        <div className="card-base flex flex-col border border-[var(--border-subtle)] overflow-hidden">
          <div className="w-full overflow-x-auto relative">
            <table className="table-grid w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-elevated)] border-y border-[var(--border-strong)] text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-primary)] shadow-sm relative z-20">
                  <th className="py-7 border-l border-[var(--border-subtle)] px-2 bg-[var(--bg-elevated)]"><div className="flex justify-center items-center w-full text-[var(--text-primary)]">Company Applied</div></th>
                  <th className="py-7 border-l border-[var(--border-subtle)] px-2 bg-[var(--bg-elevated)]"><div className="flex justify-center items-center w-full text-[var(--text-primary)]">Role</div></th>
                  <th className="py-7 border-l border-[var(--border-subtle)] px-2 bg-[var(--bg-elevated)]"><div className="flex justify-center items-center w-full text-[var(--text-primary)]">Master Score</div></th>
                  <th className="py-7 border-l border-[var(--border-subtle)] px-2 bg-[var(--bg-elevated)]"><div className="flex justify-center items-center w-full text-[var(--text-primary)]">Modified Score</div></th>
                  <th className="py-7 border-l border-[var(--border-subtle)] px-2 bg-[var(--bg-elevated)]"><div className="flex justify-center items-center w-full text-center text-[var(--text-primary)]">Date & Time Sent</div></th>
                  <th className="py-7 border-l border-[var(--border-subtle)] px-2 bg-[var(--bg-elevated)]"><div className="flex justify-center items-center w-full text-[var(--text-primary)]">Download</div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredHistory.map((item, index) => {
                  const dateObj = new Date(item.date);
                  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                  return (
                    <tr key={item.id} className="bg-transparent hover:bg-white/[0.02] hover:shadow-[0_8px_30px_rgb(0,0,0,0.5),_inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-1 hover:z-10 transition-all duration-300 ease-out group relative z-0 divide-x divide-[var(--border-subtle)] animate-in fade-in slide-in-from-bottom-2 fill-mode-both" style={{ animationDelay: `${index * 30}ms` }}>
                      {/* Company */}
                      <td className="py-5 pl-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 flex items-center justify-center text-[var(--text-primary)] text-[12px] font-black rounded-none shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] border border-[var(--border-subtle)] shrink-0" style={{ background: getColor(item.company) }}>
                            {item.company.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="text-[var(--text-primary)]/90 font-bold text-[14px] tracking-tight">{item.company}</div>
                        </div>
                      </td>
                      
                      {/* Role */}
                      <td className="py-5 px-2">
                        <div className="flex justify-center items-center w-full">
                          <div className="text-[12px] text-[var(--text-primary)]/70 font-semibold tracking-wide max-w-[150px] truncate text-center">
                            {item.role}
                          </div>
                        </div>
                      </td>

                      {/* Master Score */}
                      <td className="py-5 px-2">
                        <div className="flex justify-center items-center w-full">
                          <span className="text-[13px] font-bold text-[var(--text-secondary)]">{item.masterScore != null ? `${item.masterScore}%` : 'N/A'}</span>
                        </div>
                      </td>

                      {/* Modified Score */}
                      <td className="py-5 px-2">
                        <div className="flex justify-center items-center w-full">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--c-success)]/10 border border-[var(--c-success)]/20 rounded-none shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                            <CheckCircle2 size={12} className="text-[#10B981]" />
                            <span className="text-[13px] font-black text-[#10B981]">{item.modifiedScore != null ? `${item.modifiedScore}%` : 'N/A'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-5 px-2">
                        <div className="flex flex-col items-center justify-center w-full">
                          <div className="text-[var(--text-primary)]/70 text-[13px] font-medium text-center">{formattedDate}</div>
                          <div className="text-[var(--text-primary)]/30 text-[11px] tracking-wide mt-0.5 text-center">{formattedTime}</div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            className="relative inline-flex items-center justify-center px-4 py-2 bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-300 gap-2 group/btn rounded-none"
                            onClick={() => {
                              if (item.tailorData || item.atsData) {
                                setViewingAnalytics(item);
                              } else {
                                toast.error(`No rich analytics available for ${item.company}`);
                              }
                            }}
                          >
                            <FileText size={14} /> Analytics
                          </button>
                          <button 
                            className="relative inline-flex items-center justify-center px-4 py-2 bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-300 gap-2 group/btn rounded-none"
                            onClick={async () => {
                              if (item.emailHtml) {
                                setViewingEmail(item);
                              } else {
                                const toastId = toast.loading('Loading email...');
                                try {
                                  const res = await apiFetch(`/api/applications/${item.id}/documents`);
                                  const json = await res.json();
                                  if (json.success && json.documents?.sentEmail?.bodyHtml) {
                                    setViewingEmail({
                                      ...item,
                                      emailHtml: json.documents.sentEmail.bodyHtml,
                                      emailSubject: json.documents.sentEmail.subject
                                    });
                                    toast.dismiss(toastId);
                                  } else {
                                    toast.error(`No email record found for ${item.company}`, { id: toastId });
                                  }
                                } catch (e) {
                                  toast.error('Failed to load email', { id: toastId });
                                }
                              }
                            }}
                          >
                            <Mail size={14} /> Email
                          </button>
                          <button 
                            className="relative inline-flex items-center justify-center px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] text-[10px] font-black uppercase tracking-widest shadow-[0_4px_14px_0_rgba(255,255,255,0.2)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 gap-2 group/btn overflow-hidden rounded-none"
                            onClick={() => {
                              if (item.pdfUrl) {
                                const handleDownload = async () => {
                                  try {
                                    const res = await apiFetch(`/api/download-pdf?path=${encodeURIComponent(item.pdfUrl)}`);
                                    if (!res.ok) throw new Error('Failed to download PDF');
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `Resume_${item.company}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    window.URL.revokeObjectURL(url);
                                  } catch (err) {
                                    toast.error('Failed to download PDF');
                                  }
                                };
                                handleDownload();
                              } else {
                                toast.error(`No tailored PDF available for ${item.company}`);
                              }
                            }}
                          >
                            <Download size={14} /> PDF
                          </button>
                          <button 
                            className="relative inline-flex items-center justify-center px-4 py-2 bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--bg-hover)] transition-all duration-300 gap-2 group/btn rounded-none"
                            onClick={() => {
                              if (item.coverLetterUrl) {
                                const handleDownload = async () => {
                                  try {
                                    const res = await apiFetch(`/api/download-pdf?path=${encodeURIComponent(item.coverLetterUrl)}`);
                                    if (!res.ok) throw new Error('Failed to download Cover Letter');
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `CoverLetter_${item.company}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    window.URL.revokeObjectURL(url);
                                  } catch (err) {
                                    toast.error('Failed to download Cover Letter');
                                  }
                                };
                                handleDownload();
                              } else {
                                toast.error(`No cover letter available for ${item.company}`);
                              }
                            }}
                          >
                            <Download size={14} /> CL
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {isLoading && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-[var(--text-primary)]/50 text-[13px] flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Loading history...
                    </td>
                  </tr>
                )}
                {!isLoading && filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-[var(--text-primary)]/30 text-[13px]">
                      No resume history found. Try applying to a job!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Email Modal */}
      {viewingEmail && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 ease-out flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[var(--bg-base)] border border-[var(--border-subtle)] shadow-2xl relative flex flex-col max-h-[80vh] mb-[10vh]">
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-[var(--c-primary)]" />
                <h3 className="text-[var(--text-primary)] font-bold text-[14px]">Sent to {viewingEmail.company}</h3>
              </div>
              <button onClick={() => setViewingEmail(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 bg-[var(--bg-input)] border-b border-[var(--border-subtle)]">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Subject</div>
              <div className="text-[14px] text-[var(--text-primary)] font-medium">{viewingEmail.emailSubject || 'No Subject'}</div>
            </div>
            <div className="flex-1 bg-white relative w-full h-[500px] overflow-y-auto p-4 custom-scrollbar text-black">
              <div 
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingEmail.emailHtml || 'No content available.') }} 
                className="w-full max-w-full [&_a]:text-blue-600 [&_a]:underline"
              />
            </div>
          </div>
        </div>
      , document.body)}

      {/* Analytics Modal */}
      {viewingAnalytics && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 ease-out flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[var(--bg-base)] border border-[var(--border-subtle)] shadow-2xl relative flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-5 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-surface)] sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[var(--text-primary)] text-[var(--bg-base)] flex items-center justify-center font-bold">
                  {viewingAnalytics.company ? viewingAnalytics.company.charAt(0).toUpperCase() : 'A'}
                </div>
                <div>
                  <h3 className="text-[var(--text-primary)] font-bold text-[16px]">Resume Generation Audit</h3>
                  <p className="text-[var(--text-muted)] text-[12px]">Detailed intelligence breakdown for {viewingAnalytics.company} - {viewingAnalytics.role}</p>
                </div>
              </div>
              <button onClick={() => setViewingAnalytics(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
              {/* Score Header Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col gap-1 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Master ATS Score</div>
                  <div className="text-3xl font-black text-[var(--text-primary)]">{viewingAnalytics.masterScore || viewingAnalytics.atsData?.score || 0}<span className="text-sm font-normal text-[var(--text-muted)]">/100</span></div>
                </div>
                <div className="p-4 bg-[var(--text-primary)] border border-[var(--text-primary)] flex flex-col gap-1 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--bg-base)]/70 font-bold">Final ATS Score</div>
                  <div className="text-3xl font-black text-[var(--bg-base)]">{viewingAnalytics.modifiedScore || viewingAnalytics.tailorData?.ats_score || 0}<span className="text-sm font-normal text-[var(--bg-base)]/50">/100</span></div>
                </div>
                <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col gap-1 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Keyword Match</div>
                  <div className="text-3xl font-black text-blue-400">{Math.round((viewingAnalytics.tailorData?.validation?.keyword_coverage || viewingAnalytics.atsData?.keyword_coverage || 0) * 100)}%</div>
                </div>
                <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col gap-1 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Optimization Impact</div>
                  <div className="text-3xl font-black text-[#10B981]">+{Math.max(0, (viewingAnalytics.modifiedScore || 0) - (viewingAnalytics.masterScore || 0))}</div>
                </div>
              </div>

              {/* Advanced Metrics */}
              <div className="flex flex-col gap-4">
                <h4 className="text-[14px] font-bold text-[var(--text-primary)] uppercase tracking-wide border-b border-[var(--border-subtle)] pb-2">Deep NLP Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="text-sm flex justify-between py-2 border-b border-[var(--border-subtle)]/50">
                     <span className="text-[var(--text-muted)]">Readability:</span>
                     <span className="font-mono text-[var(--text-primary)]">{viewingAnalytics.tailorData?.validation?.readability_score || viewingAnalytics.atsData?.readability_score || 'N/A'}/100</span>
                   </div>
                   <div className="text-sm flex justify-between py-2 border-b border-[var(--border-subtle)]/50">
                     <span className="text-[var(--text-muted)]">Formatting:</span>
                     <span className="font-mono text-[var(--text-primary)]">{viewingAnalytics.tailorData?.validation?.formatting_score || viewingAnalytics.atsData?.formatting_score || 'N/A'}/100</span>
                   </div>
                   <div className="text-sm flex justify-between py-2 border-b border-[var(--border-subtle)]/50">
                     <span className="text-[var(--text-muted)]">Recruiter Ready:</span>
                     <span className="font-mono text-[var(--text-primary)]">{viewingAnalytics.tailorData?.validation?.recruiter_readiness_score || 'N/A'}/100</span>
                   </div>
                   <div className="text-sm flex justify-between py-2 border-b border-[var(--border-subtle)]/50">
                     <span className="text-[var(--text-muted)]">Action Verbs:</span>
                     <span className="font-mono text-[var(--text-primary)]">{viewingAnalytics.tailorData?.validation?.action_verb_score || viewingAnalytics.atsData?.action_verb_score || 'N/A'}/100</span>
                   </div>
                </div>
              </div>

              {/* JD Insights */}
              {viewingAnalytics.tailorData?.company_context_report && (
                <div className="flex flex-col gap-4">
                  <h4 className="text-[14px] font-bold text-[var(--text-primary)] uppercase tracking-wide border-b border-[var(--border-subtle)] pb-2">Intelligence Brief</h4>
                  <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] leading-relaxed">
                    <p className="text-[var(--text-primary)]">{viewingAnalytics.tailorData.company_context_report.resume_optimization_strategy}</p>
                  </div>
                </div>
              )}

              {/* Engine Stats */}
              <div className="flex flex-col gap-4">
                <h4 className="text-[14px] font-bold text-[var(--text-primary)] uppercase tracking-wide border-b border-[var(--border-subtle)] pb-2">Optimization Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Swap Logs */}
                  <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <div className="text-[11px] uppercase text-[var(--text-muted)] font-bold mb-3">Sections Modified</div>
                    <ul className="text-[12px] flex flex-col gap-2">
                      {viewingAnalytics.tailorData?.swaps?.length > 0 ? viewingAnalytics.tailorData.swaps.map((swap, idx) => (
                        <li key={idx} className="flex flex-col pb-2 mb-2 border-b border-[var(--border-subtle)]/30 last:border-0">
                          <span className="text-[var(--text-primary)] font-mono text-[10px] bg-[var(--border-subtle)] px-1.5 py-0.5 inline-block w-fit mb-1">{swap.section}</span>
                          {swap.added && <span className="text-[#10B981]">++ {swap.added}</span>}
                          {swap.removed && <span className="text-[#EF4444] line-through">-- {swap.removed}</span>}
                        </li>
                      )) : (
                        <span className="text-[var(--text-muted)]">No destructive swaps made. Added context natively.</span>
                      )}
                    </ul>
                  </div>

                  {/* Added Keywords */}
                  <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <div className="text-[11px] uppercase text-[var(--text-muted)] font-bold mb-3">ATS Keywords Injected</div>
                    <div className="flex flex-wrap gap-2">
                      {(viewingAnalytics.atsData?.missing_keywords || []).map((kw, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[11px] border border-blue-500/20">
                          {kw}
                        </span>
                      ))}
                      {(!viewingAnalytics.atsData?.missing_keywords || viewingAnalytics.atsData.missing_keywords.length === 0) && (
                        <span className="text-[12px] text-[var(--text-muted)]">Already optimized for this JD.</span>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Projects Ranked */}
              {viewingAnalytics.tailorData?.selected_projects && (
                <div className="flex flex-col gap-4">
                  <h4 className="text-[14px] font-bold text-[var(--text-primary)] uppercase tracking-wide border-b border-[var(--border-subtle)] pb-2">Projects Sourced from Obsidian</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingAnalytics.tailorData.selected_projects.map((p, i) => (
                      <div key={i} className="text-[12px] px-3 py-1.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      , document.body)}

    </div>
  );
}
