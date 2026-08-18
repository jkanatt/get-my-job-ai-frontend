'use client';

import { ArrowRight, UserCircle, Search } from 'lucide-react';
import { ListRowSkeleton } from '@/shared/design-system/components/Skeletons';
import { EmptyState } from '@/shared/design-system/components/StateMessages';

/**
 * Extracted applications table component from the Dashboard page.
 * Displays filtered applications with company avatar, status badge, and row hover effects.
 *
 * Props:
 *   - applications: filtered application array
 *   - isLoading: show skeleton state
 *   - getColor: (companyName) => hex color
 *   - onRowClick: (app) => void
 */
export default function ApplicationsTable({ applications, isLoading, getColor, onRowClick }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-px bg-[var(--border-subtle)]">
        <ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton />
      </div>
    );
  }

  return (
    <table className="table-grid w-full text-left border-collapse">
      <thead>
        <tr className="bg-[var(--bg-elevated)] border-y border-[var(--border-strong)] text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)] shadow-sm relative z-20">
          <th className="py-4 text-center bg-[var(--bg-elevated)]">Company</th>
          <th className="py-4 text-center bg-[var(--bg-elevated)]">Sent To</th>
          <th className="py-4 text-center bg-[var(--bg-elevated)]">Role</th>
          <th className="py-4 text-center bg-[var(--bg-elevated)]">Domain</th>
          <th className="py-4 text-center bg-[var(--bg-elevated)]">Status</th>
          <th className="py-4 text-center bg-[var(--bg-elevated)]">Applied On</th>
          <th className="py-4 text-center bg-[var(--bg-elevated)]">View</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {applications.map(app => {
          let toEmail = 'Unknown';
          if (app.emails && app.emails.length > 0) {
            const sentEmail = app.emails.find(e => e.type === 'sent');
            if (sentEmail && sentEmail.to_email) {
              toEmail = sentEmail.to_email;
            } else {
              const inboxEmail = app.emails.find(e => e.type === 'inbox' || e.type === 'received');
              if (inboxEmail && inboxEmail.from_email) {
                toEmail = inboxEmail.from_email;
              } else {
                toEmail = app.emails[0].to_email || 'Unknown';
              }
            }
          }

          let sentToName = 'Hiring Team';
          let domain = app.company ? `${app.company.toLowerCase().replace(/\s+/g, '')}.com` : 'N/A';
          
          if (toEmail !== 'Unknown') {
            const nameMatch = toEmail.match(/^"?([^"<]+)"?\s*</);
            if (nameMatch && nameMatch[1]) {
              sentToName = nameMatch[1].trim();
            }
            
            const emailMatch = toEmail.match(/<([^>]+)>/);
            const cleanEmail = emailMatch ? emailMatch[1] : toEmail;
            
            if (!nameMatch) {
              sentToName = cleanEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            
            if (cleanEmail.includes('@')) {
              domain = cleanEmail.split('@')[1];
            }
          }
          if (app.recruiter_name) sentToName = app.recruiter_name;

          const dateObj = new Date(app.applied_at || app.created_at);
          const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

          const statusClasses = {
            Rejected: 'bg-[var(--c-danger)]/10 text-[var(--c-danger)] border-[var(--c-danger)]/20',
            Interview: 'bg-[var(--c-accent)]/10 text-[var(--c-accent)] border-[var(--c-accent)]/20',
            Sent: 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
            Viewed: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            Responded: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            Offer: 'bg-[var(--c-primary)]/10 text-[var(--c-primary)] border-[var(--c-primary)]/20 shadow-[0_0_10px_var(--c-primary)]',
          };

          return (
            <tr
              key={app.id}
              className="cursor-pointer bg-transparent hover:bg-[var(--bg-hover)] hover:outline hover:outline-1 hover:outline-white/15 hover:shadow-[0_15px_40px_-10px_rgba(0,0,0,0.7)] hover:-translate-y-1 transition-all duration-300 ease-out group relative z-0 hover:z-10"
              onClick={() => onRowClick(app)}
            >
              <td className="py-5 pl-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center text-[var(--text-primary)] text-[12px] font-black rounded-none shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] border border-[var(--border-subtle)] shrink-0" style={{ background: getColor(app.company) }}>
                    {(app.company || 'XX').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-[var(--text-primary)]/90 font-bold text-[14px] tracking-tight">{app.company}</div>
                </div>
              </td>
              <td className="py-5">
                <div className="flex items-center justify-center gap-2">
                  <UserCircle size={14} className="text-[var(--text-primary)]/30 shrink-0" />
                  <div className="text-[var(--text-primary)]/80 text-[13px] font-medium">{sentToName}</div>
                </div>
              </td>
              <td className="py-5 text-center">
                <div className="text-[12px] text-[var(--text-primary)]/70 font-semibold tracking-wide max-w-[200px] whitespace-normal break-words mx-auto">
                  {app.role || 'General Application'}
                </div>
              </td>
              <td className="py-5 text-center">
                <div className="text-[11px] text-[var(--text-primary)]/40 tracking-wider font-mono">{domain}</div>
              </td>
              <td className="py-5 text-center">
                <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${statusClasses[app.status] || 'bg-[var(--bg-hover)] text-[var(--text-primary)]/50 border-[var(--border-subtle)]'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
                  {app.status}
                </span>
              </td>
              <td className="py-5 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[var(--text-primary)]/80 text-[13px] font-medium">{formattedDate}</span>
                  <span className="w-px h-3 bg-[var(--border-strong)]"></span>
                  <span className="text-[var(--text-muted)] text-[11px] tracking-wide">{formattedTime}</span>
                </div>
              </td>
              <td className="py-5 pr-6 text-right">
                <button onClick={(e) => { e.stopPropagation(); onRowClick(app); }}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--text-primary)] text-[var(--bg-base)] transition-all duration-300 shadow-sm group-hover:shadow-md hover:-translate-y-1 hover:scale-110 hover:shadow-lg active:scale-95 active:translate-y-0"
                  aria-label={`View details for ${app.company}`}
                >
                  <ArrowRight size={14} className="-rotate-45" />
                </button>
              </td>
            </tr>
          );
        })}
        {applications.length === 0 && (
          <tr>
            <td colSpan="7" className="py-16">
              <EmptyState icon={Search} title="No applications found" message="You haven't tracked any applications yet." />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
