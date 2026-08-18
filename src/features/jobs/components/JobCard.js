'use client';

import ATSBadge from '@/shared/design-system/components/ATSBadge';
import { Bookmark, FileText, ChevronRight, Mail } from 'lucide-react';
import { getHashColor as getColor, timeAgo } from '@/shared/utils/ui-helpers';
import ProfileCompletionBlocker from '@/features/onboarding/components/ProfileCompletionBlocker';

export default function JobCard({ job, onApply, onPass, onSave, onDetails }) {
  let meta = null;
  if (job.skills && job.skills.length > 0) {
    try {
      const parsed = typeof job.skills[0] === 'string' ? JSON.parse(job.skills[0]) : job.skills[0];
      if (parsed && parsed._meta) meta = parsed;
    } catch(e) {}
  }

  let rawRecruiter = meta?.recruiter && meta.recruiter !== 'Unknown' ? meta.recruiter : (job.location !== 'Remote/Hybrid' && job.location !== 'Remote' ? job.location : 'Unknown');
  if (rawRecruiter?.toLowerCase() === 'feed post') rawRecruiter = 'Recruiter';
  const displayRecruiter = rawRecruiter;
  
  const rawCompany = job.company || 'Unknown';
  const companyName = rawCompany.toLowerCase() === 'feed post' ? 'LinkedIn Post' : rawCompany;
  const initials = companyName === 'LinkedIn Post' ? 'IN' : companyName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const bgColor = getColor(companyName);
  const relativeTime = timeAgo(job.posted_at || job.created_at);

  let appType = 'Direct';
  if (job.skills && Array.isArray(job.skills)) {
    const typeSkill = job.skills.find(s => typeof s === 'string' && s.startsWith('application_type:'));
    if (typeSkill) {
      appType = typeSkill.split('application_type:')[1];
    } else if (companyName === 'LinkedIn Post') {
      appType = 'LinkedIn Post';
    } else if (meta?.category === 'Form') {
      appType = 'External Form';
    } else if (meta?.category === 'Email') {
      appType = 'Email Application';
    }
  }
  let atsScore = job.ats_score || job.ai_score || 0;
  let atsReasoning = '';
  let industry = '';
  let isRemote = false;

  if (job.skills && Array.isArray(job.skills)) {
    const scoreSkill = job.skills.find(s => typeof s === 'string' && s.startsWith('relevance_score:'));
    if (scoreSkill && !atsScore) {
      atsScore = parseInt(scoreSkill.split(':')[1], 10) || atsScore;
    }
    const reasonSkill = job.skills.find(s => typeof s === 'string' && s.startsWith('relevance_reasoning:'));
    if (reasonSkill) {
      atsReasoning = reasonSkill.split('relevance_reasoning:')[1] || '';
    }
    
    const industrySkill = job.skills.find(s => typeof s === 'string' && s.startsWith('industry:'));
    if (industrySkill) industry = industrySkill.split('industry:')[1];
    
    const remoteSkill = job.skills.find(s => typeof s === 'string' && s.startsWith('is_remote:'));
    if (remoteSkill) isRemote = remoteSkill.split(':')[1] === 'True' || remoteSkill.split(':')[1] === 'true';
  }

  // Parse new fields
  let workMode = isRemote ? 'Remote' : 'Unknown';
  let jobType = 'Unknown';
  let experienceLevel = 'Unknown';
  let jobTiming = 'Unknown';
  let applicationDeadline = null;
  let salaryRange = null;

  if (job.skills && Array.isArray(job.skills)) {
    const findSkill = (prefix) => {
      const s = job.skills.find(s => typeof s === 'string' && s.startsWith(prefix));
      return s ? s.substring(prefix.length) : null;
    };
    
    const wm = findSkill('work_mode:');
    if (wm && wm !== 'Unknown') workMode = wm;
    
    const jt = findSkill('job_type:');
    if (jt && jt !== 'Unknown') jobType = jt;
    
    const el = findSkill('experience_level:');
    if (el && el !== 'Unknown') experienceLevel = el;
    
    const jtm = findSkill('job_timing:');
    if (jtm && jtm !== 'Unknown') jobTiming = jtm;
    
    const ad = findSkill('application_deadline:');
    if (ad && ad !== 'Unknown' && ad !== 'None') applicationDeadline = ad;
    
    const sr = findSkill('salary_range:');
    if (sr && sr !== 'Unknown' && sr !== 'None') salaryRange = sr;
  }

  const displayLocation = isRemote ? 'Remote' : (meta ? meta.work_mode : (job.location || 'Not specified'));

  return (
    <div 
      className="relative flex flex-col h-full bg-[var(--bg-surface)] border border-[var(--border-strong)] group transition-all duration-300 hover:border-white/20 hover:bg-white/[0.02]"
      style={{ borderLeft: `4px solid ${bgColor}` }}
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--c-primary)]/10 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Card Body */}
      <div 
        className="p-5 flex-1 flex flex-col relative z-10 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); if (onDetails) onDetails(); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' && onDetails) { e.stopPropagation(); onDetails(); } }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center font-bold text-[13px] shadow-sm" style={{ color: bgColor }}>
              {initials}
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-[var(--text-primary)]/90 leading-tight">{companyName}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-[11px] font-mono tracking-wider text-[var(--text-muted)] uppercase">
              {relativeTime ? `${relativeTime}` : 'JUST NOW'}
            </span>
            <div className="scale-90 origin-top-right">
              <ATSBadge score={atsScore} />
            </div>
          </div>
        </div>

        <div className="text-[20px] leading-tight font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--c-primary)] transition-colors mb-4 mt-1 max-h-[120px] overflow-y-auto custom-scrollbar whitespace-pre-wrap pr-2">
          {job.title}
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(meta?.email || meta?._meta?.email) && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-surface)] text-blue-600 dark:text-blue-400 border border-[var(--border-subtle)] text-[11px] font-bold tracking-wider rounded-none">
              <Mail size={12} /> {meta?.email || meta?._meta?.email}
            </span>
          )}
          {meta?.category && meta.category !== 'Unknown' && (
            <span className={`inline-flex items-center px-2 py-1 text-[11px] font-bold tracking-wider uppercase rounded-none border border-[var(--border-subtle)] bg-[var(--bg-surface)] ${meta.category === 'Form' ? 'text-purple-600 dark:text-purple-400' : meta.category === 'Email' ? 'text-blue-600 dark:text-blue-400' : meta.category === 'LinkedIn' ? 'text-cyan-600 dark:text-cyan-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {meta.category === 'Form' ? '📝 Form' : meta.category === 'Email' ? '✉️ Email' : meta.category === 'LinkedIn' ? '🔗 LinkedIn' : '🏢 Direct'}
            </span>
          )}
          <span className="inline-flex items-center px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)]/70 text-[11px] font-medium rounded-none">
            📍 {displayLocation}
          </span>
          {industry && (
            <span className="inline-flex items-center px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)]/70 text-[11px] font-medium rounded-none">
              🏢 {industry}
            </span>
          )}
          {jobType && jobType !== 'Unknown' && (
            <span className="inline-flex items-center px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)]/70 text-[11px] font-medium rounded-none">
              🏷️ {jobType}
            </span>
          )}
          {(experienceLevel && experienceLevel !== 'Unknown' || meta?.experience) && (
            <span className="inline-flex items-center px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)]/70 text-[11px] font-medium rounded-none">
              💼 {experienceLevel !== 'Unknown' ? experienceLevel : meta.experience}
            </span>
          )}
          {jobTiming && jobTiming !== 'Unknown' && (
            <span className="inline-flex items-center px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)]/70 text-[11px] font-medium rounded-none">
              ⏱️ {jobTiming}
            </span>
          )}
          {salaryRange && (
            <span className="inline-flex items-center px-2 py-1 bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-[11px] font-medium rounded-none">
              💰 {salaryRange}
            </span>
          )}
          {applicationDeadline && (
            <span className="inline-flex items-center px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-[11px] font-medium rounded-none">
              ⏳ Deadline: {applicationDeadline}
            </span>
          )}
          <span className="inline-flex items-center px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[11px] font-bold tracking-wider uppercase rounded-none">
            🔍 Found on {appType}
          </span>
        </div>

        {atsReasoning && (
          <div className="mb-4 bg-[var(--bg-hover)] border border-[var(--border-subtle)] p-3 rounded-none relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--c-primary)]"></div>
            <div className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">AI Analysis</div>
            <p className="text-[12px] text-[var(--text-secondary)] leading-snug">
              "{atsReasoning}"
            </p>
          </div>
        )}
        
        <div className="mt-auto flex flex-col gap-3">
          {(displayRecruiter !== 'Unknown' || meta?.email) && (
            <div className="bg-[var(--bg-elevated)]/50 border border-[var(--border-default)] rounded-none p-3 flex flex-col gap-1.5">
              {displayRecruiter !== 'Unknown' && (
                <div className="text-[12px] font-medium text-[var(--text-primary)] flex items-center gap-2">
                  👤 {displayRecruiter}
                </div>
              )}
              {meta?.email && (
                <div className="text-[12px] font-medium text-blue-400 flex items-center gap-2 break-all whitespace-normal">
                  ✉️ {meta.email}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Bar (Footer) */}
      <div className="px-5 py-4 flex items-center justify-between relative z-20 shrink-0 border-t border-[var(--border-strong)] bg-[var(--bg-elevated)]">
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); if(onSave) onSave(); }} 
            title="Save Job" 
            className="btn btn-ghost px-2"
          >
            <Bookmark size={14} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); if(onPass) onPass(); }} 
            className="btn btn-ghost"
          >
            Pass
          </button>
          <ProfileCompletionBlocker>
            {({ executeWithBlocker }) => (
              <button 
                onClick={(e) => executeWithBlocker(e, () => { if(onApply) onApply(); })} 
                className="btn btn-primary"
              >
                Apply <ChevronRight size={14} className="-mr-0.5" />
              </button>
            )}
          </ProfileCompletionBlocker>
        </div>
      </div>
    </div>
  );
}
