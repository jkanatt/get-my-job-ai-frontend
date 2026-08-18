'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import ContactList from '@/features/networking/components/ContactList';
import ContactDetail from '@/features/networking/components/ContactDetail';
import ContactFormModal from '@/features/networking/components/ContactFormModal';

import { useContacts } from '@/shared/hooks';

export default function NetworkingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedContact, setSelectedContact] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Fetch from our new Database-backed API using Native Firebase Client SDK
  const { contacts, isLoading, mutate } = useContacts();

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen -mx-4 md:-mx-10 -my-8">
      {/* Mobile-only Header */}
      <div className="md:hidden p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
        <h1 className="text-xl font-bold">Networking CRM</h1>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Contact List Sidebar (Left) */}
        <div className={`w-full md:w-80 lg:w-96 shrink-0 h-full border-r border-[var(--border-subtle)] bg-[var(--bg-base)] ${selectedContact ? 'hidden md:block' : 'block'}`}>
          <ContactList 
            contacts={contacts} 
            selectedContactId={selectedContact?.id}
            onSelect={setSelectedContact}
            onAddClick={() => setIsAddModalOpen(true)}
          />
        </div>

        {/* Contact Detail View (Right) */}
        <div className={`flex-1 h-full bg-[var(--bg-surface)] ${selectedContact ? 'block' : 'hidden md:block'}`}>
          {selectedContact && (
            <div className="md:hidden p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
              <button 
                onClick={() => setSelectedContact(null)}
                className="text-sm font-medium text-[var(--c-primary)]"
              >
                ← Back to contacts
              </button>
            </div>
          )}
          
          {isLoading && !selectedContact ? (
            <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <ContactDetail contact={selectedContact} />
          )}
        </div>
      </div>

      <ContactFormModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSave={() => mutate()} 
      />
    </div>
  );
}
