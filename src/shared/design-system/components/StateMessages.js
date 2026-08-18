import React from 'react';

export function EmptyState({ icon: Icon, title, message, children }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-500 fill-mode-both w-full h-full min-h-[200px]">
      {Icon && (
        <div className="w-16 h-16 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.12)] flex items-center justify-center mb-6 relative overflow-hidden group transition-all duration-500 hover:shadow-[0_8px_30px_rgba(255,255,255,0.05)]">
           <div className="absolute inset-0 bg-gradient-to-tr from-[var(--c-primary)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
           <Icon className="text-[var(--text-muted)] w-7 h-7 relative z-10 transition-all duration-500 group-hover:text-[var(--text-primary)] group-hover:scale-110" strokeWidth={1.5} />
        </div>
      )}
      <div className="text-[14px] font-black uppercase tracking-[0.15em] text-[var(--text-primary)] mb-3">{title}</div>
      {message && <div className="text-[13px] text-[var(--text-muted)] max-w-[280px] leading-relaxed mb-6 font-medium">{message}</div>}
      {children}
    </div>
  );
}

export function ErrorState({ icon: Icon, title = "System Error", message, children }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-500 fill-mode-both w-full h-full min-h-[200px]">
      <div className="w-16 h-16 bg-red-500/5 border border-red-500/20 shadow-[inset_0_1px_0_rgba(239,68,68,0.2),0_8px_30px_rgba(239,68,68,0.15)] flex items-center justify-center mb-6 relative overflow-hidden group transition-all duration-500">
         <div className="absolute inset-0 bg-gradient-to-tr from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
         {Icon && <Icon className="text-red-400 w-7 h-7 relative z-10 animate-pulse group-hover:scale-110 transition-transform duration-500" strokeWidth={1.5} />}
      </div>
      <div className="text-[14px] font-black uppercase tracking-[0.15em] text-red-500 mb-3 drop-shadow-[0_0_12px_rgba(239,68,68,0.3)]">{title}</div>
      {message && <div className="text-[13px] text-[var(--text-muted)] max-w-[320px] leading-relaxed font-medium mb-6">{message}</div>}
      {children}
    </div>
  );
}
