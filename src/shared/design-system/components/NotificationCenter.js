'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Briefcase, Mail, Calendar, Target, AlertCircle, X } from 'lucide-react';
import { useNotificationStore } from '@/shared/store';

const ICON_MAP = {
  job: Briefcase,
  email: Mail,
  calendar: Calendar,
  application: Target,
  system: AlertCircle,
};

const COLOR_MAP = {
  job: 'text-blue-400',
  email: 'text-emerald-400',
  calendar: 'text-amber-400',
  application: 'text-indigo-400',
  system: 'text-red-400',
};

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const { notifications, unreadCount, markAsRead, markAllRead, clearNotifications } = useNotificationStore();

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[var(--c-danger)] text-white text-[10px] font-black flex items-center justify-center rounded-none border-2 border-[var(--bg-base)] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] shadow-none rounded-none z-[100] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-black uppercase tracking-widest">Notifications</span>
              {unreadCount > 0 && (
                <span className="badge badge-primary text-[9px]">{unreadCount} new</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Mark all as read"
                title="Mark all as read"
              >
                <CheckCheck size={14} />
              </button>
              <button
                onClick={clearNotifications}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--c-danger)] transition-colors"
                aria-label="Clear all notifications"
                title="Clear all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-[var(--text-muted)]">
                <Bell size={28} className="mb-3 opacity-30" />
                <div className="text-[12px] font-bold">No notifications</div>
                <div className="text-[11px] mt-1 opacity-60">You&apos;re all caught up!</div>
              </div>
            ) : (
              notifications.map((n) => {
                const IconComponent = ICON_MAP[n.type] || AlertCircle;
                const iconColor = COLOR_MAP[n.type] || 'text-[var(--text-muted)]';

                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--border-subtle)] cursor-pointer transition-colors hover:bg-[var(--bg-hover)] ${
                      !n.read ? 'bg-[var(--c-primary-soft)]' : ''
                    }`}
                    onClick={() => markAsRead(n.id)}
                  >
                    <div className={`mt-0.5 ${iconColor}`}>
                      <IconComponent size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-[var(--text-primary)] leading-tight">{n.title}</div>
                      {n.message && (
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.message}</div>
                      )}
                      <div className="text-[10px] text-[var(--text-disabled)] mt-1 font-mono">{timeAgo(n.timestamp)}</div>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-none bg-[var(--c-primary)] mt-1.5 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
