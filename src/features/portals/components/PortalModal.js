'use client';

import { useState, useEffect } from 'react';
import { X, Save, Shield, Key, History, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PortalModal({ isOpen, onClose, portal, initialCredentials, applicationHistory = [] }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (initialCredentials) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(initialCredentials.email || '');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPassword(initialCredentials.password || '');
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail('');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPassword('');
    }
  }, [initialCredentials, portal]);

  if (!isOpen || !portal) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // In a real app, this would hit an API route that updates Supabase and ats_credentials.json
      const res = await fetch('/api/portals/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: portal.domain,
          email,
          password
        })
      });

      if (!res.ok) throw new Error('Failed to save credentials');
      
      toast.success('Credentials saved securely.');
      setHasSaved(true);
      setTimeout(() => setHasSaved(false), 2000);
    } catch (err) {
      toast.error('Failed to save credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-none shadow-none overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-strong)] bg-[var(--bg-base)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-none bg-[var(--bg-hover)] border border-[var(--border-strong)] flex items-center justify-center shadow-none">
              <span className="text-xl font-black text-[var(--text-primary)]">{portal.name.charAt(0)}</span>
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-[var(--text-primary)]">{portal.name} Settings</h2>
              <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{portal.domain}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors rounded-none hover:bg-[var(--bg-hover)] border border-transparent hover:border-[var(--border-strong)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Credentials Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-black uppercase tracking-widest border-b border-[var(--border-strong)] pb-2 text-sm">
              <Shield size={16} className="text-[var(--c-primary)]" />
              <h3>ATS Automation Credentials</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Provide the exact login details for {portal.name}. When the Get My Job Engine encounters a job for this domain, it will use these credentials to log in seamlessly instead of creating a new account.
            </p>
            
            <form onSubmit={handleSave} className="bg-[var(--bg-base)] p-5 rounded-none border border-[var(--border-strong)] space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Account Email</label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-10 px-3 bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-none text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--text-primary)] transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Account Password</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-10 px-3 pl-9 bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-none text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--text-primary)] transition-all font-mono"
                  />
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 h-10 bg-[var(--text-primary)] text-[var(--bg-base)] rounded-none font-black text-xs uppercase tracking-widest hover:bg-[var(--text-secondary)] transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : (hasSaved ? <CheckCircle2 size={16} /> : <Save size={16} />)}
                  {isSaving ? 'Saving...' : (hasSaved ? 'Saved' : 'Save Credentials')}
                </button>
              </div>
            </form>
          </section>



        </div>
      </div>
    </div>
  );
}
