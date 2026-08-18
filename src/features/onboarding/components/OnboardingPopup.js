'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { User, Briefcase, IndianRupee, ArrowRight, ArrowLeft, Check, Search, CheckCircle2, AlertCircle, Sparkles, Building2, Globe2, Upload, FileText, ClipboardList, Loader2, X } from 'lucide-react';
import { useProfile, useSettings } from '@/shared/hooks';
import { toast } from 'sonner';
import { brand } from '@/config/brand.config';

import { ROLES as ROLE_OPTIONS } from '@/shared/data/roles';

import { INDUSTRIES as INDUSTRY_OPTIONS } from '@/shared/data/industries';
import { LOCATIONS as LOCATION_OPTIONS } from '@/shared/data/locations';

const EXP_OPTIONS = [
  'Fresher (0 Years)', '0-1 Years', '1-2 Years', '2-3 Years', '3-5 Years', '5-8 Years', '8-12 Years', '12-15 Years', '15+ Years'
];

const NOTICE_OPTIONS = [
  'Immediate Joiner', '15 Days', '30 Days', '45 Days', '60 Days', '90 Days'
];

const WORK_MODE_OPTIONS = ['Remote', 'Hybrid', 'On-site', 'Willing to Relocate'];

const CTC_OPTIONS = [
  'Less than 3 LPA', '3 - 5 LPA', '5 - 8 LPA', '8 - 12 LPA', '12 - 15 LPA', 
  '15 - 20 LPA', '20 - 25 LPA', '25 - 30 LPA', '30 - 35 LPA', '35 - 40 LPA', 
  '40 - 50 LPA', '50 - 60 LPA', '60 - 70 LPA', '70 - 80 LPA', '80 - 90 LPA', 
  '90 LPA - 1 Cr', '1 - 1.5 Cr', '1.5 - 2 Cr', '2 - 2.5 Cr', '2.5 - 3 Cr', 
  '3 - 4 Cr', '4 - 5 Cr', '5 Cr+'
];

