import { useState } from 'react';
import Image from 'next/image';
import { Triangle, X, Calendar as CalendarIcon, Clock, Link as LinkIcon, MapPin, AlignLeft, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCalendar } from '@/shared/hooks';
import { DateTimePicker } from '@/shared/design-system/components/DateTimePicker';
import { Button } from '@/shared/design-system/components';
import { brand } from '@/config/brand.config';

export default function EventModal({ isOpen, onClose, initialData = null, onSave }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addEvent, deleteEvent } = useCalendar();
  const [formData, setFormData] = useState(() => ({
    title: initialData?.title || '',
    description: initialData?.description || '',
    start_time: initialData?.start_time ? new Date(initialData.start_time).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    end_time: initialData?.end_time ? new Date(initialData.end_time).toISOString().slice(0, 16) : new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    location: initialData?.location || '',
    meeting_url: initialData?.meeting_url || '',
    event_type: initialData?.event_type || 'interview',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }));

  if (!isOpen) return null;

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) return toast.error('Event title is required');
    
    setIsLoading(true);
    try {
      // Assuming initialData with ID implies an update, otherwise create.
      // We only built POST/DELETE in API so far, but we can add PUT later if needed.
      // For now, let's just do POST.
      await addEvent(formData);
      
      toast.success('Event saved successfully');
      if (onSave) onSave();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    setIsDeleting(true);
    try {
      await deleteEvent(initialData.id);
      toast.success('Event deleted');
      onClose();
    } catch(err) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 py-12 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto custom-scrollbar">
      <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] rounded-none w-full max-w-2xl shadow-none animate-in zoom-in-95 duration-200 flex flex-col my-auto">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-3">
             <div className="w-6 h-6 bg-[var(--text-primary)] text-[var(--bg-base)] flex items-center justify-center rounded-none shadow-none">
               <Triangle size={10} fill="currentColor" className="rotate-180" />
             </div>
             <span className="font-bold tracking-widest uppercase text-[10px] text-[var(--text-primary)]">{brand.name}</span>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Modal Header */}
        <div className="px-8 pt-8 pb-6 border-b border-[var(--border-subtle)]">
          <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] uppercase">
            {initialData ? 'Edit Event' : 'New Event'}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-2 font-medium">
             Schedule an interview, meeting, or reminder.
          </p>
        </div>

        <div className="px-8 py-8 flex-1 overflow-visible">
          <form id="event-form" onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Event Title</label>
              <input required name="title" value={formData.title} onChange={handleChange} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] )] )] outline-none py-3 px-4 text-sm font-semibold rounded-none placeholder-[var(--text-muted)] hover:border-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" placeholder="e.g. Interview with Acme Corp" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Starts</label>
                <DateTimePicker 
                  name="start_time" 
                  value={formData.start_time} 
                  onChange={handleChange} 
                  icon={CalendarIcon}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Ends</label>
                <DateTimePicker 
                  name="end_time" 
                  value={formData.end_time} 
                  onChange={handleChange} 
                  icon={Clock}
                />
              </div>
            </div>

            <div className="space-y-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Meeting Link</label>
                 <div className="relative group">
                   <LinkIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--text-primary)] transition-colors pointer-events-none" />
                   <input type="url" name="meeting_url" value={formData.meeting_url} onChange={handleChange} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] )] )] outline-none py-3 pl-10 pr-3 text-sm font-medium rounded-none placeholder-[var(--text-muted)] hover:border-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" placeholder="https://zoom.us/j/..." />
                 </div>
               </div>
            </div>
            
            <div className="space-y-2 flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Description / Notes</label>
              <div className="relative group flex-1">
                <AlignLeft size={14} className="absolute left-4 top-4 text-[var(--text-secondary)] group-focus-within:text-[var(--text-primary)] transition-colors pointer-events-none" />
                <textarea name="description" value={formData.description} onChange={handleChange} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] )] )] outline-none p-3 pl-10 min-h-[120px] resize-none text-sm font-medium rounded-none placeholder-[var(--text-muted)] hover:border-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" placeholder="Add preparation notes or agenda..." />
              </div>
            </div>
          </form>
        </div>

        <div className="px-8 py-6 border-t border-[var(--border-strong)] bg-[var(--bg-elevated)] flex justify-between items-center">
          <div className="flex items-center gap-6">
            {/* Logo & Brand Name */}
            <div className="hidden sm:flex items-center gap-2.5 opacity-50 hover:opacity-100 transition-all duration-500 ease-out group cursor-pointer">
              <div className="relative group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 ease-out">
                <Image src={brand.logo.path} alt={brand.name} width={18} height={18} className="object-contain drop-shadow-md group-hover:drop-shadow-[0_0_8px_var(--c-primary)] transition-all duration-500" />
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide group-hover:tracking-[0.2em] group-hover:text-[var(--c-primary)] transition-all duration-500">{brand.name}</span>
            </div>

             {initialData?.id && (
               <button onClick={handleDelete} disabled={isDeleting} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors flex items-center gap-2">
                 {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                 Delete Event
               </button>
             )}
          </div>
          <div className="flex items-center gap-6">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="event-form" disabled={isLoading} className="px-8">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Save Event'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
