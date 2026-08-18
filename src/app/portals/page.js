'use client';

import { useState, useEffect, useMemo } from 'react';
import { Globe, Settings, Lock, ChevronDown, ChevronUp, History } from 'lucide-react';
import PortalModal from '@/features/portals/components/PortalModal';
import { useApplications, useJobs } from '@/shared/hooks'; // Assuming standard context usage

// Base ATS Definitions
const SUPPORTED_PORTALS = [
  { id: 'workday', name: 'Workday', domain: 'myworkdayjobs.com', color: '#005CB9' },
  { id: 'glassdoor', name: 'Glassdoor', domain: 'glassdoor.com', color: '#0CAA41' },
  { id: 'greenhouse', name: 'Greenhouse', domain: 'boards.greenhouse.io', color: '#00B2A9' },
  { id: 'lever', name: 'Lever', domain: 'jobs.lever.co', color: '#27B882' },
  { id: 'ashby', name: 'Ashby', domain: 'jobs.ashbyhq.com', color: '#4F46E5' },
  { id: 'bamboohr', name: 'BambooHR', domain: 'bamboohr.com', color: '#7EBD41' },
  { id: 'smartrecruiters', name: 'SmartRecruiters', domain: 'smartrecruiters.com', color: '#E1462D' },
];

export default function PortalsPage() {
  const { applications } = useApplications();
  const { jobs } = useJobs();
  const [selectedPortal, setSelectedPortal] = useState(null);
  const [expandedPortalId, setExpandedPortalId] = useState(null);
  const [credentialsVault, setCredentialsVault] = useState([]);
  
  // Dummy fetch for local credentials file in a real app this would hit an API
  useEffect(() => {
    fetch('/api/portals/credentials')
      .then(res => res.json())
      .then(data => setCredentialsVault(data.credentials || []))
      .catch(() => setCredentialsVault([])); // Ignore if no file exists yet
  }, []);

  // Compute stats per portal
  const portalStats = useMemo(() => {
    const stats = {};
    SUPPORTED_PORTALS.forEach(p => {
      stats[p.id] = { ...p, applications: [], jobs: [], hasCredentials: false, credentialData: null };
    });

    // Bucket applications
    if (applications) {
      applications.forEach(app => {
        // Attempt to find domain in the tracking notes or deduce from role
        const rawString = JSON.stringify(app).toLowerCase();
        
        for (const portal of SUPPORTED_PORTALS) {
          if (rawString.includes(portal.domain.toLowerCase()) || rawString.includes(portal.name.toLowerCase())) {
            stats[portal.id].applications.push(app);
            break; // Put in first matching bucket
          }
        }
      });
    }

    // Bucket jobs (Scraped metric)
    if (jobs) {
      jobs.forEach(job => {
        const rawString = JSON.stringify(job).toLowerCase();
        for (const portal of SUPPORTED_PORTALS) {
          if (rawString.includes(portal.domain.toLowerCase()) || rawString.includes(portal.name.toLowerCase())) {
            stats[portal.id].jobs.push(job);
            break;
          }
        }
      });
    }

    // Match credentials
    credentialsVault.forEach(cred => {
       const matched = Object.values(stats).find(s => cred.domain.includes(s.domain));
       if (matched) {
           matched.hasCredentials = true;
           matched.credentialData = cred;
       }
    });

    return Object.values(stats);
  }, [applications, jobs, credentialsVault]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-8 h-[80px] border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] z-10">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Globe className="text-[var(--c-primary)]" />
            ATS Portals
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage your authenticated ATS gateways and view platform-specific history.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="flex flex-col bg-[var(--bg-base)]">
          {portalStats.map((portal, index) => {
            const isExpanded = expandedPortalId === portal.id;
            const viewedMock = portal.applications.length > 0 ? portal.applications.length * 3 + 12 : 0;
            const responsesCount = portal.applications.filter(a => a.status === 'Interview' || a.status === 'Offer').length;
            const successRate = portal.applications.length > 0 ? Math.round((responsesCount / portal.applications.length) * 100) : '--';
            
            return (
              <div key={portal.id} className={`flex flex-col ${index !== portalStats.length - 1 ? 'border-b border-[var(--border-strong)]' : ''}`}>
                
                {/* Main Row */}
                <div 
                  onClick={() => setExpandedPortalId(isExpanded ? null : portal.id)}
                  className="group relative flex flex-col md:flex-row md:items-stretch justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-all min-h-[96px]"
                >
                  {/* Left Side: Info */}
                  <div className="flex items-center gap-5 md:w-[320px] p-6 shrink-0">
                    <div 
                      className="w-12 h-12 rounded-none flex items-center justify-center text-white font-black text-xl shrink-0"
                      style={{ backgroundColor: portal.color }}
                    >
                      {portal.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-[var(--text-primary)] tracking-wide">{portal.name}</h3>
                        {portal.hasCredentials && (
                          <span title="Connected" className="flex items-center justify-center w-4 h-4 bg-[var(--c-primary)]/10 text-[var(--c-primary)] rounded-none border border-[var(--c-primary)]/30">
                            <Lock size={8} />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] font-mono tracking-wider">{portal.domain}</p>
                    </div>
                  </div>

                  {/* Middle: Stats Row (Evenly distributed) */}
                  <div className="flex items-stretch flex-1">
                    <div className="flex-1 flex flex-col items-center justify-center px-4 border-l border-[var(--border-strong)]">
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 text-center">Scraped</span>
                      <span className="text-xl font-black">{portal.jobs.length}</span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center px-4 border-l border-[var(--border-strong)]">
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 text-center">Viewed</span>
                      <span className="text-xl font-black">{viewedMock}</span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center px-4 border-l border-[var(--border-strong)]">
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 text-center">Applied</span>
                      <span className="text-xl font-black">{portal.applications.length}</span>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center px-4 border-l border-[var(--border-strong)]">
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 text-center">Responses</span>
                      <span className="text-xl font-black text-[var(--text-primary)]">{responsesCount}</span>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center px-4 border-l border-[var(--border-strong)] bg-[var(--bg-subtle)]">
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1 text-center">Success</span>
                      <span className="text-xl font-black text-[var(--text-muted)]">{successRate}%</span>
                    </div>
                  </div>

                  {/* Right Side: Actions */}
                  <div className="flex items-stretch shrink-0">
                    <div className="flex items-stretch border-l border-[var(--border-strong)] w-[160px]">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPortal(portal);
                        }}
                        className={`w-full flex items-center justify-center transition-colors text-[10px] font-black uppercase tracking-widest rounded-none outline-none ${
                          portal.hasCredentials 
                            ? 'bg-transparent text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)]' 
                            : 'bg-white text-black hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        {portal.hasCredentials ? 'Manage' : 'Setup'}
                      </button>
                    </div>

                    <div className="flex items-center justify-center w-16 border-l border-[var(--border-strong)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Inline History */}
                {isExpanded && (
                  <div className="bg-[var(--bg-subtle)] border-t border-[var(--border-strong)] p-6 md:p-8 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-200">
                    <div className="flex items-center gap-2 mb-4">
                      <History size={16} className="text-[var(--text-muted)]" />
                      <h4 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">Application History</h4>
                    </div>

                    {portal.applications.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-[var(--border-strong)]">
                        <p className="text-xs font-mono text-[var(--text-muted)]">No jobs have been applied to via {portal.name} yet.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {portal.applications.map((app, i) => (
                          <div key={app.id || i} className="flex items-center justify-between p-4 bg-[var(--bg-base)] border border-[var(--border-strong)] hover:border-[var(--text-muted)] transition-colors">
                            <div>
                              <h4 className="text-sm font-bold text-[var(--text-primary)]">{app.role}</h4>
                              <p className="text-xs text-[var(--text-muted)] font-mono">{app.company}</p>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <span className="inline-flex items-center px-2 py-1 rounded-none text-[9px] font-black bg-[var(--c-primary)]/10 text-[var(--c-primary)] uppercase tracking-widest border border-[var(--c-primary)]/20 mb-1">
                                {app.status || 'Applied'}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                {new Date(app.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PortalModal 
        isOpen={!!selectedPortal} 
        onClose={() => setSelectedPortal(null)} 
        portal={selectedPortal} 
        initialCredentials={selectedPortal?.credentialData}
        applicationHistory={selectedPortal?.applications || []}
      />
    </div>
  );
}
