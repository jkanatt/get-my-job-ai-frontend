'use client';

import { useState } from 'react';
import { Save, Loader2, Database, Upload, Download, RefreshCw, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, useJobs, useApplications } from '@/shared/hooks';
import { SettingsSkeleton } from '@/shared/design-system/components/Skeletons';
import { apiFetch } from '@/shared/utils/apiFetch';
import { brand } from '@/config/brand.config';

export default function SettingsPage() {
  const { settings, isLoading, updateSettings } = useSettings();
  const { addJob, jobs } = useJobs();
  const { addApplication, applications, deleteApplication } = useApplications();

  // Local state for each section to handle changes before saving
  const [generalState, setGeneralState] = useState(null);
  const [atsState, setAtsState] = useState(null);

  // Initialize state from API once loaded
  const general = generalState || settings;
  const ats = atsState || settings;

  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingAts, setSavingAts] = useState(false);
  const [testingSync, setTestingSync] = useState(false);
  const [dbResetting, setDbResetting] = useState(false);

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await updateSettings({
        gmail_user: general.gmail_user,
        sender_name: general.sender_name,
        resume_prefix: general.resume_prefix,
        build_path: general.build_path,
        sync_enabled: general.sync_enabled,
        email_signature: general.email_signature
      });
      toast.success('General settings saved!');
    } catch (e) {
      toast.error('Error saving general settings: ' + e.message);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveAts = async () => {
    setSavingAts(true);
    try {
      await updateSettings({
        linkedin_keywords: ats.linkedin_keywords,
        max_posts_per_scan: parseInt(ats.max_posts_per_scan),
        auto_scan_interval: ats.auto_scan_interval,
        min_ats_threshold: parseInt(ats.min_ats_threshold),
        headless_mode: ats.headless_mode,
        auto_date_naming: ats.auto_date_naming,
        auto_apply: ats.auto_apply
      });
      toast.success('ATS Engine settings saved!');
    } catch (e) {
      toast.error('Error saving ATS settings: ' + e.message);
    } finally {
      setSavingAts(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingSync(true);
    try {
      const res = await apiFetch('/api/emails/sync?test=true', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      toast.success('Connection successful! Found ' + data.emailsSynced + ' emails.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTestingSync(false);
    }
  };

  const handleExportData = async () => {
    try {
      let allApps = [];
      let offset = 0;
      const data = {
        applications: applications.map(a => {
          const { id, user_id, ...rest } = a;
          return rest;
        }),
        jobs: jobs.map(j => {
          const { id, user_id, ...rest } = j;
          return rest;
        }),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'getmyjob_backup.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Export failed: ' + e.message);
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.applications && Array.isArray(data.applications)) {
          for (const app of data.applications) {
            const { id, user_id, ...appData } = app;
            await addApplication(appData);
          }
        }

        if (data.jobs && Array.isArray(data.jobs)) {
          for (const job of data.jobs) {
            const { id, user_id, ...jobData } = job;
            await addJob(jobData);
          }
        }

        toast.success(`Imported ${data.applications?.length || 0} applications and ${data.jobs?.length || 0} jobs.`);
      } catch (e) {
        toast.error('Import failed: ' + e.message);
      }
    };
    input.click();
  };

  const handleResetDb = async () => {
    if (window.prompt('WARNING: This will delete ALL applications. Type "RESET" to confirm.') === 'RESET') {
      setDbResetting(true);
      try {
        await Promise.all(applications.map(app => deleteApplication(app.id)));
        toast.success('Database reset complete.');
        window.location.reload();
      } catch (e) {
        toast.error('Reset failed: ' + e.message);
      } finally {
        setDbResetting(false);
      }
    }
  };


  return (
    <div className="w-full space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 pb-8 border-b border-[var(--border-subtle)] relative">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-transparent blur-3xl -z-10" />
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-none bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-none relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 opacity-50" />
            <SettingsIcon size={26} className="text-blue-400 relative z-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="h1">Settings</h1>
            <p className="body-text">Configure your {brand.shortName} engine and preferences.</p>
          </div>
        </div>
      </div>

      <SettingsSection
        title="General Profile & Paths"
        description="Core identity used for email generation and local paths."
        onSave={handleSaveGeneral}
        isSaving={savingGeneral}
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="caption block mb-1">Gmail Account</label>
            <input className="input-base w-full" value={general.gmail_user || ''} onChange={e => setGeneralState({ ...general, gmail_user: e.target.value })} placeholder="e.g. name@example.com" />
          </div>
          <div>
            <label className="caption block mb-1">Sender Name (Outbound emails)</label>
            <input className="input-base w-full" value={general.sender_name || ''} onChange={e => setGeneralState({ ...general, sender_name: e.target.value })} />
          </div>
          <div>
            <label className="caption block mb-1">Resume File Prefix</label>
            <input className="input-base w-full" value={general.resume_prefix || ''} onChange={e => setGeneralState({ ...general, resume_prefix: e.target.value })} />
          </div>
          <div>
            <label className="caption block mb-1">LaTeX Build Path</label>
            <input className="input-base w-full font-mono text-[11px]" value={general.build_path || ''} onChange={e => setGeneralState({ ...general, build_path: e.target.value })} />
          </div>
          <div className="col-span-2 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-[var(--text-primary)] mb-1">Gmail Sync</div>
                <div className="text-[11px] text-[var(--text-muted)]">Enable continuous synchronization with your Gmail account via OAuth2.</div>
              </div>
              <div className="flex items-center gap-3">
                <button className="btn btn-outline btn-sm" onClick={handleTestConnection} disabled={testingSync}>
                  {testingSync ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Test Connection
                </button>
                <Toggle enabled={general.sync_enabled} onChange={v => setGeneralState({ ...general, sync_enabled: v })} />
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="ATS & Scraping Engine"
        description={`Control how ${brand.shortName} parses jobs and evaluates your match score.`}
        onSave={handleSaveAts}
        isSaving={savingAts}
      >
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="caption block mb-1">Target LinkedIn Keywords (One per line)</label>
            <textarea className="input-base w-full h-24 font-mono text-[11px]" value={ats.linkedin_keywords || ''} onChange={e => setAtsState({ ...ats, linkedin_keywords: e.target.value })} />
          </div>

          <div>
            <label className="caption block mb-1">Max Posts Per Scan</label>
            <input type="number" className="input-base w-full" value={ats.max_posts_per_scan || 100} onChange={e => setAtsState({ ...ats, max_posts_per_scan: e.target.value })} />
          </div>

          <div>
            <label className="caption block mb-1">Auto-Scan Interval (Cron)</label>
            <select className="input-base w-full bg-transparent" value={ats.auto_scan_interval || 'off'} onChange={e => setAtsState({ ...ats, auto_scan_interval: e.target.value })}>
              <option value="off">Manual Only</option>
              <option value="1h">Every 1 hour</option>
              <option value="6h">Every 6 hours</option>
              <option value="24h">Daily</option>
            </select>
          </div>

          <div>
            <label className="caption block mb-1">Minimum ATS Threshold to save (%)</label>
            <input type="number" className="input-base w-full" value={ats.min_ats_threshold || 40} onChange={e => setAtsState({ ...ats, min_ats_threshold: e.target.value })} />
          </div>

          <div className="col-span-2 pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div><div className="text-[13px] font-medium text-[var(--text-primary)]">Headless Mode</div><div className="text-[11px] text-[var(--text-muted)]">Run Playwright without launching browser UI</div></div>
              <Toggle enabled={ats.headless_mode} onChange={v => setAtsState({ ...ats, headless_mode: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div><div className="text-[13px] font-medium text-[var(--text-primary)]">Auto-Append Date</div><div className="text-[11px] text-[var(--text-muted)]">Append YYYY-MM-DD to tailored resume PDF filenames</div></div>
              <Toggle enabled={ats.auto_date_naming} onChange={v => setAtsState({ ...ats, auto_date_naming: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div><div className="text-[13px] font-medium text-[var(--c-warning)]">Auto-Apply (DANGEROUS)</div><div className="text-[11px] text-[var(--text-muted)]">Automatically send emails for matches &gt; 80%. Not recommended.</div></div>
              <Toggle enabled={ats.auto_apply} onChange={v => {
                if (v) {
                  if (window.confirm("WARNING: Enabling Auto-Apply means the AI will automatically send emails to recruiters on your behalf without your review. Are you absolutely sure you want to enable this?")) {
                    setAtsState({ ...ats, auto_apply: v });
                  }
                } else {
                  setAtsState({ ...ats, auto_apply: v });
                }
              }} danger />
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Email Preferences"
        description="Customize your default email signature."
        onSave={handleSaveGeneral}
        isSaving={savingGeneral}
      >
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="caption block mb-1">Email Signature</label>
            <textarea
              className="input-base w-full h-32 font-mono text-[12px]"
              value={general.email_signature !== undefined ? general.email_signature : ''}
              onChange={e => {
                setGeneralState({ ...general, email_signature: e.target.value });
                localStorage.setItem('email_signature', e.target.value);
              }}
              placeholder={`--\nSent from ${brand.shortName}`}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Account & Security"
        description="Manage your account authentication."
        onSave={() => {}}
        isSaving={false}
      >
        <div className="flex items-center justify-between p-4 border border-[var(--border-subtle)] rounded-none bg-[var(--bg-elevated)]">
          <div>
            <div className="text-[14px] font-bold text-[var(--text-primary)]">Manage Identity</div>
            <div className="text-[12px] text-[var(--text-muted)] mt-1">
              Your {brand.shortName} identity is secured by Firebase Auth.
            </div>
          </div>
          <button 
            className="btn btn-outline" 
            onClick={() => {
              // Simulated sign out for dummy frontend
              window.location.href = '/dashboard';
            }}
          >
            Sign Out
          </button>
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <div className="card-base border-red-500 border-opacity-30 overflow-hidden mt-12">
        <div className="bg-red-500 bg-opacity-5 p-4 border-b border-red-500 border-opacity-20 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <h3 className="text-[14px] font-bold text-red-500">Danger Zone</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-3 border border-[var(--border-subtle)] rounded-none">
            <div>
              <div className="text-[13px] font-bold text-[var(--text-primary)] mb-0.5">Export Data</div>
              <div className="text-[11px] text-[var(--text-muted)]">Download a JSON backup of all your applications, settings, and jobs.</div>
            </div>
            <button className="btn btn-outline" onClick={handleExportData}><Download size={14} /> Export</button>
          </div>

          <div className="flex items-center justify-between p-3 border border-[var(--border-subtle)] rounded-none">
            <div>
              <div className="text-[13px] font-bold text-[var(--text-primary)] mb-0.5">Import legacy applications.json</div>
              <div className="text-[11px] text-[var(--text-muted)]">Merge an old applications.json file into the current database.</div>
            </div>
            <button className="btn btn-outline" onClick={handleImportData}><Upload size={14} /> Import JSON</button>
          </div>

          <div className="flex items-center justify-between p-3 border border-red-500 border-opacity-30 rounded-none bg-red-500 bg-opacity-5">
            <div>
              <div className="text-[13px] font-bold text-red-500 mb-0.5">Reset Database</div>
              <div className="text-[11px] text-red-500 text-opacity-70">Permanently delete all applications and synced jobs. Settings will remain.</div>
            </div>
            <button className="btn btn-brutal !bg-red-500 hover:!bg-red-600 !border-red-600 !text-[var(--text-primary)]" onClick={handleResetDb} disabled={dbResetting}>
              {dbResetting ? <Loader2 size={14} className="animate-spin" /> : 'Reset Everything'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ title, description, children, onSave, isSaving }) {
  return (
    <div className="card-base overflow-hidden">
      <div className="card-header-adv">
        <div>
          <h2 className="text-[14px] font-bold tracking-wide">{title}</h2>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">{description}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save Changes
        </button>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function Toggle({ enabled, onChange, danger }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? (danger ? 'bg-red-500' : 'bg-[var(--c-primary)]') : 'bg-[var(--bg-elevated)]'
        }`}
    >
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-1'
        }`} />
    </button>
  );
}
