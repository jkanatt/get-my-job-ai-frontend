import { Activity, Send, Eye, Mail, Target, Clock, Calendar } from 'lucide-react';

export default function ActivityFeed({ feed, onItemClick }) {
  if (!feed || feed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-none h-full shadow-sm">
        <Activity size={32} className="text-[var(--text-muted)] mb-4" />
        <h3 className="text-[14px] font-bold text-[var(--text-primary)]">No recent activity</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-1">Your automated events will appear here.</p>
      </div>
    );
  }

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'send': return <Send size={16} className="text-white" />;
      case 'eye': return <Eye size={16} className="text-white" />;
      case 'mail': return <Mail size={16} className="text-white" />;
      case 'target': return <Target size={16} className="text-white" />;
      case 'calendar': return <Calendar size={16} className="text-white" />;
      default: return <Activity size={16} className="text-white" />;
    }
  };

  const getBgClass = (iconName) => {
    switch (iconName) {
      case 'send': return 'bg-blue-500 border-blue-600';
      case 'eye': return 'bg-emerald-500 border-emerald-600';
      case 'mail': return 'bg-purple-500 border-purple-600';
      case 'target': return 'bg-orange-500 border-orange-600';
      case 'calendar': return 'bg-pink-500 border-pink-600';
      case 'calendar': return 'bg-pink-500 border-pink-600';
      default: return 'bg-[var(--text-secondary)] border-[var(--text-muted)]';
    }
  };

  const getHoverBorderClass = (iconName) => {
    switch (iconName) {
      case 'send': return 'group-hover:border-blue-500';
      case 'eye': return 'group-hover:border-emerald-500';
      case 'mail': return 'group-hover:border-purple-500';
      case 'target': return 'group-hover:border-orange-500';
      case 'calendar': return 'group-hover:border-pink-500';
      default: return 'group-hover:border-[var(--text-secondary)]';
    }
  };

  const getHoverBgClass = (iconName) => {
    switch (iconName) {
      case 'send': return 'group-hover:bg-blue-500';
      case 'eye': return 'group-hover:bg-emerald-500';
      case 'mail': return 'group-hover:bg-purple-500';
      case 'target': return 'group-hover:bg-orange-500';
      case 'calendar': return 'group-hover:bg-pink-500';
      default: return 'group-hover:bg-[var(--text-secondary)]';
    }
  };

  return (
    <div className="card-base p-6 h-[680px] flex flex-col relative overflow-hidden group/feed rounded-none">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-none blur-[40px] pointer-events-none transition-opacity duration-500 group-hover/feed:bg-indigo-500/10" />
      <div className="flex items-center justify-between mb-6 relative z-10 shrink-0 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center shadow-sm">
            <Clock size={16} className="text-[var(--text-muted)]" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-[var(--text-primary)] tracking-wide flex items-center gap-2">
              Live Activity Log
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] tracking-wider uppercase mt-0.5">Real-time automation</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-3 custom-scrollbar relative z-10 min-h-0 pb-2">
        {feed.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-[12px] font-medium tracking-wide uppercase border border-dashed border-[var(--border-subtle)] p-8">
            No activity yet
          </div>
        ) : (
          feed.map((item, index) => (
            <div
              key={item.id || index}
              className="flex gap-5 relative group cursor-pointer"
              onClick={() => onItemClick && onItemClick(item)}
            >
              {index !== feed.length - 1 && (
                <div className="absolute top-10 left-[19px] w-0.5 h-[calc(100%+8px)] bg-[var(--border-strong)] transition-colors group-hover:bg-[var(--c-primary)]/30" />
              )}
              <div className={`w-10 h-10 mt-0.5 rounded-none flex items-center justify-center shrink-0 border relative z-10 shadow-sm transition-transform group-hover:scale-105 ${getBgClass(item.icon)}`}>
                {getIcon(item.icon)}
              </div>
              <div className="flex-1 pb-6">
                <div className={`bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 rounded-none shadow-sm transition-colors relative ${getHoverBorderClass(item.icon)}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-[var(--border-strong)] transition-colors rounded-none ${getHoverBgClass(item.icon)}`} />
                  <div className="flex justify-between items-start mb-1 pl-2">
                    <span className="text-[13px] font-bold text-[var(--text-primary)] tracking-wide leading-tight pr-4">{item.title}</span>
                    <span className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase shrink-0 pt-0.5">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {item.context && (
                    <div className="flex flex-col gap-2 pl-2 text-[12px] font-medium text-[var(--text-muted)] mt-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[var(--c-primary)] bg-[var(--c-primary)]/10 px-2 py-0.5 rounded-none border border-[var(--c-primary)]/20">{item.context.recruiter}</span>
                        <span className="text-[var(--text-secondary)]">on</span>
                        <span className="text-[var(--text-primary)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-none border border-[var(--border-subtle)]">{item.context.role}</span>
                        <span className="text-[var(--text-secondary)]">at</span>
                      </div>
                      <span className="text-[14px] text-[var(--text-primary)] font-bold">{item.context.company}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
