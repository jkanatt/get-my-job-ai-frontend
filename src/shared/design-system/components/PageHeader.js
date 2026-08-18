'use client';

/**
 * Reusable page header with icon, title, subtitle, and action buttons.
 * Used consistently across Dashboard, Jobs, Tracker, Inbox, Networking, etc.
 */
export default function PageHeader({ icon: Icon, iconColor = 'blue', title, subtitle, children }) {
  const colorMap = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'rgba(59,130,246,0.2)' },
    indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', glow: 'rgba(99,102,241,0.2)' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'rgba(16,185,129,0.2)' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'rgba(168,85,247,0.2)' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'rgba(245,158,11,0.2)' },
  };

  const colors = colorMap[iconColor] || colorMap.blue;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 pb-8 border-b border-[var(--border-subtle)] relative">
      <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-r ${colors.bg.split(' ')[0].replace('from-', 'from-').replace('/20', '/5')} to-transparent blur-3xl -z-10`} />
      <div className="flex items-center gap-5">
        {Icon && (
          <div
            className={`w-14 h-14 rounded-none ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0 relative overflow-hidden`}
            style={{ boxShadow: `4px 4px 0 0 ${colors.glow}` }}
          >
            <div className="absolute inset-0 bg-white/5 opacity-50" />
            <Icon size={26} className={`${colors.text} relative z-10`} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="body-text">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
