'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatsCard({ icon: Icon, label, value, change, changeType = 'up', accentColor = 'var(--c-primary)' }) {
  return (
    <div className={`card-base relative overflow-hidden p-6 group transition-all duration-300 hover:shadow-lg hover:-translate-y-1`} style={{ borderTop: `3px solid ${accentColor}` }}>
      <div className="absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-full blur-[40px] pointer-events-none" style={{ backgroundColor: accentColor }} />
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="w-10 h-10 bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center rounded-none shadow-sm" style={{ color: accentColor }}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        {change && (
          <span className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold tracking-wider rounded-none ${changeType === 'up' ? 'bg-[var(--c-success)]/10 text-[var(--c-success)] border border-[var(--c-success)]/20' : 'bg-[var(--c-danger)]/10 text-[var(--c-danger)] border border-[var(--c-danger)]/20'}`}>
            {changeType === 'up' ? <TrendingUp size={12} strokeWidth={3} /> : <TrendingDown size={12} strokeWidth={3} />}
            {change}
          </span>
        )}
      </div>
      <div className="text-[12px] font-bold text-[var(--text-muted)] tracking-wider uppercase mb-1 relative z-10">{label}</div>
      <div className="text-[32px] font-black tracking-tight text-[var(--text-primary)] relative z-10">{value}</div>
    </div>
  );
}
