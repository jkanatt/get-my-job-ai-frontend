import { useState } from 'react';
import { Mail, Linkedin, MapPin, Building, Calendar, Edit2, Trash2, Clock, CheckCircle2, ChevronRight, Users } from 'lucide-react';
import { useCompose } from '@/app/context/ComposeContext';
import { toast } from 'sonner';

export default function ContactDetail({ contact, onClose }) {
  const { openCompose } = useCompose();
  const [activeTab, setActiveTab] = useState('timeline');

  if (!contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] bg-[var(--bg-base)]">
        <Users size={48} className="opacity-10 mb-4" />
        <p>Select a contact to view details</p>
      </div>
    );
  }

  const handleOutreach = () => {
    openCompose({
      to: contact.email || '',
      subject: `Connecting - ${contact.company || 'your company'}`,
      body: `Hi ${(contact.name || 'there').split(' ')[0]},<br><br>I saw the incredible work you are doing at ${contact.company || 'your company'} in the ${contact.industry || 'tech'} space...`
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-surface)] overflow-hidden">
      {/* Header Profile Info */}
      <div className="p-8 border-b border-[var(--border-subtle)] relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--c-primary)]/5 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-none bg-[var(--bg-elevated)] flex items-center justify-center border border-indigo-500/30 shadow-none">
              <span className="text-2xl font-bold text-indigo-400">
                {contact.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{contact.name}</h1>
              <div className="flex items-center gap-2 mt-1 text-[var(--text-secondary)]">
                <span className="font-medium">{contact.title}</span>
                {contact.company && (
                  <>
                    <span className="w-1 h-1 rounded-none bg-[var(--border-strong)]" />
                    <span className="flex items-center gap-1">
                      <Building size={14} /> {contact.company}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm text-[var(--text-muted)]">
                {contact.location && (
                  <span className="flex items-center gap-1.5"><MapPin size={14} /> {contact.location}</span>
                )}
                {contact.email && (
                  <span className="flex items-center gap-1.5"><Mail size={14} /> {contact.email}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={handleOutreach} className="btn-primary">
              <Mail size={16} /> Email
            </button>
            <button onClick={() => toast.info('Edit contact feature coming soon')} className="p-2 border border-[var(--border-strong)] rounded-none hover:bg-[var(--bg-elevated)] hover:border-[var(--text-primary)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-none hover:shadow-[2px_2px_0_0_var(--text-primary)]">
              <Edit2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-8 border-b border-[var(--border-subtle)] shrink-0">
        {['timeline', 'notes', 'about'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab 
                ? 'border-[var(--c-primary)] text-[var(--text-primary)]' 
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'timeline' && (
          <div className="space-y-6 max-w-2xl">
            <div className="relative pl-6 border-l-2 border-[var(--border-subtle)] space-y-8">
              {/* Fake interactions for UI, soon fetched from DB */}
              <div className="relative">
                <div className="absolute -left-[31px] bg-[var(--bg-surface)] p-1 rounded-none">
                  <div className="w-3 h-3 rounded-none bg-[var(--c-primary)] ring-2 ring-[var(--c-primary-soft)]" />
                </div>
                <div className="text-xs text-[var(--text-muted)] mb-1 font-mono uppercase tracking-wider">Today, 2:40 PM</div>
                <div className="p-4 rounded-none border border-[var(--border-strong)] bg-[var(--bg-base)]">
                  <p className="text-sm">Added to CRM</p>
                </div>
              </div>
              
              {contact.next_followup_at && (
                <div className="relative">
                  <div className="absolute -left-[31px] bg-[var(--bg-surface)] p-1 rounded-none">
                    <div className="w-3 h-3 rounded-none bg-[var(--c-warning)] ring-2 ring-[var(--c-warning)]/20" />
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mb-1 font-mono uppercase tracking-wider">Upcoming</div>
                  <div className="p-4 rounded-none border border-[var(--c-warning)]/50 bg-[var(--c-warning)]/5 text-[var(--c-warning)] text-sm flex items-center gap-2 shadow-none">
                    <Clock size={16} /> Follow-up Reminder Scheduled
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'notes' && (
          <div className="max-w-2xl">
            <textarea 
              className="w-full h-40 bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-none p-4 text-sm )] outline-none resize-none focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
              placeholder="Add notes about this contact..."
              defaultValue={contact.notes || ''}
            />
            <div className="flex justify-end mt-4">
              <button className="btn-primary" onClick={() => toast.success('Notes saved')}>Save Notes</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
