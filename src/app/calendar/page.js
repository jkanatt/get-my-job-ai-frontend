'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Link as LinkIcon, Video, User, Building2, ExternalLink, Clock, Loader2, MapPin, Search } from 'lucide-react';
import EventModal from '@/features/calendar/components/EventModal';
import EventDetailModal from '@/features/calendar/components/EventDetailModal';
import { CalendarGridSkeleton } from '@/shared/design-system/components/Skeletons';

import { useCalendar } from '@/shared/hooks';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch from the new Database-backed API using Native Firebase Client SDK
  const { events, isLoading, mutate } = useCalendar();

  // Generate calendar grid
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  // Filter events based on searchTerm
  const filteredEvents = events.filter(e => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (e.title || '').toLowerCase().includes(term) ||
      (e.description || '').toLowerCase().includes(term) ||
      (e.company || '').toLowerCase().includes(term)
    );
  });

  // Group events by date string "YYYY-MM-DD"
  const eventsByDate = {};
  filteredEvents.forEach(event => {
    if (!event.start_time) return;
    const dateObj = new Date(event.start_time);
    const dateStr = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
    if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
    eventsByDate[dateStr].push(event);
  });

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Filter for upcoming sidebar
  const upcomingEvents = filteredEvents
    .filter(e => new Date(e.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 pb-8 border-b border-[var(--border-subtle)] relative mb-8">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-transparent blur-3xl -z-10" />
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-none bg-gradient-to-b from-blue-500/20 to-blue-600/5 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-400/20 blur-xl opacity-50" />
            <CalendarIcon size={26} className="text-blue-400 relative z-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="h1">Calendar</h1>
            <p className="body-text">Manage interviews, meetings, and follow-ups</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input 
              type="text" 
              placeholder="Search keywords..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--c-primary)] outline-none rounded-none text-[13px] w-64 transition-all placeholder:text-[var(--text-muted)]"
            />
          </div>
          <button onClick={() => alert('Google Calendar connection in Phase 8')} className="btn btn-outline gap-2">
            <ExternalLink size={14} /> Sync Google Calendar
          </button>
          <button onClick={() => setShowAddEvent(true)} className="btn btn-primary gap-2">
            <Plus size={14} /> New Event
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-none overflow-hidden shadow-sm">
              <CalendarGridSkeleton />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] rounded-none overflow-hidden animate-in slide-in-from-bottom-2 duration-500">
              {/* Calendar Header */}
              <div className="flex items-center justify-between p-6 border-b-2 border-[var(--border-strong)] bg-[var(--text-primary)]">
                <h2 className="text-xl font-black text-[var(--bg-base)] uppercase tracking-widest">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="btn btn-icon !bg-[var(--bg-base)] !text-[var(--text-primary)] !border-[var(--text-primary)] hover:!bg-[var(--bg-elevated)]">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setCurrentDate(new Date())} className="btn !bg-[var(--bg-base)] !text-[var(--text-primary)] !border-[var(--text-primary)] hover:!bg-[var(--bg-elevated)]">
                    Today
                  </button>
                  <button onClick={nextMonth} className="btn btn-icon !bg-[var(--bg-base)] !text-[var(--text-primary)] !border-[var(--text-primary)] hover:!bg-[var(--bg-elevated)]">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-3 text-center text-sm font-medium text-[var(--text-muted)]">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 auto-rows-[120px] bg-[var(--border-subtle)] gap-[1px]">
                {blanks.map(blank => (
                  <div key={`blank-${blank}`} className="bg-[var(--bg-surface)] p-2 opacity-50" />
                ))}
                {days.map(day => {
                  const dateStr = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`;
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

                  return (
                    <div key={day} className={`bg-[var(--bg-surface)] p-2 hover:bg-[var(--bg-hover)] transition-all duration-300 relative group animate-in fade-in zoom-in-95 fill-mode-both ${isToday ? 'z-10' : ''}`} style={{ animationDelay: `${day * 15}ms` }}>
                      <div className="mb-2">
                        <div className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-none transition-all ${isToday ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] group-hover:bg-[var(--bg-elevated)]'}`}>
                          {day}
                        </div>
                      </div>
                      <div className="space-y-1 overflow-y-auto max-h-[70px] hide-scrollbar">
                        {dayEvents.map((event, i) => {
                          const dateObj = new Date(event.start_time);
                          const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <button
                              key={i}
                              onClick={() => setSelectedEvent(event)}
                              className="w-full text-left text-xs p-1.5 rounded-none bg-[var(--c-primary-soft)] text-[var(--c-primary)] font-medium truncate hover:brightness-110 transition-all cursor-pointer hover:translate-x-1"
                            >
                              {timeString} - {event.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-none border border-[var(--border-strong)] bg-[var(--bg-surface)] sticky top-6">
              <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between">
                <h3 className="font-bold text-sm tracking-wide uppercase flex items-center gap-2 text-[var(--text-primary)]">
                  <Clock size={14} className="text-[var(--c-primary)]" />
                  Upcoming
                </h3>
              </div>
              
              <div className="flex flex-col">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event, i) => (
                    <div key={i} onClick={() => setSelectedEvent(event)} className="p-4 border-b last:border-b-0 border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-all duration-300 cursor-pointer group flex flex-col gap-2">
                      <div className="font-bold text-[var(--text-primary)] group-hover:text-[var(--c-primary)] transition-colors">{event.title}</div>
                      <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                        <span className="font-mono bg-[var(--bg-elevated)] text-[var(--text-primary)] px-1.5 py-0.5 border border-[var(--border-subtle)]">
                          {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>
                          {new Date(event.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1">
                        {event.meeting_url && <span className="text-[10px] uppercase tracking-widest font-black text-blue-400 flex items-center gap-1"><Video size={10} /> Virtual</span>}
                        {event.location && <span className="text-[10px] uppercase tracking-widest font-black text-amber-500 flex items-center gap-1"><MapPin size={10} /> In-person</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-none">
                      <Clock size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">No events today</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail view when clicking an existing event */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* Add new event form */}
      <EventModal
        isOpen={showAddEvent}
        onClose={() => setShowAddEvent(false)}
      />
    </div>
  );
}
