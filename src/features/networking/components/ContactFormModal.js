import { useState } from 'react';
import Image from 'next/image';
import { brand } from '@/config/brand.config';
import { X, Upload, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useContacts } from '@/shared/hooks';

export default function ContactFormModal({ isOpen, onClose, onSave }) {
  const [mode, setMode] = useState('manual'); // 'manual' or 'csv'
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    title: '',
    company: '',
    location: '',
    industry: '',
    linkedin_url: '',
    status: 'Cold',
    relationship_score: 0
  });

  const { addContact } = useContacts();

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return toast.error('Name is required');
    
    setIsLoading(true);
    try {
      const newContact = await addContact(formData);
      toast.success('Contact created successfully');
      onSave(newContact);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] rounded-none w-full max-w-lg shadow-none overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
          <h2 className="text-xl font-semibold">Add Contact</h2>
          <button onClick={onClose} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-[var(--border-subtle)]">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'manual' ? 'text-[var(--c-primary)] border-b-2 border-[var(--c-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setMode('csv')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'csv' ? 'text-[var(--c-primary)] border-b-2 border-[var(--c-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            CSV Import
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {mode === 'manual' ? (
            <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Full Name *</label>
                  <input required name="name" value={formData.name} onChange={handleChange} className="input-base w-full" placeholder="Jane Doe" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-base w-full" placeholder="jane@example.com" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">LinkedIn URL</label>
                  <input type="url" name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} className="input-base w-full" placeholder="linkedin.com/in/..." />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Job Title</label>
                  <input name="title" value={formData.title} onChange={handleChange} className="input-base w-full" placeholder="e.g. Founder, Recruiter" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Company</label>
                  <input name="company" value={formData.company} onChange={handleChange} className="input-base w-full" placeholder="Company Name" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Location</label>
                  <input name="location" value={formData.location} onChange={handleChange} className="input-base w-full" placeholder="San Francisco, CA" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Industry</label>
                  <input name="industry" value={formData.industry} onChange={handleChange} className="input-base w-full" placeholder="e.g. B2B SaaS" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="input-base w-full appearance-none">
                    <option value="Cold">Cold</option>
                    <option value="Warm">Warm</option>
                    <option value="Meeting">Meeting Set</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6 flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-none bg-[var(--bg-elevated)] flex items-center justify-center border-2 border-[var(--border-strong)] text-[var(--c-primary)] shadow-none">
                <Upload size={28} />
              </div>
              <div className="text-center">
                <h3 className="font-medium text-[var(--text-primary)]">Upload CSV File</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1 max-w-xs">Upload a CSV containing Name, Email, Title, Company, and LinkedIn.</p>
              </div>
              
              <div className="w-full">
                <label className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-[var(--border-strong)] rounded-none hover:bg-[var(--bg-elevated)] hover:border-[var(--c-primary)] transition-colors cursor-pointer text-sm font-bold tracking-widest uppercase">
                  <Upload size={16} /> Choose File
                  <input type="file" accept=".csv" className="hidden" onChange={() => toast.success('CSV import simulated for now')} />
                </label>
              </div>
              
              <div className="w-full flex items-start gap-3 p-4 rounded-none bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs">
                  We automatically merge duplicates based on email address and LinkedIn URL to keep your CRM clean.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-between items-center">
          {/* Logo & Brand Name */}
          <div className="hidden sm:flex items-center gap-2.5 opacity-50 hover:opacity-100 transition-all duration-500 ease-out group cursor-pointer">
            <div className="relative group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 ease-out">
              <Image src={brand.logo.path} alt={brand.name} width={18} height={18} className="object-contain drop-shadow-md group-hover:drop-shadow-[0_0_8px_var(--c-primary)] transition-all duration-500" />
            </div>
            <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide group-hover:tracking-[0.2em] group-hover:text-[var(--c-primary)] transition-all duration-500">{brand.name}</span>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 font-bold uppercase tracking-widest text-sm rounded-none hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-strong)] transition-colors">
              Cancel
            </button>
            {mode === 'manual' && (
              <button form="contact-form" type="submit" disabled={isLoading} className="btn-primary">
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Save Contact
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
