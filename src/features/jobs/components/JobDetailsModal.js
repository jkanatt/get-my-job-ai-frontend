'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { brand } from '@/config/brand.config';
import { X, ExternalLink, Calendar, MapPin, Building2, ChevronRight, CheckCircle2, Mail } from 'lucide-react';
import ATSBadge from '@/shared/design-system/components/ATSBadge';
import ProfileCompletionBlocker from '@/features/onboarding/components/ProfileCompletionBlocker';

export default function JobDetailsModal({ job, onClose, onApply, onPass }) {
  // Escape key to close
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  if (!job) return null;

  const parseSkills = (skills) => {
    if (!skills) return [];
    if (Array.isArray(skills)) return skills;
    if (typeof skills === 'string') {
      try {
        if (skills.startsWith('[')) return JSON.parse(skills.replace(/'/g, '"'));
      } catch (e) {
        // Fallback for malformed JSON like "[React, Node]"
        return skills.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
      }
      return skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const parsedSkills = parseSkills(job.skills);

  let meta = null;
  const displaySkills = [];
  parsedSkills.forEach(s => {
    if (typeof s === 'object' && s !== null && s._meta) {
      meta = s;
    } else if (typeof s === 'string') {
      try {
        const p = JSON.parse(s);
        if (p._meta) { meta = p; return; }
      } catch (e) {}
      displaySkills.push(s);
    } else {
      displaySkills.push(s);
    }
  });

  const postedDate = job.posted_at || job.created_at;
  const displayPosted = postedDate ? new Date(postedDate).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Recently';

  let atsScore = job.ats_score || job.ai_score || 0;
  let atsReasoning = '';

  if (job.skills && Array.isArray(job.skills)) {
    const scoreSkill = job.skills.find(s => typeof s === 'string' && s.startsWith('relevance_score:'));
    if (scoreSkill && !atsScore) {
      atsScore = parseInt(scoreSkill.split(':')[1], 10) || atsScore;
    }
    const reasonSkill = job.skills.find(s => typeof s === 'string' && s.startsWith('relevance_reasoning:'));
    if (reasonSkill) {
      atsReasoning = reasonSkill.split('relevance_reasoning:')[1] || '';
    }
  }

  let rawRecruiter = meta?.recruiter && meta.recruiter !== 'Unknown' ? meta.recruiter : (job.location && job.location !== 'Remote/Hybrid' && job.location !== 'Remote' ? job.location : 'Unknown');
  if (rawRecruiter && rawRecruiter.toLowerCase() === 'feed post') rawRecruiter = 'Recruiter';
  const recruiterName = rawRecruiter || 'Unknown';
  
  const companyName = (job.company && job.company.toLowerCase() === 'feed post') ? 'LinkedIn Post' : (job.company || 'Unknown Company');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4 sm:p-6" onClick={onClose}>
      <div className="relative w-full max-w-4xl h-[95vh] max-h-[95vh] flex flex-col bg-[var(--bg-base)] border-2 border-[var(--border-strong)] shadow-none rounded-none animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
          
        {/* Header */}
        <div className="p-8 pb-6 border-b border-[var(--border-default)] bg-[var(--bg-surface)] relative flex flex-col items-start shrink-0">
          
          <div className="pr-12 w-full">
            <h2 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight mb-2 capitalize">
              {job.title}
            </h2>
            
            <div className="text-[18px] font-medium text-[var(--text-primary)]/80 flex items-center gap-2 mb-5">
              <Building2 size={18} className="text-[var(--text-primary)]/50" />
              {companyName}
              <a 
                href={job.company_url || `https://www.google.com/search?q=${encodeURIComponent(companyName + ' company website')}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="ml-2 text-[13px] text-[var(--c-primary)] hover:underline flex items-center gap-1"
                title={job.company_url ? `Visit ${companyName}` : `Search for ${companyName} website`}
              >
                <ExternalLink size={14} />
                {job.company_url ? 'Company Page' : 'Website'}
              </a>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[13px] font-medium bg-[var(--bg-hover)] px-3 py-1.5 rounded-none border border-[var(--border-subtle)]">
                <Calendar size={14} className="text-[var(--text-muted)]" />
                Posted {displayPosted}
              </span>
              {(meta?.email || meta?._meta?.email) && (
                <span className="flex items-center gap-1.5 text-[var(--c-primary)] text-[13px] font-medium bg-[var(--c-primary-soft)] px-3 py-1.5 rounded-none border border-[var(--c-primary)]/20">
                  <Mail size={14} />
                  {meta?.email || meta?._meta?.email}
                </span>
              )}
            </div>
          </div>

          <button onClick={onClose} className="absolute top-6 right-6 px-4 py-2 flex items-center justify-center gap-2 bg-[#F5F5F0] hover:bg-white text-black font-bold text-[13px] rounded-none transition-all shadow-sm border border-transparent hover:border-black/20">
            <X size={16} strokeWidth={3} />
            <span className="uppercase tracking-wider">Close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-8 bg-[var(--bg-base)] overflow-y-auto custom-scrollbar flex-1">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-[var(--text-primary)]/70 text-[13px] font-medium bg-[var(--bg-elevated)] px-3 py-1.5 border border-[var(--border-default)]">
              <MapPin size={14} className="text-[var(--c-primary)]" />
              {job.location || 'Remote'}
            </div>
            {job.salary && (
              <div className="flex items-center gap-2 text-[var(--text-primary)]/70 text-[13px] font-medium bg-[var(--bg-elevated)] px-3 py-1.5 border border-[var(--border-default)]">
                <span className="text-[var(--c-primary)] font-mono">$</span>
                {job.salary}
              </div>
            )}
            {job.url && (
              <a href={job.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[var(--c-primary)] hover:text-[var(--text-primary)] transition-colors text-[13px] font-medium bg-[var(--c-primary-soft)] px-3 py-1.5 border border-[var(--c-primary)]/20 hover:bg-[var(--c-primary)]/20">
                Original Posting <ExternalLink size={12} />
              </a>
            )}
          </div>

          {/* ATS Match block */}
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] p-6 flex items-center gap-6 card-accent-left" style={{ borderLeftColor: 'var(--c-primary)' }}>
            <div className="scale-110 origin-center shrink-0">
              <ATSBadge score={atsScore} />
            </div>
            <div>
              <h4 className="caption mb-2 text-[var(--c-primary)]">Resume Match</h4>
              <p className="text-[14px] leading-relaxed text-[var(--text-primary)]/80">
                {atsReasoning ? atsReasoning : (
                  atsScore > 80 
                  ? "Excellent match. Your resume hits the core requirements perfectly." 
                  : atsScore > 60 
                    ? "Good match. You might want to tailor your resume to boost this score." 
                    : "Fair match. Missing several key skills listed in the job description."
                )}
              </p>
            </div>
          </div>


          {/* Description */}
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] p-6 text-[14px] text-[var(--text-primary)]/70 leading-relaxed flex flex-col">
            <h4 className="caption mb-4 shrink-0">Post Details</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 max-h-[60vh]">
              {job.description ? (
                <div className="whitespace-pre-wrap text-[var(--text-primary)]/80">{job.description}</div>
              ) : meta?.description ? (
                <div className="whitespace-pre-wrap text-[var(--text-primary)]/80">{meta.description}</div>
              ) : (
                <p className="italic text-[14px] text-[var(--text-muted)]">
                  The original job description was not fully extracted. Please click "Original Posting" above to view the details on the host platform.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="p-6 border-t border-[var(--border-strong)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0">
          {/* Logo & Brand Name */}
          <div className="hidden sm:flex items-center gap-2.5 opacity-50 hover:opacity-100 transition-all duration-500 ease-out group cursor-pointer">
            <div className="relative group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 ease-out">
              <Image src={brand.logo.path} alt={brand.name} width={18} height={18} className="object-contain drop-shadow-md group-hover:drop-shadow-[0_0_8px_var(--c-primary)] transition-all duration-500" />
            </div>
            <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide group-hover:tracking-[0.2em] group-hover:text-[var(--c-primary)] transition-all duration-500">{brand.name}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button onClick={() => { onPass(); onClose(); }} className="btn btn-outline">
              Pass
            </button>
            <ProfileCompletionBlocker>
              {({ executeWithBlocker }) => (
                <button 
                  onClick={(e) => executeWithBlocker(e, () => { onClose(); onApply(); })} 
                  className="btn btn-primary"
                >
                  Apply Now <ChevronRight size={16} className="-mr-1 opacity-70" />
                </button>
              )}
            </ProfileCompletionBlocker>
          </div>
        </div>
      </div>
    </div>
  );
}
