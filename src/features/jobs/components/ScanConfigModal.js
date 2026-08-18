'use client';

import { X, Settings, Clock, Play } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { brand } from '@/config/brand.config';

export default function ScanConfigModal({ onClose }) {
  const [cron, setCron] = useState('0 8 * * *');
  const [isAutoEnabled, setIsAutoEnabled] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-md flex flex-col relative overflow-hidden bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] shadow-none rounded-none animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-strong)] flex justify-between items-center bg-[var(--bg-surface)] shadow-sm">
          <h2 className="text-[14px] font-semibold flex items-center gap-2">
            <Settings size={14} className="text-[var(--text-muted)]" />
            Scan Configurations
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border-2 border-transparent hover:border-[var(--border-strong)] rounded-none transition-none text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold">Automated Background Scanning</label>
              <div 
                onClick={() => setIsAutoEnabled(!isAutoEnabled)}
                className={`w-8 h-4 rounded-none cursor-pointer relative transition-colors border ${isAutoEnabled ? 'bg-[var(--c-primary)] border-[var(--c-primary)]' : 'bg-[var(--bg-surface)] border-[var(--border-strong)]'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-[var(--text-primary)] rounded-none transition-transform ${isAutoEnabled ? 'left-4 bg-white' : 'left-0.5'}`} />
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Run the scraping engine automatically in the background using a cron job.</p>
          </div>

          {isAutoEnabled && (
            <div className="p-5 rounded-none border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-4">
              <div>
                <label className="text-[12px] text-[var(--text-secondary)] mb-1 block">Cron Schedule (UTC)</label>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[var(--text-muted)]" />
                  <input 
                    type="text" 
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] outline-none rounded-none text-[13px] font-mono text-[var(--text-primary)] px-4 py-2.5 placeholder:text-zinc-700 focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                    value={cron}
                    onChange={e => setCron(e.target.value)}
                  />
                </div>
                <div className="text-[10px] text-[var(--c-accent)] mt-1">Runs every day at 8:00 AM</div>
              </div>
            </div>
          )}

          <div>
            <label className="text-[13px] font-semibold mb-2 block">Portals to Scan</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" defaultChecked /> LinkedIn (via agent-reach)</label>
              <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" defaultChecked /> Naukri (coming soon)</label>
              <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" defaultChecked /> Wellfound (coming soon)</label>
            </div>
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-6">
            <h3 className="text-[13px] font-semibold mb-4">Location Targeting</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[12px] text-[var(--text-secondary)] mb-1 block">Current Location</label>
                <input 
                  type="text" 
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] outline-none rounded-none text-[13px] text-[var(--text-primary)] px-4 py-2.5 placeholder:text-zinc-700 focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                  placeholder="e.g. San Francisco, CA"
                />
              </div>

              <div>
                <label className="text-[12px] text-[var(--text-secondary)] mb-1 block">Preferred Locations (Up to 5)</label>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <input 
                      key={num}
                      type="text" 
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] outline-none rounded-none text-[13px] text-[var(--text-primary)] px-4 py-2 placeholder:text-zinc-700 focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                      placeholder={`Preferred Location ${num}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[var(--border-subtle)] bg-white/[0.02] flex justify-between items-center">
          {/* Logo & Brand Name */}
          <div className="hidden sm:flex items-center gap-2.5 opacity-50 hover:opacity-100 transition-all duration-500 ease-out group cursor-pointer">
            <div className="relative group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 ease-out">
              <Image src={brand.logo.path} alt={brand.name} width={18} height={18} className="object-contain drop-shadow-md group-hover:drop-shadow-[0_0_8px_var(--c-primary)] transition-all duration-500" />
            </div>
            <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide group-hover:tracking-[0.2em] group-hover:text-[var(--c-primary)] transition-all duration-500">{brand.name}</span>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
            <button onClick={onClose} className="flex items-center gap-2 px-5 py-2 text-[12px] font-bold tracking-[0.1em] uppercase text-[var(--text-primary)] bg-white/10 hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] rounded-none transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              <Play size={14} className="text-[var(--c-primary)]" /> Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
