'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CalendarIcon, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';

export function DateTimePicker({ 
  value, 
  onChange, 
  placeholder = "Select date & time",
  icon: Icon = CalendarIcon,
  className = "",
  name,
  mode = 'datetime' // 'datetime' | 'date'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('date');
  const containerRef = useRef(null);

  // Parse initial value or default to now
  const initialDate = value ? new Date(value) : new Date();
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);

  // Time state
  const [hours, setHours] = useState(value ? (initialDate.getHours() % 12 || 12).toString().padStart(2, '0') : "12");
  const [minutes, setMinutes] = useState(value ? initialDate.getMinutes().toString().padStart(2, '0') : "00");
  const [ampm, setAmpm] = useState(value ? (initialDate.getHours() >= 12 ? "PM" : "AM") : "PM");

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleDateSelect = (day) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    
    // Apply current time to new date
    let h = parseInt(hours, 10);
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    
    newDate.setHours(h);
    newDate.setMinutes(parseInt(minutes, 10));
    
    setSelectedDate(newDate);
    
    if (mode === 'date') {
      const localDate = newDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
      onChange({ target: { name, value: localDate } });
      setIsOpen(false);
      return;
    }
    
    // Construct local datetime string formatted for datetime-local (YYYY-MM-DDThh:mm)
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(newDate - tzoffset)).toISOString().slice(0, 16);
    
    onChange({ target: { name, value: localISOTime } });
  };

  const handleTimeChange = (type, val) => {
    let newHours = hours;
    let newMins = minutes;
    let newAmpm = ampm;

    if (type === 'h') { newHours = val; setHours(val); }
    if (type === 'm') { newMins = val; setMinutes(val); }
    if (type === 'ampm') { newAmpm = val; setAmpm(val); }

    if (selectedDate) {
      const updatedDate = new Date(selectedDate);
      let h = parseInt(newHours, 10);
      if (newAmpm === "PM" && h < 12) h += 12;
      if (newAmpm === "AM" && h === 12) h = 0;
      
      updatedDate.setHours(h);
      updatedDate.setMinutes(parseInt(newMins, 10));
      setSelectedDate(updatedDate);

      const tzoffset = (new Date()).getTimezoneOffset() * 60000;
      const localISOTime = (new Date(updatedDate - tzoffset)).toISOString().slice(0, 16);
      onChange({ target: { name, value: localISOTime } });
    }
  };

  const formatDisplay = () => {
    if (!selectedDate) return "";
    if (mode === 'date') {
      return selectedDate.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric'
      });
    }
    return selectedDate.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className={`relative group ${isOpen ? 'z-50' : 'z-10'}`} ref={containerRef}>
      {/* Input Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 bg-[var(--bg-input)] border )] )] focus:outline-none py-3.5 px-4 rounded-none cursor-pointer text-left shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] ${isOpen ? 'border-[var(--text-primary)] ring-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]' : 'border-[var(--border-strong)] hover:border-[var(--text-muted)]'} ${className} focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300`}
      >
        <Icon size={16} className={`shrink-0 transition-colors pointer-events-none ${isOpen ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`} />
        <span className={`text-[14px] font-bold tracking-wide flex-1 leading-none ${!formatDisplay() ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
          {formatDisplay() || placeholder}
        </span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[320px] flex flex-col bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] shadow-none z-50 p-0 rounded-none animate-in fade-in zoom-in-95 duration-200">
          
          {/* Tabs */}
          {mode === 'datetime' && (
            <div className="flex border-b border-[var(--border-strong)]">
              <button 
                type="button"
                onClick={() => setActiveTab('date')}
                className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors ${activeTab === 'date' ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]'}`}
              >
                Date
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('time')}
                className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors ${activeTab === 'time' ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]'}`}
              >
                Time
              </button>
            </div>
          )}

          <div className="p-5">
            {activeTab === 'date' ? (
              /* Calendar View */
              <div className="animate-in fade-in duration-200">
                <div className="flex justify-between items-center mb-4 border-b border-[var(--border-strong)] pb-4">
                  <button 
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-8 h-8 flex items-center justify-center border border-[var(--border-strong)] bg-[var(--bg-base)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-base)] transition-colors rounded-none"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-[12px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                    {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </span>
                  <button 
                    type="button"
                    onClick={handleNextMonth}
                    className="w-8 h-8 flex items-center justify-center border border-[var(--border-strong)] bg-[var(--bg-base)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-base)] transition-colors rounded-none"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                  {DAYS.map(d => (
                    <div key={d} className="text-[10px] font-bold uppercase text-[var(--text-secondary)] py-1">
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = selectedDate && 
                                       selectedDate.getDate() === day && 
                                       selectedDate.getMonth() === currentDate.getMonth() &&
                                       selectedDate.getFullYear() === currentDate.getFullYear();
                    
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          handleDateSelect(day);
                          if (mode === 'datetime') setActiveTab('time');
                        }}
                        className={`
                          w-8 h-8 text-[12px] font-bold rounded-none flex items-center justify-center mx-auto transition-all border
                          ${isSelected 
                            ? 'bg-[var(--text-primary)] text-[var(--bg-base)] border-[var(--text-primary)] scale-110 shadow-none dark:shadow-none' 
                            : 'bg-[var(--bg-base)] border-transparent hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          }
                        `}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Time View */
              <div className="animate-in fade-in duration-200 flex flex-col h-[260px]">
                <div className="flex flex-col gap-6 flex-1 justify-center">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block text-center">Hour</label>
                      <input 
                        type="text"
                        maxLength={2}
                        value={hours}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 12)) {
                             handleTimeChange('h', val);
                          }
                        }}
                        onBlur={() => {
                          if (!hours) handleTimeChange('h', '12');
                          else handleTimeChange('h', hours.padStart(2, '0'));
                        }}
                        className="w-full bg-[var(--bg-input)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] border border-[var(--border-strong)] text-[24px] font-black p-4 outline-none )] )] rounded-none text-center placeholder-[var(--text-muted)] hover:border-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                      />
                    </div>
                    
                    <div className="flex flex-col justify-end pb-4">
                      <span className="text-2xl font-black text-[var(--text-secondary)]">:</span>
                    </div>

                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block text-center">Min</label>
                      <input 
                        type="text"
                        maxLength={2}
                        value={minutes}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val === '' || parseInt(val) <= 59) {
                            handleTimeChange('m', val);
                          }
                        }}
                        onBlur={() => {
                          if (!minutes) handleTimeChange('m', '00');
                          else handleTimeChange('m', minutes.padStart(2, '0'));
                        }}
                        className="w-full bg-[var(--bg-input)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] border border-[var(--border-strong)] text-[24px] font-black p-4 outline-none )] )] rounded-none text-center placeholder-[var(--text-muted)] hover:border-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                      />
                    </div>
                  </div>

                  <div className="flex border border-[var(--border-strong)] rounded-none overflow-hidden mt-4">
                    <button 
                      type="button"
                      onClick={() => handleTimeChange('ampm', 'AM')}
                      className={`flex-1 py-4 text-[13px] font-black uppercase tracking-widest transition-colors ${ampm === 'AM' ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'}`}
                    >
                      AM
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleTimeChange('ampm', 'PM')}
                      className={`flex-1 py-4 text-[13px] font-black uppercase tracking-widest transition-colors ${ampm === 'PM' ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'}`}
                    >
                      PM
                    </button>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full py-3 mt-2 border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--text-primary)] hover:text-[var(--bg-base)] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