function Combobox({ options, value, onChange, placeholder, icon: Icon, required, isMissing, multiple = false, maxItems }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  const filteredOptions = useMemo(() => {
    let res = options;
    if (search) {
      res = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    }
    return res.slice(0, 100); // Cap at 100 to maintain performance with huge datasets (1000+ items)
  }, [search, options]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        className={`w-full min-h-[24px] bg-transparent transition-all flex items-center cursor-pointer outline-none ${isMissing ? 'text-red-400' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {Icon && <Icon className="w-4 h-4 text-neutral-500 mr-3 shrink-0" />}
        <span className={`flex-1 flex gap-2 flex-wrap items-center text-base ${(!multiple && !value) || (multiple && (!value || value.length === 0)) ? 'text-neutral-600' : 'text-white'}`}>
          {multiple ? (
            value && value.length > 0 ? (
              value.map(val => (
                <span key={val} className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded-none text-xs flex items-center gap-1.5 text-neutral-200">
                  <span className="truncate max-w-[150px]">{val}</span>
                  <button onClick={(e) => { e.stopPropagation(); onChange(value.filter(v => v !== val)); }} className="hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="truncate">{placeholder}</span>
            )
          ) : (
            <span className="truncate">{value || placeholder}</span>
          )}
        </span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -5, height: 0 }}
            className="absolute z-50 w-[calc(100%+32px)] -ml-4 mt-4 bg-[#0A0A0A] border border-neutral-800 shadow-2xl overflow-hidden rounded-none"
          >
            <div className="p-2 border-b border-neutral-800 flex items-center gap-2 bg-[#050505]">
              <Search className="w-4 h-4 text-neutral-500" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-white text-sm outline-none placeholder:text-neutral-600"
              />
            </div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500 text-center">No matching options found.</div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = multiple ? (value && value.includes(opt)) : value === opt;
                  return (
                    <div
                      key={opt}
                      onClick={() => {
                        if (multiple) {
                          const currentVal = Array.isArray(value) ? value : [];
                          if (currentVal.includes(opt)) {
                            onChange(currentVal.filter(v => v !== opt));
                          } else {
                            if (maxItems && currentVal.length >= maxItems) {
                              toast.error(`Maximum ${maxItems} options allowed`);
                              return;
                            }
                            onChange([...currentVal, opt]);
                          }
                        } else {
                          onChange(opt);
                          setIsOpen(false);
                          setSearch('');
                        }
                      }}
                      className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between hover:bg-neutral-800/50 transition-colors ${
                        isSelected ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-300'
                      }`}
                    >
                      <span>{opt}</span>
                      {isSelected && <Check className="w-4 h-4" />}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function OnboardingPopup({ isOpen: propIsOpen = null, onClose = null, onComplete = null, isBlockerMode = false }) {
  const { profile, updateProfile, isLoading: isProfileLoading, missingFields = [] } = useProfile();
  const { settings, updateSettings, isLoading: isSettingsLoading } = useSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('manual'); // 'upload', 'latex', 'paste', 'manual'
  
  // AI Parsing State
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState('');
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    linkedin: '',
    portfolio: '',
    target_role: '',
    industry: [],
    company: '',
    experience_years: '',
    work_mode: [],
    preferred_location: [],
    notice_period: '',
    current_ctc: '',
    expected_ctc: '',
    is_negotiable: true,
    // Extra fields to catch array data from AI parser
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    awards: [],
    languages: [],
    hobbies: [],
    github: '',
    summary: '',
    title: '',
  });

  // Highlight missing fields if any
  const isFieldMissing = (fieldGroup) => {
    return missingFields.includes(fieldGroup);
  };

  useEffect(() => {
    if (propIsOpen !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(propIsOpen);
    } else if (!isSettingsLoading && settings) {
      if (settings.is_onboarded === false) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsOpen(true);
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsOpen(false);
      }
    }
  }, [settings, isSettingsLoading, propIsOpen]);

  // Pre-fill if profile has existing data
  useEffect(() => {
    if (profile && isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({
        ...prev,
        name: profile.name || prev.name,
        phone: profile.phone || prev.phone,
        email: profile.email || prev.email,
        linkedin: profile.linkedin || prev.linkedin,
        portfolio: profile.portfolio || prev.portfolio,
        target_role: profile.target_role || profile.title || prev.target_role,
        industry: Array.isArray(profile.industry) ? profile.industry : (profile.industry ? profile.industry.split(',').map(s=>s.trim()) : prev.industry),
        company: profile.company || prev.company,
        experience_years: profile.experience_years || prev.experience_years,
        preferred_location: Array.isArray(profile.preferred_location) ? profile.preferred_location : (profile.preferred_location ? profile.preferred_location.split(',').map(s=>s.trim()) : prev.preferred_location),
        notice_period: profile.notice_period || prev.notice_period,
        current_ctc: profile.current_ctc || prev.current_ctc,
        expected_ctc: (profile.expected_ctc || prev.expected_ctc || '').replace(' (Negotiable)', ''),
        is_negotiable: profile.expected_ctc ? profile.expected_ctc.includes('Negotiable') : true,
        experience: profile.experience || prev.experience,
        education: profile.education || prev.education,
        skills: profile.skills || prev.skills,
        projects: profile.projects || prev.projects,
        certifications: profile.certifications || prev.certifications,
        awards: profile.awards || prev.awards,
        languages: profile.languages || prev.languages,
        hobbies: profile.hobbies || prev.hobbies,
        github: profile.github || prev.github,
        summary: profile.summary || prev.summary,
        title: profile.title || prev.title,
      }));
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    if (onClose) onClose();
    else setIsOpen(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsParsing(true);
    setParseStatus('Extracting Document Text...');
    
    try {
      const data = new FormData();
      data.append('file', file);
      
      const res = await fetch('/api/ai/parse-resume', {
        method: 'POST',
        body: data
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to parse resume');
      
      setParseStatus('Applying Extracted Data...');
      applyParsedData(result);
      setActiveTab('manual');
      toast.success('Resume parsed successfully! Please review the extracted data.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error parsing resume');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTextPasteParse = async () => {
    if (!pastedText.trim()) return;
    
    setIsParsing(true);
    setParseStatus('Analyzing Text Content...');
    
    try {
      const blob = new Blob([pastedText], { type: 'text/plain' });
      const file = new File([blob], 'pasted_resume.txt', { type: 'text/plain' });
      const data = new FormData();
      data.append('file', file);
      
      const res = await fetch('/api/ai/parse-resume', {
        method: 'POST',
        body: data
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to parse text');
      
      setParseStatus('Applying Extracted Data...');
      applyParsedData(result);
      setActiveTab('manual');
      toast.success('Text parsed successfully! Please review the extracted data.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error parsing text');
    } finally {
      setIsParsing(false);
    }
  };

  const applyParsedData = (data) => {
    // Attempt to map years string/number to the closest EXP_OPTIONS
    let mappedExp = '';
    if (data.experience_years !== undefined) {
      const y = parseInt(data.experience_years);
      if (!isNaN(y)) {
        if (y === 0) mappedExp = 'Fresher (0 Years)';
        else if (y <= 1) mappedExp = '0-1 Years';
        else if (y <= 2) mappedExp = '1-2 Years';
        else if (y <= 3) mappedExp = '2-3 Years';
        else if (y <= 5) mappedExp = '3-5 Years';
        else if (y <= 8) mappedExp = '5-8 Years';
        else if (y <= 12) mappedExp = '8-12 Years';
        else if (y <= 15) mappedExp = '12-15 Years';
        else mappedExp = '15+ Years';
      }
    }

    setFormData(prev => ({
      ...prev,
      name: (data.first_name || data.last_name) ? `${data.first_name || ''} ${data.last_name || ''}`.trim() : (data.name || prev.name),
      email: data.email || prev.email,
      phone: data.phone || prev.phone,
      linkedin: data.linkedin || prev.linkedin,
      portfolio: data.portfolio || prev.portfolio,
      github: data.github || prev.github,
      target_role: data.title || data.role || data.target_role || prev.target_role,
      title: data.title || prev.title,
      summary: data.summary || prev.summary,
      company: data.company || data.current_company || prev.company,
      preferred_location: data.location || prev.preferred_location,
      experience_years: mappedExp || prev.experience_years,
      experience: data.experience || prev.experience,
      education: data.education || prev.education,
      skills: data.skills || prev.skills,
      projects: data.projects || prev.projects,
      certifications: data.certifications || prev.certifications,
      awards: data.awards || prev.awards,
      languages: data.languages || prev.languages,
      hobbies: data.hobbies || prev.hobbies,
    }));
  };

  const handleComplete = async () => {
    // Basic validation
    if (!formData.name || !formData.email || !formData.target_role) {
      toast.error('Name, Email, and Primary Role are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Structure the data to match expected profile schema
      const parts = formData.name.trim().split(' ');
      const first_name = parts[0] || '';
      const last_name = parts.slice(1).join(' ') || '';

      await updateProfile({
        name: formData.name,
        first_name,
        last_name,
        phone: formData.phone,
        email: formData.email,
        linkedin: formData.linkedin,
        portfolio: formData.portfolio,
        github: formData.github,
        target_role: formData.target_role,
        title: formData.title || formData.target_role, // Use parsed title or fallback to target_role
        summary: formData.summary,
        industry: formData.industry,
        company: formData.company,
        experience_years: formData.experience_years,
        work_mode: formData.work_mode,
        preferred_location: formData.preferred_location,
        notice_period: formData.notice_period,
        current_ctc: formData.current_ctc,
        expected_ctc: formData.expected_ctc,
        is_negotiable: formData.is_negotiable,
        experience: formData.experience,
        education: formData.education,
        skills: formData.skills,
        projects: formData.projects,
        certifications: formData.certifications,
        awards: formData.awards,
        languages: formData.languages,
        hobbies: formData.hobbies,
        // Enforce visibility flags
        show_ctc_in_emails: true,
        show_notice_period: true,
      });

      await updateSettings({ is_onboarded: true });
      toast.success('Profile saved successfully.');
      if (onComplete) onComplete();
      else handleClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save profile data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-6 sm:p-8 overflow-hidden bg-black/95">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-4xl h-[85vh] min-h-[600px] max-h-[900px] overflow-hidden bg-neutral-950 border border-neutral-800 shadow-2xl shadow-black flex flex-col rounded-none"
      >
        {/* Header */}
        <div className="flex-none p-6 md:p-8 border-b border-neutral-800 flex items-center justify-between bg-neutral-950 sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                {isBlockerMode ? 'Profile Completion Required' : `Welcome to ${brand.name}`}
              </h2>
            </div>
            <p className="text-sm text-neutral-400">
              {isBlockerMode 
                ? 'You must complete your profile before applying for this job.' 
                : 'We just need to know you a little better!'}
            </p>
          </div>
          {onClose && (
            <button onClick={handleClose} className="p-2 text-neutral-400 hover:text-white rounded-none hover:bg-neutral-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex-none px-6 md:px-8 border-b border-neutral-800 bg-[#0A0A0A] flex gap-6 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'manual' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >
            Review & Edit Data
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'upload' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >
            <Upload className="w-4 h-4" /> AI Resume Import
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'paste' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >
            <ClipboardList className="w-4 h-4" /> Paste Text (Obsidian / LaTeX)
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-neutral-950/50">
          <AnimatePresence mode="wait">
            
            {/* ── AI IMPORT TABS ── */}
            {activeTab === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-12 px-4">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.tex,.txt,.md"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div 
                  onClick={() => !isParsing && fileInputRef.current?.click()}
                  className={`relative w-full max-w-2xl group p-12 md:p-16 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden bg-[#050505] border border-neutral-800 hover:border-blue-500/40 ${isParsing ? 'cursor-wait' : ''}`}
                >
                  
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-6 relative z-10">
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                        <Loader2 className="w-14 h-14 text-blue-500 animate-spin relative z-10" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-white font-bold text-lg tracking-wide">{parseStatus}</p>
                        <p className="text-xs text-blue-400/80 font-medium uppercase tracking-widest animate-pulse">Applying AI Models...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center relative z-10">
                      <div className="w-20 h-20 mb-8 bg-[#0A0A0A] border border-neutral-800 flex items-center justify-center group-hover:scale-110 group-hover:border-blue-500/40 transition-all duration-500">
                        <Upload className="w-8 h-8 text-neutral-400 group-hover:text-blue-400 transition-colors duration-500" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3 tracking-tight group-hover:text-blue-50 transition-colors">Upload Resume File</h3>
                      <p className="text-sm text-neutral-500 text-center max-w-md mb-10 leading-relaxed">
                        Drag and drop your document here, or click to browse. We support <span className="text-neutral-300 font-medium">PDF, DOCX, LaTeX (.tex), and TXT</span>.
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400 group-hover:text-blue-400 transition-colors">
                        <span>Browse Files</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'paste' && (
              <motion.div key="paste" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full py-4 px-4 md:px-0">
                <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full group relative">
                  
                  <div className="relative flex flex-col flex-1 bg-[#050505] border border-neutral-800 group-focus-within:border-blue-500/40 transition-colors duration-500 z-10 overflow-hidden">
                    
                    {/* Header Bar */}
                    <div className="px-6 py-4 border-b border-neutral-800/50 bg-[#0A0A0A] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ClipboardList className="w-5 h-5 text-neutral-500 group-focus-within:text-blue-400 transition-colors" />
                        <h3 className="text-sm font-bold text-white tracking-wide">Raw Text Input</h3>
                      </div>
                      <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-widest hidden md:block">Markdown / LaTeX / Text</p>
                    </div>
                    
                    <div className="relative flex-1 flex flex-col">
                      <textarea
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        disabled={isParsing}
                        placeholder="Paste your raw content from Obsidian, Notion, or your code editor here..."
                        className="w-full flex-1 min-h-[350px] bg-transparent p-6 text-sm text-neutral-300 focus:text-white focus:outline-none transition-colors custom-scrollbar resize-none disabled:opacity-50 placeholder:text-neutral-700 leading-relaxed font-mono"
                      />
                      
                      {isParsing && (
                        <div className="absolute inset-0 bg-[#050505]/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                           <div className="relative mb-4">
                             <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                             <Loader2 className="w-10 h-10 text-blue-500 animate-spin relative z-10" />
                           </div>
                           <p className="text-white font-bold tracking-wide">{parseStatus}</p>
                           <p className="text-xs text-blue-400/80 font-medium uppercase tracking-widest mt-2 animate-pulse">Running AI Extraction</p>
                        </div>
                      )}
                    </div>

                    {/* Footer / Action Bar */}
                    <div className="px-6 py-4 border-t border-neutral-800/50 bg-[#0A0A0A] flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
                        The AI will automatically extract and structure your experience, education, and skills.
                      </p>
                      <button
                        onClick={handleTextPasteParse}
                        disabled={!pastedText.trim() || isParsing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:hover:bg-white"
                      >
                         {isParsing ? (
                           <>Extracting...</>
                         ) : (
                           <><Sparkles className="w-4 h-4" /> Extract Data</>
                         )}
                      </button>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}

            {/* ── MANUAL ENTRY / REVIEW TAB ── */}
            {activeTab === 'manual' && (
              <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-8">
                
                <div className="grid grid-cols-1 md:grid-cols-2 border border-neutral-800 bg-[#0A0A0A]">
                  {/* Section 1: Core Identity */}
                  <div className="col-span-1 md:col-span-2 p-4 border-b border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                    <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block transition-colors ${!formData.name ? 'text-red-400' : 'text-neutral-500 group-focus-within:text-blue-400'}`}>Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Joshua Kanatt"
                        value={formData.name}
                        onChange={e => handleInputChange('name', e.target.value)}
                        className="w-full bg-transparent text-white text-base outline-none placeholder:text-neutral-700"
                      />
                    </div>

                    <div className="p-4 border-b md:border-r border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                      <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block transition-colors ${!formData.email ? 'text-red-400' : 'text-neutral-500 group-focus-within:text-blue-400'}`}>Email *</label>
                      <input
                        type="email"
                        placeholder="joshua@example.com"
                        value={formData.email}
                        onChange={e => handleInputChange('email', e.target.value)}
                        className="w-full bg-transparent text-white text-base outline-none placeholder:text-neutral-700"
                      />
                    </div>

                    <div className="p-4 border-b border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Mobile</label>
                      <input
                        type="tel"
                        placeholder="+91 85472 00015"
                        value={formData.phone}
                        onChange={e => handleInputChange('phone', e.target.value)}
                        className="w-full bg-transparent text-white text-base outline-none placeholder:text-neutral-700"
                      />
                    </div>

                  <div className="p-4 border-b md:border-r border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">LinkedIn URL</label>
                    <input
                      type="url"
                      placeholder="linkedin.com/in/joshuakanatt"
                      value={formData.linkedin}
                      onChange={e => handleInputChange('linkedin', e.target.value)}
                      className="w-full bg-transparent text-white text-base outline-none placeholder:text-neutral-700"
                    />
                  </div>

                  <div className="p-4 border-b border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Portfolio / Website</label>
                    <input
                      type="url"
                      placeholder="jk-lac.vercel.app"
                      value={formData.portfolio}
                      onChange={e => handleInputChange('portfolio', e.target.value)}
                      className="w-full bg-transparent text-white text-base outline-none placeholder:text-neutral-700"
                    />
                  </div>

                  {/* Section 2: Professional Context */}
                  <div className="col-span-1 md:col-span-2 p-4 border-b border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                    <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block transition-colors ${!formData.target_role ? 'text-red-400' : 'text-neutral-500 group-focus-within:text-blue-400'}`}>Primary Role *</label>
                      <Combobox
                        options={ROLE_OPTIONS}
                        value={formData.target_role}
                        onChange={v => handleInputChange('target_role', v)}
                        placeholder="e.g. Chief Product Officer"
                        isMissing={!formData.target_role}
                      />
                    </div>

                    <div className="p-4 border-b md:border-r border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Target Industry</label>
                      <Combobox
                        options={INDUSTRY_OPTIONS}
                        value={formData.industry}
                        onChange={v => handleInputChange('industry', v)}
                        placeholder="e.g. FinTech, SaaS"
                        multiple={true}
                      />
                    </div>

                    <div className="p-4 border-b border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Current Company</label>
                      <input
                        type="text"
                        placeholder="e.g. Neshma"
                        value={formData.company}
                        onChange={e => handleInputChange('company', e.target.value)}
                        className="w-full bg-transparent text-white text-base outline-none placeholder:text-neutral-700"
                      />
                    </div>

                    <div className="p-4 border-b md:border-r border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                      <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block transition-colors ${isFieldMissing('Experience') && !formData.experience_years ? 'text-red-400' : 'text-neutral-500 group-focus-within:text-blue-400'}`}>Overall Experience</label>
                      <Combobox
                        options={EXP_OPTIONS}
                        value={formData.experience_years}
                        onChange={v => handleInputChange('experience_years', v)}
                        placeholder="Select experience..."
                        isMissing={isFieldMissing('Experience') && !formData.experience_years}
                      />
                    </div>

                    <div className="p-4 border-b border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Work Mode</label>
                      <Combobox
                        options={WORK_MODE_OPTIONS}
                        value={formData.work_mode}
                        onChange={v => handleInputChange('work_mode', v)}
                        placeholder="e.g. Remote, Hybrid"
                        multiple={true}
                      />
                    </div>

                  <div className="col-span-1 p-4 border-b md:border-r border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Current Location</label>
                    <Combobox
                      options={LOCATION_OPTIONS}
                      value={formData.location}
                      onChange={v => handleInputChange('location', v)}
                      placeholder="Select current location..."
                      multiple={false}
                    />
                  </div>

                  <div className="col-span-1 p-4 border-b border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Preferred Location</label>
                    <Combobox
                      options={LOCATION_OPTIONS}
                      value={formData.preferred_location}
                      onChange={v => handleInputChange('preferred_location', v)}
                      placeholder="e.g. Bengaluru, India"
                      multiple={true}
                      maxItems={5}
                    />
                  </div>

                  {/* Section 3: Logistics */}
                  <div className="col-span-1 md:col-span-2 p-4 border-b border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Notice Period</label>
                      <Combobox
                        options={NOTICE_OPTIONS}
                        value={formData.notice_period}
                        onChange={v => handleInputChange('notice_period', v)}
                        placeholder="Select notice period..."
                      />
                    </div>

                    <div className="p-4 border-b md:border-r md:border-b-0 border-neutral-800 focus-within:bg-neutral-900 transition-colors group">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Current CTC</label>
                      <Combobox
                        options={CTC_OPTIONS}
                        value={formData.current_ctc}
                        onChange={v => handleInputChange('current_ctc', v)}
                        placeholder="Select CTC..."
                      />
                    </div>

                    <div className="p-4 border-b border-neutral-800 focus-within:bg-neutral-900 transition-colors group md:border-b-0">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-blue-400 transition-colors">Expected CTC</label>
                      <Combobox
                        options={CTC_OPTIONS}
                        value={formData.expected_ctc}
                        onChange={v => handleInputChange('expected_ctc', v)}
                        placeholder="Select expected CTC..."
                      />
                    </div>

                  <div className="col-span-1 md:col-span-2 p-4 border-t border-neutral-800 focus-within:bg-neutral-900 transition-colors group flex items-center">
                    <label 
                      className="flex items-center gap-3 cursor-pointer w-full group"
                      onClick={() => handleInputChange('is_negotiable', !formData.is_negotiable)}
                    >
                      <div className={`w-4 h-4 flex items-center justify-center border transition-colors ${formData.is_negotiable ? 'bg-white border-white text-black' : 'bg-transparent border-neutral-600 group-hover:border-neutral-400'}`}>
                        {formData.is_negotiable && <Check className="w-3 h-3" strokeWidth={3} />}
                      </div>
                      <span className="text-sm font-medium text-neutral-400 group-hover:text-white transition-colors">Open to Negotiate</span>
                    </label>
                  </div>
                </div>

                {/* Arrays Summary (Read Only representation) */}
                {(formData.experience?.length > 0 || formData.education?.length > 0) && (
                  <div className="space-y-6 pt-4">
                     <div className="p-5 border border-blue-500/20 bg-blue-500/5 rounded-none">
                       <h4 className="text-sm font-medium text-blue-400 mb-2">AI Extraction Summary</h4>
                       <p className="text-xs text-blue-300/80 mb-4">The following detailed data points have been extracted and will be saved to your profile for automatic applications.</p>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                         <div className="bg-black/50 border border-neutral-800 p-3 rounded-none text-center">
                           <div className="font-bold text-xl text-white">{formData.experience?.length || 0}</div>
                           <div className="text-xs text-neutral-400">Experience Items</div>
                         </div>
                         <div className="bg-black/50 border border-neutral-800 p-3 rounded-none text-center">
                           <div className="font-bold text-xl text-white">{formData.education?.length || 0}</div>
                           <div className="text-xs text-neutral-400">Education Items</div>
                         </div>
                         <div className="bg-black/50 border border-neutral-800 p-3 rounded-none text-center">
                           <div className="font-bold text-xl text-white">{formData.skills?.length || 0}</div>
                           <div className="text-xs text-neutral-400">Skills Tracked</div>
                         </div>
                         <div className="bg-black/50 border border-neutral-800 p-3 rounded-none text-center">
                           <div className="font-bold text-xl text-white">{formData.projects?.length || 0}</div>
                           <div className="text-xs text-neutral-400">Projects</div>
                         </div>
                       </div>
                     </div>
                  </div>
                )}
                
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="flex-none p-4 md:p-5 border-t border-neutral-800 flex items-center justify-between bg-neutral-950">
          {/* Logo & Brand Name */}
          <div className="hidden sm:flex items-center gap-2.5 opacity-50 hover:opacity-100 transition-all duration-500 ease-out group cursor-pointer">
            <div className="relative group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 ease-out">
              <Image src={brand.logo.path} alt={brand.name} width={18} height={18} className="object-contain drop-shadow-md group-hover:drop-shadow-[0_0_8px_var(--c-primary)] transition-all duration-500" />
            </div>
            <span className="text-sm font-bold text-white tracking-wide group-hover:tracking-[0.2em] group-hover:text-[var(--c-primary)] transition-all duration-500">{brand.name}</span>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                if (!settings?.is_onboarded) {
                  updateSettings({ is_onboarded: true });
                }
                handleClose();
              }}
              className="px-6 py-2.5 bg-neutral-800 text-neutral-300 font-bold uppercase tracking-wider text-sm rounded-none hover:bg-neutral-700 transition-all"
            >
              Skip
            </button>

            <button
            onClick={activeTab === 'manual' ? handleComplete : () => setActiveTab('manual')}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-2.5 bg-white text-black font-bold uppercase tracking-wider text-sm rounded-none hover:bg-neutral-200 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            {activeTab !== 'manual' ? (
              <>Review Data <ArrowRight className="w-4 h-4" /></>
            ) : isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Profile...
              </>
            ) : (
              <>
                Save & Continue
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
