'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, LayoutDashboard, Briefcase, KanbanSquare, Calendar as CalendarIcon, User, Settings, PenSquare, Mail, BookOpen, Plug } from 'lucide-react';
import { useCompose } from '@/app/context/ComposeContext';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef(null);
  const { openCompose } = useCompose();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => {
          if (!open) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
          return !open;
        });
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const allCommands = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, action: () => router.push('/dashboard') },
    { id: 'jobs', name: 'Jobs', icon: Briefcase, action: () => router.push('/jobs') },
    { id: 'inbox', name: 'Inbox', icon: Mail, action: () => router.push('/inbox') },
    { id: 'tracker', name: 'Application Tracker', icon: KanbanSquare, action: () => router.push('/tracker') },
    { id: 'calendar', name: 'Calendar', icon: CalendarIcon, action: () => router.push('/calendar') },
    { id: 'integrations', name: 'Integrations', icon: Plug, action: () => router.push('/integrations') },
    { id: 'profile', name: 'Profile', icon: User, action: () => router.push('/profile') },
    { id: 'settings', name: 'Settings', icon: Settings, action: () => router.push('/settings') },
    { id: 'compose', name: 'Compose Email', icon: PenSquare, action: () => openCompose() },
  ];

  const filteredCommands = query === '' 
    ? allCommands 
    : allCommands.filter((command) => 
        command.name.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelect = (command) => {
    setIsOpen(false);
    command.action();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleSelect(filteredCommands[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-[var(--bg-base)]/90 backdrop-blur-md z-[9999]"
        onClick={() => setIsOpen(false)}
      />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] rounded-none shadow-none overflow-hidden z-[10000] flex flex-col">
        <div className="flex items-center px-4 py-4 border-b border-[var(--border-subtle)] gap-3">
          <Search size={20} className="text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] text-[15px]"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <div className="flex items-center gap-1">
             <kbd className="px-1.5 py-0.5 rounded-none bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] font-mono">ESC</kbd>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-sm text-[var(--text-muted)]">
              No results found.
            </div>
          ) : (
            filteredCommands.map((command, i) => (
              <button
                key={command.id}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-none text-left transition-colors border border-transparent ${
                  i === selectedIndex 
                    ? 'bg-[var(--c-primary)]/10 text-[var(--text-primary)] border-[var(--c-primary)] shadow-[inset_4px_0_0_var(--c-primary)]' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)]'
                }`}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => handleSelect(command)}
              >
                <command.icon size={18} className={i === selectedIndex ? 'text-[var(--c-primary)]' : 'text-[var(--text-muted)]'} />
                <span className="font-medium text-sm">{command.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
