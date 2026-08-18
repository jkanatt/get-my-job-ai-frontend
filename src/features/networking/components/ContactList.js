import { Search, Plus, Upload, Filter, Users, User, ArrowRight } from 'lucide-react';

import { toast } from 'sonner';

export default function ContactList({ contacts, selectedContactId, onSelect, onAddClick }) {
  return (
    <div className="flex flex-col h-full border-r border-[var(--border-subtle)] bg-[var(--bg-base)]">
      <div className="p-4 border-b border-[var(--border-subtle)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Users size={20} className="text-[var(--c-primary)]" />
            Contacts
          </h2>
          <div className="flex gap-2">
            <button onClick={() => toast.info('Import contacts feature coming soon')} className="p-2 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors">
              <Upload size={16} />
            </button>
            <button onClick={onAddClick} className="p-2 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Search contacts..." 
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg pl-9 pr-3 py-2 text-sm )] outline-none focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto hide-scrollbar p-2 space-y-1">
        {contacts.map((contact, index) => (
          <button
            key={contact.id}
            onClick={() => onSelect(contact)}
            className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-all animate-in fade-in slide-in-from-left-2 duration-300 fill-mode-both ${
              selectedContactId === contact.id 
                ? 'bg-[var(--bg-surface)] border border-[var(--border-strong)]' 
                : 'hover:bg-[var(--bg-surface)] border border-transparent'
            }`}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center shrink-0 border border-indigo-500/10">
              <User size={18} className="text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[var(--text-primary)] truncate">{contact.name}</span>
                {contact.relationship_score > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-[var(--c-primary-soft)] text-[var(--c-primary)] font-medium shrink-0">
                    {contact.relationship_score}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                {contact.title} {contact.company ? `at ${contact.company}` : ''}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-2 flex items-center gap-1">
                {contact.status}
              </div>
            </div>
          </button>
        ))}
        {contacts.length === 0 && (
          <div className="p-8 text-center text-[var(--text-muted)] flex flex-col items-center gap-3">
            <Users size={32} className="opacity-20" />
            <p className="text-sm">No contacts found</p>
          </div>
        )}
      </div>
    </div>
  );
}
