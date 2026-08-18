'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Zap, LogOut, Sun, Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useEmailCounts, useProfile } from '@/shared/hooks';

import NotificationCenter from './NotificationCenter';
import { brand } from '@/config/brand.config';
import { useAuth } from '@/shared/context/AuthContext';
import { MAIN_NAV, ACCOUNT_NAV } from '@/config/routes.config';

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const { counts } = useEmailCounts();
  const { profile } = useProfile();
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef(null);

  const items = MAIN_NAV(counts);
  const userName = profile?.full_name || profile?.name || 'User';
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const nav = useCallback(() => {
    if (onClose && window.innerWidth < 768) onClose();
  }, [onClose]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const enter = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsHovered(true), 80);
  }, []);

  const leave = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsHovered(false), 300);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const open = isHovered;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  COLLAPSED: Grid Cell Icon
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const CellIcon = ({ item, isMain = true, isLast = false }) => {
    const I = item.icon;
    const active = pathname === item.href || (isMain && pathname?.startsWith(item.href + '/'));

    return (
      <Link
        href={item.href}
        onClick={nav}
        aria-label={item.label}
        className={`group/cell relative flex items-center justify-center w-full h-[60px] cursor-pointer border-b transition-colors duration-150 ${isLast ? 'border-b-transparent' : 'border-b-[var(--border-subtle)]'
          } ${active
            ? 'bg-[var(--c-primary)]/[0.1] text-[var(--text-primary)]'
            : 'hover:bg-[var(--bg-hover)]'
          }`}
      >
        {/* Active left accent */}
        {active && (
          <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-primary)]" />
        )}

        <I
          size={20}
          strokeWidth={active ? 2.2 : 1.6}
          className={`transition-all duration-300 ease-[cubic-bezier(0.2,1,0.2,1)] ${active
              ? 'text-[var(--c-primary)]'
              : 'text-[var(--text-tertiary)] group-hover/cell:text-[var(--text-primary)] group-hover/cell:scale-110 group-hover/cell:-translate-y-0.5'
            }`}
        />

        {/* Badge */}
        {item.badge && (
          <span className="absolute top-[14px] right-[16px] w-[6px] h-[6px] bg-[var(--c-primary)]" />
        )}

        {/* Tooltip */}
        <span className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 h-[36px] flex items-center px-3.5 bg-[var(--bg-base)] border border-[var(--border-strong)] text-[12px] font-semibold tracking-wide text-[var(--text-primary)] whitespace-nowrap opacity-0 group-hover/cell:opacity-100 pointer-events-none transition-opacity duration-100 z-[100]">
          {item.label}
          {item.tag && <span className="ml-2 text-[var(--c-primary)] text-[9px] uppercase tracking-wider">· {item.tag}</span>}
        </span>
      </Link>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  EXPANDED: Row Item
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const RowItem = ({ item, isMain = true, isLast = false }) => {
    const I = item.icon;
    const active = pathname === item.href || (isMain && pathname?.startsWith(item.href + '/'));

    return (
      <Link
        href={item.href}
        onClick={nav}
        className={`group/row relative flex items-center gap-3.5 h-[48px] px-5 cursor-pointer border-b transition-colors duration-150 ${isLast ? 'border-b-transparent' : 'border-b-[var(--border-subtle)]'
          } ${active
            ? 'bg-[var(--c-primary)]/[0.1] text-[var(--text-primary)]'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }`}
      >
        {/* Active left accent */}
        {active && (
          <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-primary)]" />
        )}

        <I
          size={18}
          strokeWidth={active ? 2.2 : 1.6}
          className={`shrink-0 transition-all duration-300 ease-[cubic-bezier(0.2,1,0.2,1)] ${active ? 'text-[var(--c-primary)]' : 'group-hover/row:text-[var(--text-primary)] group-hover/row:scale-110 group-hover/row:-translate-y-0.5'
            }`}
        />

        <span className="flex-1 text-[14px] font-medium truncate">{item.label}</span>

        {item.badge && (
          <span className="text-[12px] font-semibold text-[var(--c-primary)] tabular-nums">{item.badge}</span>
        )}

        {item.tag && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border border-[var(--border-subtle)] px-1.5 py-[2px]">{item.tag}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`bg-[var(--bg-base)] border-r border-[var(--border-subtle)] h-screen flex flex-col overflow-hidden transition-[width] duration-[280ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${open ? 'w-[280px]' : 'w-[280px] md:w-[72px]'
        }`}
    >
      {/* ── Brand ── */}
      <div className={`flex items-center shrink-0 h-[64px] border-b border-[var(--border-subtle)] transition-all duration-[280ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${open ? 'gap-3 px-5' : 'justify-center px-0'
        } group cursor-pointer`}>
        <div className={`shrink-0 flex items-center justify-center bg-black rounded-sm relative group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 ease-out ${open ? 'w-[32px] h-[32px]' : 'w-[40px] h-[40px]'}`}>
          <Image src="/logo.png" alt={`${brand.name} Logo`} width={open ? 16 : 20} height={open ? 16 : 20} className="object-contain drop-shadow-md group-hover:drop-shadow-[0_0_8px_var(--c-primary)] transition-all duration-500" />
        </div>
        {open && (
          <div className="flex items-baseline gap-1.5 overflow-hidden">
            <span className="text-[16px] font-bold tracking-tight text-[var(--text-primary)] group-hover:tracking-[0.2em] group-hover:text-[var(--c-primary)] transition-all duration-500">{brand.name}</span>
            <span className="text-[11px] font-medium text-[var(--text-tertiary)] tracking-wide transition-all duration-500">Intelligence</span>
          </div>
        )}
      </div>

      {/* ── Main Nav Grid ── */}
      <div className={`shrink-0 flex flex-col ${!open ? 'border-b border-[var(--border-subtle)]' : ''}`}>
        {items.map((item, i) => open
          ? <RowItem key={item.href} item={item} isLast={i === items.length - 1} />
          : <CellIcon key={item.href} item={item} isLast={i === items.length - 1} />
        )}
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1 min-h-0" />

      {/* ── Section Break ── */}
      {!open && (
        <div className="shrink-0 h-[8px] bg-[var(--bg-surface)] border-t border-b border-[var(--border-subtle)]" />
      )}

      {/* ── Account Nav Grid ── */}
      <div className={`shrink-0 flex flex-col ${!open ? 'border-b border-transparent' : ''}`}>
        {ACCOUNT_NAV.map((item, i) => open
          ? <RowItem key={item.href} item={item} isMain={false} isLast={i === ACCOUNT_NAV.length - 1} />
          : <CellIcon key={item.href} item={item} isMain={false} isLast={i === ACCOUNT_NAV.length - 1} />
        )}
      </div>

      {/* ── User ── */}
      <div className={`shrink-0 flex items-center border-t border-[var(--border-subtle)] transition-all duration-[280ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${open ? 'h-[64px] px-4 gap-3' : 'h-[64px] justify-center'
        }`}>
        <div className={`group/av relative shrink-0 bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center font-bold cursor-pointer hover:bg-[var(--c-primary)] hover:text-white hover:border-[var(--c-primary)] transition-colors duration-150 ${open ? 'w-[36px] h-[36px] text-[12px] text-[var(--c-primary)]' : 'w-[40px] h-[40px] text-[13px] text-[var(--c-primary)]'
          }`}>
          {initials}
          {!open && (
            <span className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 h-[36px] flex items-center px-3.5 bg-[var(--bg-base)] border border-[var(--border-strong)] text-[12px] font-semibold text-[var(--text-primary)] whitespace-nowrap opacity-0 group-hover/av:opacity-100 pointer-events-none transition-opacity duration-100 z-[100]">
              {userName}
            </span>
          )}
        </div>

        {open && (
          <>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate leading-tight">{userName}</span>
              <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1 mt-[2px]">
                <Zap size={10} className="text-amber-400 fill-amber-400" />Pro
              </span>
            </div>
            <div className="flex items-center gap-1">
              <NotificationCenter />
              {mounted && (
                <button
                  onClick={(e) => { e.preventDefault(); setTheme(theme === 'dark' ? 'light' : 'dark'); }}
                  className="w-[32px] h-[32px] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 cursor-pointer"
                  aria-label="Toggle Theme"
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
              )}
              <button
                onClick={async () => {
                  if (window.confirm('Are you sure you want to log out?')) {
                    try { await signOut(); } catch { }
                    window.location.href = '/';
                  }
                }}
                className="w-[32px] h-[32px] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 cursor-pointer"
                aria-label="Log out"
              >
                <LogOut size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
