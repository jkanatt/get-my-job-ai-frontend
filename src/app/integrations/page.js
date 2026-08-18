'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plug, Check, ExternalLink, Settings, Zap, Mail, Calendar, FileText, Database, Globe, ArrowRight, ShieldCheck, Trash2, Loader2, Users } from 'lucide-react';
import { useSettings, useApplications } from '@/shared/hooks';
import { toast } from 'sonner';
import { auth } from '@/infrastructure/_legacy_firebase/client';
import { apiFetch } from '@/shared/utils/apiFetch';
import { brand } from '@/config/brand.config';
import PortalModal from '@/features/portals/components/PortalModal';

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts.readonly',
].join(' ');

export default function IntegrationsPage() {
  const { settings, isLoading, mutate } = useSettings();
  const { applications } = useApplications();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  const [selectedPortal, setSelectedPortal] = useState(null);
  const [credentialsVault, setCredentialsVault] = useState([]);

  useEffect(() => {
    fetch('/api/portals/credentials')
      .then(res => res.json())
      .then(data => setCredentialsVault(data.credentials || []))
      .catch(() => setCredentialsVault([]));
  }, []);

  const SUPPORTED_PORTALS = useMemo(() => [
    { id: 'workday', name: 'Workday', domain: 'myworkdayjobs.com', color: '#005CB9' },
    { id: 'glassdoor', name: 'Glassdoor', domain: 'glassdoor.com', color: '#0CAA41' },
    { id: 'greenhouse', name: 'Greenhouse', domain: 'boards.greenhouse.io', color: '#00B2A9' },
    { id: 'lever', name: 'Lever', domain: 'jobs.lever.co', color: '#27B882' },
    { id: 'ashby', name: 'Ashby', domain: 'jobs.ashbyhq.com', color: '#4F46E5' },
    { id: 'bamboohr', name: 'BambooHR', domain: 'bamboohr.com', color: '#7EBD41' },
    { id: 'smartrecruiters', name: 'SmartRecruiters', domain: 'smartrecruiters.com', color: '#E1462D' },
  ], []);

  const portalStats = useMemo(() => {
    const stats = {};
    SUPPORTED_PORTALS.forEach(p => {
      stats[p.id] = { ...p, applications: [], hasCredentials: false, credentialData: null };
    });

    if (applications) {
      applications.forEach(app => {
        const rawString = JSON.stringify(app).toLowerCase();
        for (const portal of SUPPORTED_PORTALS) {
          if (rawString.includes(portal.domain.toLowerCase()) || rawString.includes(portal.name.toLowerCase())) {
            stats[portal.id].applications.push(app);
            break;
          }
        }
      });
    }

    credentialsVault.forEach(cred => {
       const matched = Object.values(stats).find(s => cred.domain.includes(s.domain));
       if (matched) {
           matched.hasCredentials = true;
           matched.credentialData = cred;
       }
    });

    return Object.values(stats);
  }, [applications, credentialsVault, SUPPORTED_PORTALS]);

  const isGoogleConnected = !!settings.google_refresh_token;

  const handleRemoveCredential = async (domain) => {
    if (!confirm(`Are you sure you want to remove credentials for ${domain}?`)) return;
    try {
      const res = await fetch(`/api/portals/credentials?domain=${encodeURIComponent(domain)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove credential');
      toast.success('Credential removed successfully');
      
      fetch('/api/portals/credentials')
        .then(res => res.json())
        .then(data => setCredentialsVault(data.credentials || []));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      
      const res = await apiFetch('/api/auth/google', {
        method: 'POST'
      });
      
      if (!res.ok) throw new Error('Failed to initiate Google connection');
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (error) {
      toast.error(error.message);
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect Google Workspace? This will stop email and calendar sync.')) return;
    setIsDisconnecting(true);
    try {
      const res = await apiFetch('/api/auth/google/revoke', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to disconnect');
      toast.success('Google disconnected successfully');
      mutate();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 pb-8 border-b border-[var(--border-subtle)] relative">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-orange-500/5 to-transparent blur-3xl -z-10" />
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-none bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-none relative overflow-hidden">
            <Plug size={26} className="text-orange-400 relative z-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="h1">Integrations & Permissions</h1>
            <p className="body-text">Manage your connected accounts and security permissions.</p>
          </div>
        </div>
      </div>

      {/* Primary Integration: Google Workspace */}
      <div className={`card-base border-2 transition-colors ${isGoogleConnected ? 'border-green-500/30' : 'border-blue-500/30'}`}>
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
          
          <div className="flex-1 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white rounded-none flex items-center justify-center shrink-0 shadow-none border border-white p-3">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-black">Google Workspace</h2>
                <p className="text-[var(--text-muted)] mt-1 max-w-md">
                  Connect your Google account to enable two-way sync for Gmail, Google Calendar, and Google Contacts.
                </p>
                {isGoogleConnected && settings.google_email && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-green-500/10 text-green-600 px-3 py-1.5 rounded-none text-sm font-bold border border-green-500/50 shadow-none uppercase tracking-widest">
                    <Check size={16} />
                    Connected as {settings.google_email}
                  </div>
                )}
              </div>
            </div>

            {isGoogleConnected ? (
              <div className="flex gap-3">
                <button 
                  onClick={handleDisconnectGoogle}
                  disabled={isDisconnecting}
                  className="btn bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
                >
                  {isDisconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 size={16} />}
                  Disconnect
                </button>
              </div>
            ) : (
              <button 
                onClick={handleConnectGoogle}
                disabled={isConnecting}
                className="btn btn-primary"
              >
                {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Connect with Google'}
              </button>
            )}
          </div>

          <div className="flex-1 bg-[var(--bg-base)] rounded-none border border-[var(--border-strong)] flex flex-col">
            <div className="p-3 border-b border-[var(--border-strong)] flex items-center gap-2 bg-[var(--bg-hover)]">
              <ShieldCheck size={14} className={isGoogleConnected ? "text-emerald-500" : "text-[var(--text-muted)]"} /> 
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">Permissions Granted</span>
            </div>
            
            <div className="grid grid-cols-1 divide-y divide-[var(--border-strong)]">
              <div className="flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)] transition-colors">
                <div className={`p-2 border rounded-none flex items-center justify-center ${isGoogleConnected ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-strong)]'}`}>
                  <Mail size={16} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold tracking-wide ${!isGoogleConnected ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>Gmail API</span>
                  <span className="text-xs text-[var(--text-muted)] mt-0.5">Read, send, and modify emails on your behalf.</span>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)] transition-colors">
                <div className={`p-2 border rounded-none flex items-center justify-center ${isGoogleConnected ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-strong)]'}`}>
                  <Calendar size={16} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold tracking-wide ${!isGoogleConnected ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>Google Calendar</span>
                  <span className="text-xs text-[var(--text-muted)] mt-0.5">View and manage your calendar events for interviews.</span>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)] transition-colors">
                <div className={`p-2 border rounded-none flex items-center justify-center ${isGoogleConnected ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-strong)]'}`}>
                  <Users size={16} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold tracking-wide ${!isGoogleConnected ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>Google Contacts</span>
                  <span className="text-xs text-[var(--text-muted)] mt-0.5">Read your contacts for easy recruiter autocomplete.</span>
                </div>
              </div>
            </div>
            
            {isGoogleConnected && settings.google_connected_at && (
              <div className="mt-auto p-4 border-t border-[var(--border-strong)] text-xs font-mono text-[var(--text-muted)] flex items-center justify-between bg-[var(--bg-hover)]">
                <span>Authorized</span>
                <span>{new Date(settings.google_connected_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ATS Automations */}
      <h2 className="text-lg font-black mt-12 mb-4">ATS Automations</h2>
      <div className="flex flex-col border border-[var(--border-strong)] bg-[var(--bg-base)]">
        {portalStats.map((ats, idx) => (
          <div key={idx} className={`flex flex-col md:flex-row md:items-center justify-between p-4 bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] transition-all ${idx !== portalStats.length - 1 ? 'border-b border-[var(--border-strong)]' : ''}`}>
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <div 
                className="w-10 h-10 flex items-center justify-center text-white font-black text-lg"
                style={{ backgroundColor: ats.color }}
              >
                {ats.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[var(--text-primary)] tracking-wide">{ats.name}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{ats.domain}</span>
              </div>
            </div>
            
            <div className="flex items-stretch border border-[var(--border-strong)] bg-[var(--bg-base)]">
              <div className="px-4 py-2 border-r border-[var(--border-strong)] flex flex-col items-center justify-center min-w-[70px] bg-[var(--bg-hover)]">
                <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-0.5">Applied</span>
                <span className="text-sm font-black">{ats.applications.length}</span>
              </div>
              <div className="px-4 py-2 border-r border-[var(--border-strong)] flex flex-col items-center justify-center min-w-[90px] bg-[var(--bg-hover)]">
                <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-0.5">Success Rate</span>
                <span className="text-sm font-black text-[var(--text-muted)]">
                  {ats.applications.length > 0 
                    ? Math.round((ats.applications.filter(a => a.status === 'Interview' || a.status === 'Offer').length / ats.applications.length) * 100) + '%'
                    : '--%'}
                </span>
              </div>
              
              {ats.hasCredentials ? (
                <div className="flex">
                  <button 
                    onClick={() => setSelectedPortal(ats)}
                    className="px-6 flex items-center justify-center border-r border-[var(--border-strong)] bg-[var(--bg-hover)] hover:bg-[var(--bg-elevated)] hover:text-white transition-colors text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] rounded-none outline-none"
                  >
                    Manage
                  </button>
                  <button 
                    onClick={() => handleRemoveCredential(ats.domain)}
                    className="px-6 flex items-center justify-center bg-transparent hover:bg-red-950 hover:text-red-500 transition-colors text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px] rounded-none outline-none"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setSelectedPortal(ats)}
                  className="px-6 flex items-center justify-center bg-white text-black hover:bg-[var(--bg-hover)] transition-colors font-black uppercase tracking-widest text-[10px] rounded-none outline-none min-w-[90px]"
                >
                  Setup
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Other Integrations Grid */}
      <h2 className="text-lg font-black mt-12 mb-4">Other Integrations</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-75">
        <div className="card-base p-6 flex flex-col gap-4 transition-all">
          <div className="w-12 h-12 bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
            <Globe size={22} className="text-sky-500" />
          </div>
          <div>
            <h3 className="text-[14px] font-black uppercase tracking-wide">LinkedIn</h3>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Import jobs & sync connections.</p>
          </div>
          <button className="btn btn-sm w-full font-bold opacity-80 mt-auto" onClick={() => toast.info('This integration is currently in development and will be available soon!')}>Coming Soon</button>
        </div>

        <div className="card-base p-6 flex flex-col gap-4 transition-all">
          <div className="w-12 h-12 bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
            <FileText size={22} className="text-[var(--text-secondary)]" />
          </div>
          <div>
            <h3 className="text-[14px] font-black uppercase tracking-wide">Notion</h3>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Export your application tracker to Notion.</p>
          </div>
          <button className="btn btn-sm w-full font-bold opacity-80 mt-auto" onClick={() => toast.info('This integration is currently in development and will be available soon!')}>Coming Soon</button>
        </div>

        <div className="card-base p-6 flex flex-col gap-4 transition-all">
          <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Zap size={22} className="text-orange-500" />
          </div>
          <div>
            <h3 className="text-[14px] font-black uppercase tracking-wide">Zapier</h3>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Connect {brand.shortName} to 5,000+ apps.</p>
          </div>
          <button className="btn btn-sm w-full font-bold opacity-80 mt-auto" onClick={() => toast.info('This integration is currently in development and will be available soon!')}>Coming Soon</button>
        </div>
      </div>
      
      <PortalModal 
        isOpen={!!selectedPortal} 
        onClose={() => {
          setSelectedPortal(null);
          // Refresh credentials
          fetch('/api/portals/credentials')
            .then(res => res.json())
            .then(data => setCredentialsVault(data.credentials || []));
        }} 
        portal={selectedPortal} 
        initialCredentials={selectedPortal?.credentialData}
        applicationHistory={selectedPortal?.applications || []}
      />
    </div>
  );
}
