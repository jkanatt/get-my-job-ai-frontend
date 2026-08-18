'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { 
  User, Briefcase, MapPin, Edit3, Link as LinkIcon, FileText, Eye, Upload, Download, Check, X, Loader2, 
  Target, BarChart2, Cpu, Sparkles, Mail, Phone, Activity, Brain, Trash2, Code2, GraduationCap, FolderDot, Languages, Heart, Plus, Award, Minimize2
} from 'lucide-react';
import { toast } from 'sonner';
import { ProfileSkeleton } from '@/shared/design-system/components/Skeletons';
import { apiFetch } from '@/shared/utils/apiFetch';
import { brand } from '@/config/brand.config';

const fetcher = url => apiFetch(url).then(res => res.json());

import { useProfile, useApplications, useCalendar } from '@/shared/hooks';

export default function ProfilePage() {
  const { profile: serverProfile, error, mutate, isLoading, updateProfile } = useProfile();
  const { applications } = useApplications(1, 500);
  const { events } = useCalendar();
  
  const [editMode, setEditMode] = useState({});
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState({});
  
  const [localOverrides, setLocalOverrides] = useState({});
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isParsingMinimized, setIsParsingMinimized] = useState(true);
  const [parsingLogs, setParsingLogs] = useState([]);

  const [brainData, setBrainData] = useState('');
  const [isSavingBrain, setIsSavingBrain] = useState(false);
  const [showBrainModal, setShowBrainModal] = useState(false);
  const [showLatexModal, setShowLatexModal] = useState(false);
  const [latexResume, setLatexResume] = useState('');
  const fileInputRef = useRef(null);
  
  // Profile Image State
  const profileImageRef = useRef(null);
  const [profileImage, setProfileImage] = useState(null);
  const handleProfileImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) setProfileImage(URL.createObjectURL(file));
  };
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [expandedExp, setExpandedExp] = useState({});

  // ── PDF Upload Handler ──
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadedFileName(file.name);
    setIsParsingMinimized(true);
    setIsParsingResume(true);
    setParsingLogs([]);
    
    const addLog = (msg) => {
      const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 });
      setParsingLogs(prev => [...prev, { time, msg }]);
    };

    try {
      addLog(`Received file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      addLog(`Uploading to ${brand.shortName} Resume Intelligence Engine...`);

      const formData = new FormData();
      formData.append('file', file);

      addLog('Extracting text from PDF using multi-engine parser...');
      const res = await apiFetch('/api/ai/parse-resume', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = 'Failed to parse resume';
        try { errMsg = JSON.parse(errText).error || errText; } catch { errMsg = errText; }
        throw new Error(errMsg);
      }

      addLog('AI extraction complete. Parsing structured schema...');
      const extractedData = await res.json();

      if (extractedData.first_name) addLog(`Extracted Name: ${extractedData.first_name} ${extractedData.last_name || ''}`);
      if (extractedData.email) addLog(`Extracted Email: ${extractedData.email}`);
      if (extractedData.experience?.length) addLog(`Identified ${extractedData.experience.length} Work Experience blocks`);
      if (extractedData.education?.length) addLog(`Identified ${extractedData.education.length} Education blocks`);
      if (extractedData.projects?.length) addLog(`Identified ${extractedData.projects.length} Featured Projects`);
      if (extractedData.skills?.length) addLog(`Extracted ${extractedData.skills.length} Technical Skills`);
      if (extractedData._meta) addLog(`Source: ${extractedData._meta.source} | ${extractedData._meta.extractedChars} chars extracted`);

      addLog('Mapping extracted entities to Profile schema...');
      addLog('ANALYSIS COMPLETE. Injecting data into UI...');

      // Clean data
      const cleanData = {};
      Object.keys(extractedData).forEach(key => {
        if (key === '_meta') return;
        if (extractedData[key] !== null && extractedData[key] !== undefined) {
          if (Array.isArray(extractedData[key]) || typeof extractedData[key] === 'string' || typeof extractedData[key] === 'number' || typeof extractedData[key] === 'boolean') {
            cleanData[key] = extractedData[key];
          }
        }
      });

      setLocalOverrides(cleanData);
      setFormData({}); // Clear any edit cache so new data displays

      // Auto-save to backend
      try {
        await updateProfile(cleanData);
        addLog('✓ Profile saved to database successfully.');
      } catch (saveErr) {
        console.error('Failed to auto-save parsed profile:', saveErr);
        addLog('WARNING: Local update applied but database save failed.');
      }

      setIsParsingResume(false);
    } catch (error) {
      console.error(error);
      addLog(`ERROR: ${error.message}`);
      setIsParsingResume(false);
    } finally {
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Modal scroll lock
  useEffect(() => {
    if (showBrainModal || showLatexModal || (isParsingResume && !isParsingMinimized)) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showBrainModal, showLatexModal, isParsingResume, isParsingMinimized]);



  const defaultProfile = {
    first_name: '',
    last_name: '',
    title: '',
    company: '',
    email: '',
    phone: '',
    location: '',
    preferred_location: '',
    work_type: '',
    linkedin: '',
    portfolio: '',
    github: '',
    summary: '',
    experience_years: '',
    notice_period: '',
    current_ctc: '',
    expected_ctc: '',
    skills: [],
    languages: [],
    hobbies: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    awards: [],
    preferred_template: 1,
    custom_tagline: '',
    custom_signoff: '',
    show_ctc_in_emails: false,
    show_notice_period: true
  };

  const profile = { ...defaultProfile, ...(serverProfile || {}), ...localOverrides, ...formData };

  const sectionFields = {
    personal: ['first_name', 'last_name', 'email', 'phone', 'location'],
    summary: ['summary'],
    career: ['title', 'company', 'experience_years', 'notice_period', 'current_ctc', 'expected_ctc', 'preferred_location', 'work_type'],
    links: ['linkedin', 'portfolio', 'github'],
    skills: ['skills'],
    experience: ['experience'],
    education: ['education'],
    certifications: ['certifications'],
    projects: ['projects'],
    attributes: ['languages', 'hobbies'],
    templates: ['preferred_template', 'custom_tagline', 'custom_signoff', 'show_ctc_in_emails', 'show_notice_period']
  };

  const handleEdit = (section) => {
    setEditMode({ ...editMode, [section]: true });
    setFormData({ ...formData, ...profile });
  };

  const handleCancel = (section) => {
    const fields = sectionFields[section];
    if (fields) {
      const revertedData = { ...formData };
      fields.forEach(f => {
        // Remove the field from formData so it falls back to profile/server data
        delete revertedData[f];
      });
      setFormData(revertedData);
    }
    setEditMode({ ...editMode, [section]: false });
  };

  const handleClear = (section) => {
    const fields = sectionFields[section];
    if (!fields) return;
    
    const clearedData = { ...formData };
    fields.forEach(f => {
      if (Array.isArray(defaultProfile[f])) clearedData[f] = [];
      else clearedData[f] = '';
    });
    setFormData(clearedData);
  };

  const handleSave = async (section) => {
    setIsSaving({ ...isSaving, [section]: true });
    try {
      const fields = sectionFields[section] || Object.keys(formData);
      const updates = {};
      fields.forEach(f => { if (formData[f] !== undefined) updates[f] = formData[f]; });
      
      await updateProfile(updates);
      setLocalOverrides({ ...localOverrides, ...updates });
      setEditMode({ ...editMode, [section]: false });
    } catch(e) {
      setLocalOverrides({ ...localOverrides, ...formData });
      setEditMode({ ...editMode, [section]: false });
    } finally {
      setIsSaving({ ...isSaving, [section]: false });
    }
  };

  // Tag Array Handlers
  const handleAddTag = (e, field) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      e.preventDefault();
      const newTag = e.target.value.trim();
      const currentList = formData[field] || profile[field] || [];
      if (!currentList.includes(newTag)) {
        setFormData({ ...formData, [field]: [...currentList, newTag] });
      }
      e.target.value = '';
    }
  };

  const handleRemoveTag = (tagToRemove, field) => {
    const currentList = formData[field] || profile[field] || [];
    setFormData({ ...formData, [field]: currentList.filter(t => t !== tagToRemove) });
  };

  // Complex Array Handlers
  const handleAddArrayItem = (field, defaultItem) => {
    const currentList = formData[field] || profile[field] || [];
    setFormData({ ...formData, [field]: [...currentList, defaultItem] });
  };

  const handleRemoveArrayItem = (field, index) => {
    const currentList = formData[field] || profile[field] || [];
    setFormData({ ...formData, [field]: currentList.filter((_, i) => i !== index) });
  };

  const handleUpdateArrayItem = (field, index, key, value) => {
    const currentList = [...(formData[field] || profile[field] || [])];
    currentList[index] = { ...currentList[index], [key]: value };
    setFormData({ ...formData, [field]: currentList });
  };

  const handleAutoFill = async () => {
    if (!latexResume.trim()) return;
    setShowLatexModal(false);
    
    setUploadedFileName('LaTeX Input');
    setIsParsingMinimized(true);
    setIsParsingResume(true);
    setParsingLogs([]);
    
    const addLog = (msg) => {
      const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 });
      setParsingLogs(prev => [...prev, { time, msg }]);
    };

    try {
      addLog(`Initializing ${brand.shortName} Resume Intelligence Engine...`);
      addLog(`Receiving raw LaTeX payload (${latexResume.length} chars)...`);
      addLog('Sending to Groq LPU cluster → llama-3.3-70b-versatile...');
      
      const res = await apiFetch('/api/ai/parse-latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latexResume })
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = 'Failed to parse LaTeX';
        try {
           const errJson = JSON.parse(errText);
           errMsg = errJson.error || errText;
        } catch(e) {
           errMsg = errText;
        }
        throw new Error(`API Error ${res.status}: ${errMsg}`);
      }
      
      addLog('LLM Processing complete. Parsing structured schema...');
      const extractedData = await res.json();
      
      if (extractedData.first_name) addLog(`✓ Name: ${extractedData.first_name} ${extractedData.last_name || ''}`);
      if (extractedData.email) addLog(`✓ Email: ${extractedData.email}`);
      if (extractedData.phone) addLog(`✓ Phone: ${extractedData.phone}`);
      if (extractedData.location) addLog(`✓ Location: ${extractedData.location}`);
      if (extractedData.title) addLog(`✓ Title: ${extractedData.title}`);
      if (extractedData.linkedin) addLog(`✓ LinkedIn: found`);
      if (extractedData.github) addLog(`✓ GitHub: found`);
      if (extractedData.experience?.length) addLog(`✓ ${extractedData.experience.length} Work Experience blocks`);
      if (extractedData.education?.length) addLog(`✓ ${extractedData.education.length} Education entries`);
      if (extractedData.projects?.length) addLog(`✓ ${extractedData.projects.length} Projects`);
      if (extractedData.skills?.length) addLog(`✓ ${extractedData.skills.length} Technical Skills`);
      if (extractedData.languages?.length) addLog(`✓ ${extractedData.languages.length} Languages`);

      addLog('Mapping extracted entities to Profile schema...');
      addLog('ANALYSIS COMPLETE. Saving to database...');

      // Clean the data by removing nulls/undefined to prevent overwriting with empties
      const cleanData = {};
      Object.keys(extractedData).forEach(key => {
        if (key === '_meta') return;
        if (extractedData[key] !== null && extractedData[key] !== undefined) {
          if (Array.isArray(extractedData[key]) || typeof extractedData[key] === 'string') {
            cleanData[key] = extractedData[key];
          }
        }
      });

      // Update UI state
      setLocalOverrides(cleanData);
      setFormData({}); // Clear any edit cache so new data displays
      
      // Automatically save the parsed data to the backend database
      try {
        await updateProfile(cleanData);
        addLog('✓ Profile saved to database successfully.');
      } catch (saveErr) {
        console.error('Failed to auto-save parsed profile:', saveErr);
        addLog('WARNING: Local update applied but database save failed.');
      }

      setIsParsingResume(false);
    } catch (error) {
      console.error(error);
      addLog(`ERROR: ${error.message}`);
      setIsParsingResume(false);
    }
  };

  const handleSaveBrain = async () => {
    if (!brainData.trim()) return;
    setIsSavingBrain(true);
    try {
      await apiFetch('/api/brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: brainData }) });
      toast.success('Brain data successfully saved as a markdown file.');
    } catch (e) {
      toast.error('Error saving brain data');
    } finally {
      setIsSavingBrain(false);
    }
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const totalApps = applications?.length || 0;
  const passedApps = applications?.filter(a => ['Interview', 'Interviewing', 'Offer'].includes(a.status)).length || 0;
  const atsPassRate = totalApps > 0 ? Math.round((passedApps / totalApps) * 100) : 0;
  const interviewCount = applications?.filter(a => ['Interview', 'Interviewing'].includes(a.status)).length || 0;
  const upcomingInterviews = events?.filter(e => new Date(e.start_time) > new Date()).length || 0;

  const stats = [
    { label: "Total Applications", value: totalApps.toString(), trend: "Active tracking", icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Interview Rate", value: `${atsPassRate}%`, trend: "Pass-through to interview", icon: Target, color: "text-[var(--c-success)]", bg: "bg-[var(--c-success)]/10" },
    { label: "Interviews", value: interviewCount.toString(), trend: `${upcomingInterviews} upcoming`, icon: Briefcase, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="w-full space-y-6 pb-20">
      
      {/* ── PARSING OVERLAY (MINIMIZED) ── */}
      {isParsingResume && isParsingMinimized && (
        <div 
          onClick={() => setIsParsingMinimized(false)}
          className="fixed bottom-6 right-6 z-[100] cursor-pointer w-[380px] animate-in slide-in-from-bottom-5 fade-in duration-300 group"
        >
          {/* Animated Glow behind the box */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600/30 to-blue-400/30 blur opacity-30 group-hover:opacity-60 transition-opacity duration-500 z-0"></div>
          
          <div className="relative z-10 bg-[#0A0A0A] border border-[var(--border-strong)] shadow-[0_20px_50px_rgba(0,0,0,0.9)] w-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-strong)]/80 bg-[#0F0F0F]">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center w-2 h-2">
                  <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                  <div className="relative w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                </div>
                <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--text-primary)]">Groq Engine</h4>
              </div>
              <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Active</span>
            </div>
            
            {/* Body */}
            <div className="p-4 flex gap-4 items-center relative">
              <div className="relative flex items-center justify-center w-12 h-12 bg-black border border-[var(--border-strong)] shrink-0 shadow-inner group-hover:border-[var(--border-default)] transition-colors">
                 <div className="absolute inset-0 border border-blue-500/20 animate-[spin_3s_linear_infinite]"></div>
                 <div className="absolute inset-1 border border-blue-400/20 animate-[spin_4s_linear_infinite_reverse]"></div>
                 <Brain className="text-blue-500 animate-pulse relative z-10" size={18} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                 <div className="flex items-center justify-between mb-1">
                   <span className="text-[9px] text-[var(--text-muted)] font-mono tracking-widest uppercase">Target: LPU-70B</span>
                 </div>
                 <p className="text-[11px] text-[var(--text-primary)] truncate font-mono">
                   {parsingLogs.length > 0 ? parsingLogs[parsingLogs.length - 1].msg : 'Initializing Neural Parse...'}
                 </p>
              </div>
            </div>

            {/* Bottom Progress Bar */}
            <div className="w-full h-[2px] bg-[var(--bg-base)] absolute bottom-0 left-0">
               <div className="h-full bg-blue-500 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_10px_rgba(59,130,246,0.8)]" style={{ width: '45%', transition: 'width 2s ease' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* ── FULL SCREEN PARSING OVERLAY (SHARP & MODERN) ── */}
      {isParsingResume && !isParsingMinimized && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[var(--bg-base)]/95 backdrop-blur-3xl transition-all duration-700 ease-in-out">
          <div className="flex flex-col items-center w-full max-w-4xl">
            {/* Top processing indicator */}
            <div className="flex items-center justify-between w-full mb-8">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center w-12 h-12 bg-[var(--bg-input)] border border-[var(--border-strong)] shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                  <div className="absolute inset-0 border border-[var(--border-subtle)] animate-[spin_4s_linear_infinite]"></div>
                  <div className="absolute inset-2 border border-blue-500/50 animate-[spin_3s_linear_infinite_reverse]"></div>
                  <Brain className="text-[var(--text-primary)] animate-pulse" size={18} />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-[24px] font-black text-[var(--text-primary)] tracking-[0.3em] uppercase leading-none">Groq Engine</h2>
                  <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest mt-1 font-mono">Neural Parsing Sequence Initiated</p>
                </div>
              </div>
              <button 
                onClick={() => setIsParsingMinimized(true)}
                className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-white flex items-center gap-2 transition-colors border border-[var(--border-strong)] hover:border-[var(--border-subtle)] px-4 py-2 bg-[var(--bg-elevated)]"
              >
                <Minimize2 size={14} /> Minimize
              </button>
            </div>
            
            {/* Terminal Window */}
            <div className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] shadow-[0_30px_100px_-20px_rgba(0,0,0,1)] relative overflow-hidden group">
              {/* Terminal Header */}
              <div className="h-8 bg-[var(--bg-elevated)] border-b border-[var(--border-strong)] flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--bg-hover)]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--bg-hover)]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--bg-hover)]"></div>
                </div>
                <div className="text-[9px] text-[var(--text-muted)] font-mono tracking-widest">/dev/tty0 - LPU-NODE-70B</div>
                <div className="w-10"></div>
              </div>

              {/* Animated Progress Bar */}
              <div className="absolute top-8 left-0 w-full h-[1px] bg-[var(--bg-base)]">
                <div className="h-full bg-blue-500 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_15px_rgba(59,130,246,1)]" style={{ width: '45%', transition: 'width 2s ease' }}></div>
              </div>
              
              <div className="p-8 font-mono text-[13px] flex flex-col min-h-[360px] max-h-[500px] overflow-hidden relative">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                
                <div className="space-y-4 z-10">
                  {parsingLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
                      <span className="text-[var(--text-muted)] shrink-0 select-none border-r border-[var(--border-strong)] pr-4">[{log.time}]</span>
                      <span className={
                        log.msg.includes('ERROR') ? 'text-red-500 font-bold' :
                        log.msg.includes('COMPLETE') ? 'text-[#10B981] font-bold tracking-wide' : 
                        log.msg.includes('Extracted') || log.msg.includes('Identified') ? 'text-blue-400' : 
                        'text-[var(--text-secondary)]'
                      }>
                        {log.msg}
                      </span>
                    </div>
                  ))}
                  
                  {/* Blinking cursor */}
                  <div className="flex items-center gap-4 mt-4 animate-in fade-in">
                    <span className="text-[var(--text-muted)] opacity-0 select-none border-r border-transparent pr-4">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 })}]</span>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500 text-sm">~%</span>
                      <div className="w-2.5 h-4 bg-zinc-300 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden file input for PDF upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.tex,.txt"
        onChange={handlePdfUpload}
        className="hidden"
      />

      {/* ── AUTO-FILL BANNER ── */}
      <div className="bg-[var(--bg-elevated)] border border-blue-500/30 p-6 flex items-center justify-between shadow-[0_0_40px_rgba(37,99,235,0.1)] relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent opacity-50" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-5">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="text-blue-500" size={24} />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-[18px] font-black text-[var(--text-primary)] tracking-tight">Upload Resume & Build Profile</h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1 max-w-xl">
              Upload a PDF or paste LaTeX — our AI engine parses your resume and instantly populates your entire professional profile.
            </p>
          </div>
        </div>
        <div className="relative z-10 mt-4 md:mt-0 flex items-center gap-3 shrink-0">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsingResume}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-[#FDFCF0] text-[11px] font-bold uppercase tracking-widest transition-all duration-300 shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:-translate-y-0.5 flex items-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isParsingResume ? (
              <><Loader2 size={16} className="animate-spin" /> Extracting...</>
            ) : (
              <><Upload size={16} /> Upload PDF</>
            )}
          </button>
          <button 
            onClick={() => setShowLatexModal(true)}
            disabled={isParsingResume}
            className="px-6 py-3 bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-[11px] font-bold uppercase tracking-widest transition-all border border-[var(--border-subtle)] flex items-center gap-3 disabled:opacity-50"
          >
            <Code2 size={16} /> Paste LaTeX
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── LEFT SIDEBAR ── */}
        <div className="lg:col-span-3 space-y-6">
          
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 p-8 flex flex-col items-center text-center relative overflow-hidden group hover:border-[var(--border-default)] transition-colors">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <input type="file" accept="image/*" ref={profileImageRef} onChange={handleProfileImageUpload} className="hidden" />
            
            <div 
              onClick={() => profileImageRef.current?.click()}
              className="w-28 h-28 rounded-2xl bg-black border-2 border-dashed border-[var(--border-strong)] flex items-center justify-center mb-6 relative group/avatar cursor-pointer hover:border-blue-500/50 transition-colors overflow-hidden shadow-inner"
            >
               {profileImage ? (
                 <img src={profileImage} alt="Profile" className="w-full h-full object-cover group-hover/avatar:opacity-30 transition-opacity" />
               ) : (
                 <User size={32} className="text-zinc-700 group-hover/avatar:text-blue-500/50 transition-colors" />
               )}
               <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                  <Upload size={20} className="text-blue-400" />
               </div>
            </div>
            
            <h2 className="text-[20px] font-black tracking-wide text-[var(--text-primary)] uppercase">{profile.first_name || 'Your'} {profile.last_name || 'Name'}</h2>
            <p className="text-[12px] font-bold text-blue-500 mt-1 uppercase tracking-widest">{profile.title || 'Add your current title'}</p>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-muted)] mt-4 uppercase tracking-widest">
              <MapPin size={12} className="text-[var(--text-muted)] shrink-0" /> <span className="truncate">{profile.location || 'Location not set'}</span>
            </div>
            
            <div className="w-full h-px bg-[var(--bg-elevated)]/50 my-6" />
            
            <div className="w-full space-y-3 text-left">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Profile Strength</div>
                {(() => {
                  const p = serverProfile || {};
                  const checks = [
                    !!p.first_name, !!p.email, !!p.phone,
                    !!(p.skills && p.skills.length > 0),
                    !!(p.experience && p.experience.length > 0),
                    !!(p.education && p.education.length > 0),
                    !!p.linkedin, !!p.summary,
                    !!(p.projects && p.projects.length > 0),
                  ];
                  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
                  const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
                  return <span style={{ color }} className="text-[12px] font-black">{score}%</span>;
                })()}
              </div>
              
              {(() => {
                const p = serverProfile || {};
                const checks = [
                  !!p.first_name, !!p.email, !!p.phone,
                  !!(p.skills && p.skills.length > 0),
                  !!(p.experience && p.experience.length > 0),
                  !!(p.education && p.education.length > 0),
                  !!p.linkedin, !!p.summary,
                  !!(p.projects && p.projects.length > 0),
                ];
                const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
                const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
                const label = score >= 80 ? 'Ready for ATS screening' : score >= 50 ? 'Add details to improve score' : 'Complete profile to start';
                return (
                  <>
                    <div className="w-full h-1 bg-[var(--bg-base)] overflow-hidden">
                      <div className="h-full transition-all duration-1000 ease-out" style={{ backgroundColor: color, width: `${score}%` }} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-2 text-right">{label}</p>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 p-6 group hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-transparent via-purple-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-6 flex items-center gap-3">
              <BarChart2 size={12} className="text-purple-500" /> Application Analytics
            </h3>
            <div className="space-y-5">
              {stats.map((stat, i) => (
                <div key={i} className="flex flex-col gap-1.5 border-b border-[var(--border-strong)]/50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <stat.icon size={12} className={stat.color.replace('text-', 'text-').replace('500', '400')} />
                       <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{stat.label}</span>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${stat.color}`}>{stat.trend}</span>
                  </div>
                  <div className="text-[24px] font-black text-[var(--text-primary)] leading-none">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 group hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-transparent via-emerald-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="p-5 border-b border-[var(--border-strong)]/80 bg-black/50">
              <div className="flex items-center gap-3">
                <FileText size={12} className="text-emerald-500" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Master Resume</h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 bg-black p-3 border border-[var(--border-strong)]">
                <div className="w-10 h-12 bg-[var(--bg-base)] border border-[var(--border-strong)] flex items-center justify-center text-[9px] font-black text-emerald-500 shrink-0">
                  PDF
                </div>
                <div className="overflow-hidden">
                  <div className="text-[12px] font-black text-[var(--text-primary)] mb-1 truncate uppercase tracking-wide">{profile.first_name ? `${profile.first_name}_Resume.pdf` : 'NO_RESUME.pdf'}</div>
                  <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5">
                     <div className={`w-1.5 h-1.5 rounded-full ${profile.first_name ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                     {profile.first_name ? 'Ready to apply' : 'Action required'}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2.5">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-black hover:bg-[var(--bg-base)] text-[var(--text-primary)] hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors border border-[var(--border-strong)] hover:border-emerald-500/30"
                >
                  <Upload size={12} className="text-emerald-500" /> Upload PDF
                </button>
                <button 
                  onClick={() => setShowLatexModal(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-black hover:bg-[var(--bg-base)] text-[var(--text-primary)] hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors border border-[var(--border-strong)] hover:border-emerald-500/30"
                >
                  <Code2 size={12} className="text-emerald-500" /> Paste LaTeX
                </button>
                <button 
                  onClick={async () => {
                    const toastId = toast.loading('Generating your Second Brain vault...');
                    try {
                      const res = await fetch('/api/brain/export', { method: 'POST' });
                      if (!res.ok) throw new Error('Failed to generate vault');
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Obsidian_Second_Brain_${profile.first_name || 'User'}.zip`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                      toast.success('Vault downloaded successfully!', { id: toastId });
                    } catch (e) {
                      toast.error(e.message || 'Error exporting brain', { id: toastId });
                    }
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 text-[10px] font-black uppercase tracking-widest transition-colors border border-blue-500/20 hover:border-blue-500/40"
                >
                  <Download size={12} /> Obsidian Brain
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 p-6 group hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-6 flex items-center gap-3">
              <Activity size={12} className="text-cyan-500" /> Platform Activity
            </h3>
            
            <div className="space-y-6">
              {/* Mini Chart */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 flex items-center justify-between">
                  <span>Usage (Last 7 Days)</span>
                  <span className="text-cyan-500 animate-pulse">Active</span>
                </div>
                <div className="flex items-end gap-1.5 h-16 w-full mt-2">
                  {[35, 60, 20, 85, 45, 100, 70].map((height, idx) => (
                    <div key={idx} className="flex-1 bg-[var(--bg-base)] border border-[var(--border-strong)] flex flex-col justify-end group/bar relative">
                       <div className="w-full bg-cyan-500/80 border-t-2 border-cyan-400 group-hover/bar:bg-cyan-400 group-hover/bar:border-cyan-300 transition-all cursor-pointer" style={{ height: `${height}%` }} />
                       {/* Tooltip */}
                       <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] font-bold py-1 px-2 opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 border border-[var(--border-strong)]">
                         {height} events
                       </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-px bg-[var(--bg-elevated)]/80 border border-[var(--border-strong)]/80 mt-6">
                 <div className="bg-[#0A0A0A] p-4 flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Time Saved</span>
                    <span className="text-[16px] font-black text-cyan-400">42<span className="text-[10px] text-[var(--text-muted)] ml-1">hrs</span></span>
                 </div>
                 <div className="bg-[#0A0A0A] p-4 flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">AI Actions</span>
                    <span className="text-[16px] font-black text-[var(--text-primary)]">1,284</span>
                 </div>
                 <div className="bg-[#0A0A0A] p-4 flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Resumes Gen</span>
                    <span className="text-[16px] font-black text-[var(--text-primary)]">14</span>
                 </div>
                 <div className="bg-[#0A0A0A] p-4 flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Auto-Applies</span>
                    <span className="text-[16px] font-black text-[var(--text-primary)]">38</span>
                 </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── MAIN CONTENT (FORMS) ── */}
        <div className="lg:col-span-9 space-y-6">

          {/* Section: Professional Summary */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="Professional Summary" icon={FileText} isEditing={editMode.summary} onEdit={() => handleEdit('summary')} onCancel={() => handleCancel('summary')} onSave={() => handleSave('summary')} onClear={() => handleClear('summary')} isSaving={isSaving.summary} colorClass="text-indigo-500" />
            <div className="p-8">
              {editMode.summary ? (
                <textarea className="w-full h-32 bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] p-4 outline-none resize-y focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" value={formData.summary || ''} onChange={e => setFormData({...formData, summary: e.target.value})} placeholder="Write a brief professional summary..." />
              ) : (
                <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{profile.summary || <span className="text-[var(--text-muted)] italic">No summary added yet.</span>}</p>
              )}
            </div>
          </div>

          {/* Section: Professional Overview */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="Professional Overview" icon={Briefcase} isEditing={editMode.career} onEdit={() => handleEdit('career')} onCancel={() => handleCancel('career')} onSave={() => handleSave('career')} onClear={() => handleClear('career')} isSaving={isSaving.career} colorClass="text-[#10B981]" />
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-[var(--bg-elevated)]/80 border border-[var(--border-strong)]/80 p-px">
                <div className="md:col-span-2 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Current Title" value={profile.title} isEdit={editMode.career} onChange={v => setFormData({...formData, title: v})} /></div>
                <div className="md:col-span-2 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Current Company" value={profile.company} isEdit={editMode.career} onChange={v => setFormData({...formData, company: v})} /></div>
                <div className="md:col-span-1 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Experience" value={profile.experience_years} isEdit={editMode.career} onChange={v => setFormData({...formData, experience_years: v})} /></div>
                <div className="md:col-span-1 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Notice Period" value={profile.notice_period} isEdit={editMode.career} onChange={v => setFormData({...formData, notice_period: v})} /></div>
                <div className="md:col-span-1 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Current CTC" value={profile.current_ctc} isEdit={editMode.career} onChange={v => setFormData({...formData, current_ctc: v})} /></div>
                <div className="md:col-span-1 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Expected CTC" value={profile.expected_ctc} isEdit={editMode.career} onChange={v => setFormData({...formData, expected_ctc: v})} /></div>
                <div className="md:col-span-2 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><PreferredLocationsField label="Preferred Location" value={profile.preferred_location} isEdit={editMode.career} onChange={v => setFormData({...formData, preferred_location: v})} icon={MapPin} /></div>
                <div className="md:col-span-2 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Work Type (Remote, Hybrid, etc)" value={profile.work_type} isEdit={editMode.career} onChange={v => setFormData({...formData, work_type: v})} /></div>
              </div>
            </div>
          </div>

          {/* Section: Experience */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="Work Experience" icon={Briefcase} isEditing={editMode.experience} onEdit={() => handleEdit('experience')} onCancel={() => handleCancel('experience')} onSave={() => handleSave('experience')} onClear={() => handleClear('experience')} isSaving={isSaving.experience} colorClass="text-[#10B981]" />
            <div className="p-8 space-y-6">
              {((editMode.experience ? formData.experience : profile.experience) || []).map((exp, idx) => (
                <div key={idx} className="bg-[#0A0A0A] border border-[var(--border-subtle)] p-6 relative group hover:border-[var(--border-default)] transition-colors">
                  {editMode.experience && (
                    <button onClick={() => handleRemoveArrayItem('experience', idx)} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                  {editMode.experience ? (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <ProfileField label="Job Title" value={exp.title} isEdit={true} onChange={v => handleUpdateArrayItem('experience', idx, 'title', v)} />
                      <ProfileField label="Company" value={exp.company} isEdit={true} onChange={v => handleUpdateArrayItem('experience', idx, 'company', v)} />
                      <ProfileField label="Tenure" value={exp.tenure} isEdit={true} onChange={v => handleUpdateArrayItem('experience', idx, 'tenure', v)} />
                      <ProfileField label="Location" value={exp.location} isEdit={true} onChange={v => handleUpdateArrayItem('experience', idx, 'location', v)} />
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-3">Description / Accomplishments</label>
                        <textarea className="w-full h-24 bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] p-4 outline-none resize-y focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" value={exp.description || ''} onChange={e => handleUpdateArrayItem('experience', idx, 'description', e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-6 group relative">
                      {/* Left Rail */}
                      <div className="w-28 shrink-0 flex flex-col items-end text-right pt-1 relative z-10">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-black px-2 py-1 border border-[var(--border-strong)]">{exp.tenure}</div>
                        <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1 mt-2 text-right">
                          {exp.location}
                          <MapPin size={10} className="shrink-0" />
                        </div>
                      </div>
                      
                      {/* Divider */}
                      <div className="w-[1px] bg-[var(--bg-elevated)] group-hover:bg-[#10B981]/50 transition-colors relative z-10 mt-1 mb-1"></div>
                      
                      {/* Main Content */}
                      <div className="flex-1 pb-2">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col">
                            <h4 className="text-[16px] font-black tracking-wide text-[var(--text-primary)] uppercase leading-tight">{exp.title}</h4>
                            <div className="text-[12px] font-mono text-[var(--text-secondary)] mt-1.5 uppercase tracking-widest">{exp.company}</div>
                          </div>
                          <div className="w-10 h-10 bg-black border border-[var(--border-strong)] flex items-center justify-center shrink-0 shadow-inner group-hover:border-[#10B981]/50 transition-colors ml-4">
                            <Briefcase className="text-[var(--text-muted)] group-hover:text-[#10B981] transition-colors" size={16} strokeWidth={1.5} />
                          </div>
                        </div>
                        {exp.description && (() => {
                          const points = (exp.description || '').split(/\\n|\n/).filter(line => line.trim() !== '');
                          const isExpanded = expandedExp[idx];
                          const visiblePoints = isExpanded ? points : points.slice(0, 3);
                          const hasMore = points.length > 3;
                          
                          return (
                            <div className="mt-3">
                              <ul className="space-y-2">
                                {visiblePoints.map((line, i) => (
                                  <li key={i} className="flex items-start gap-3">
                                     <span className="text-[#10B981] mt-1.5 text-[8px] shrink-0">■</span>
                                     <span className="text-[13px] text-[var(--text-primary)] leading-relaxed">{line.replace(/^[•\-\*]\s*/, '').trim()}</span>
                                  </li>
                                ))}
                              </ul>
                              {hasMore && (
                                <button 
                                  onClick={() => setExpandedExp(prev => ({...prev, [idx]: !prev[idx]}))}
                                  className="mt-4 text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[#10B981] transition-colors flex items-center gap-1.5"
                                >
                                  {isExpanded ? 'Read Less' : `Read More (${points.length - 3})`}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {editMode.experience && (
                <button onClick={() => handleAddArrayItem('experience', { title: '', company: '', tenure: '', location: '', description: '' })} className="w-full py-4 border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-zinc-500 hover:bg-[var(--bg-base)] transition-colors text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Experience
                </button>
              )}
              {(!profile.experience || profile.experience.length === 0) && !editMode.experience && (
                <span className="text-[12px] text-[var(--text-muted)]">No experience details added yet.</span>
              )}
            </div>
          </div>

          {/* Section: Education */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="Education History" icon={GraduationCap} isEditing={editMode.education} onEdit={() => handleEdit('education')} onCancel={() => handleCancel('education')} onSave={() => handleSave('education')} onClear={() => handleClear('education')} isSaving={isSaving.education} colorClass="text-yellow-500" />
            <div className="p-8 space-y-6">
              {((editMode.education ? formData.education : profile.education) || []).map((edu, idx) => (
                <div key={idx} className="bg-[#0A0A0A] border border-[var(--border-subtle)] p-6 relative group hover:border-[var(--border-default)] transition-colors">
                  {editMode.education && (
                    <button onClick={() => handleRemoveArrayItem('education', idx)} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                  {editMode.education ? (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <ProfileField label="Institution" value={edu.institution} isEdit={true} onChange={v => handleUpdateArrayItem('education', idx, 'institution', v)} />
                      <ProfileField label="Degree" value={edu.degree} isEdit={true} onChange={v => handleUpdateArrayItem('education', idx, 'degree', v)} />
                      <ProfileField label="Major" value={edu.major} isEdit={true} onChange={v => handleUpdateArrayItem('education', idx, 'major', v)} />
                      <div className="grid grid-cols-2 gap-4">
                        <ProfileField label="Marks / CGPA" value={edu.marks} isEdit={true} onChange={v => handleUpdateArrayItem('education', idx, 'marks', v)} />
                        <ProfileField label="Grad Year" value={edu.graduationYear} isEdit={true} onChange={v => handleUpdateArrayItem('education', idx, 'graduationYear', v)} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-6 group relative">
                      {/* Left Rail */}
                      <div className="w-28 shrink-0 flex flex-col items-end text-right pt-1 relative z-10">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-black px-2 py-1 border border-[var(--border-strong)]">{edu.graduationYear}</div>
                        {edu.marks && (
                           <div className="text-[10px] font-black uppercase tracking-widest text-yellow-500/90 flex items-center gap-1.5 mt-2">
                             {edu.marks}
                             <div className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse"></div>
                           </div>
                        )}
                      </div>
                      
                      {/* Divider */}
                      <div className="w-[1px] bg-[var(--bg-elevated)] group-hover:bg-yellow-500/50 transition-colors relative z-10 mt-1 mb-1"></div>
                      
                      {/* Main Content */}
                      <div className="flex-1 pb-2">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                            <h4 className="text-[16px] font-black tracking-wide text-[var(--text-primary)] uppercase leading-tight">{edu.institution}</h4>
                            <div className="text-[12px] font-mono text-[var(--text-secondary)] mt-1.5 uppercase tracking-widest">{edu.degree} <span className="text-[var(--text-muted)] px-1.5">•</span> {edu.major}</div>
                          </div>
                          <div className="w-10 h-10 bg-black border border-[var(--border-strong)] flex items-center justify-center shrink-0 shadow-inner group-hover:border-yellow-500/50 transition-colors ml-4">
                            <GraduationCap className="text-[var(--text-muted)] group-hover:text-yellow-500 transition-colors" size={16} strokeWidth={1.5} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {editMode.education && (
                <button onClick={() => handleAddArrayItem('education', { institution: '', degree: '', major: '', marks: '', graduationYear: '' })} className="w-full py-4 border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-zinc-500 hover:bg-[var(--bg-base)] transition-colors text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Education
                </button>
              )}
              {(!profile.education || profile.education.length === 0) && !editMode.education && (
                <span className="text-[12px] text-[var(--text-muted)]">No education details added yet.</span>
              )}
            </div>
          </div>

          {/* Section: Certifications */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="Certifications" icon={Award} isEditing={editMode.certifications} onEdit={() => handleEdit('certifications')} onCancel={() => handleCancel('certifications')} onSave={() => handleSave('certifications')} onClear={() => handleClear('certifications')} isSaving={isSaving.certifications} colorClass="text-emerald-500" />
            <div className="p-8 space-y-6">
              {((editMode.certifications ? formData.certifications : profile.certifications) || []).map((cert, idx) => (
                <div key={idx} className="bg-white/[0.02] border border-[var(--border-subtle)] p-6 relative group">
                  {editMode.certifications && (
                    <button onClick={() => handleRemoveArrayItem('certifications', idx)} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                  {editMode.certifications ? (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <ProfileField label="Certification Name" value={cert.name} isEdit={true} onChange={v => handleUpdateArrayItem('certifications', idx, 'name', v)} />
                      <ProfileField label="Issuer" value={cert.issuer} isEdit={true} onChange={v => handleUpdateArrayItem('certifications', idx, 'issuer', v)} />
                      <div className="col-span-2">
                        <ProfileField label="Date" value={cert.date} isEdit={true} onChange={v => handleUpdateArrayItem('certifications', idx, 'date', v)} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-[16px] font-bold text-[var(--text-primary)] tracking-tight">{cert.name}</h4>
                          <div className="text-[13px] text-[var(--text-secondary)] mt-1">{cert.issuer}</div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2 shrink-0 ml-4">
                          <div className="text-[11px] font-mono text-[var(--text-muted)] px-3 py-1 bg-[var(--bg-input)] border border-[var(--border-subtle)]">{cert.date || 'No Date'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {editMode.certifications && (
                <button onClick={() => handleAddArrayItem('certifications', { name: '', issuer: '', date: '' })} className="w-full py-4 border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-zinc-500 hover:bg-[var(--bg-base)] transition-colors text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Certification
                </button>
              )}
              {(!profile.certifications || profile.certifications.length === 0) && !editMode.certifications && (
                <span className="text-[12px] text-[var(--text-muted)]">No certifications added yet.</span>
              )}
            </div>
          </div>

          {/* Section: Projects */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="Featured Projects" icon={FolderDot} isEditing={editMode.projects} onEdit={() => handleEdit('projects')} onCancel={() => handleCancel('projects')} onSave={() => handleSave('projects')} onClear={() => handleClear('projects')} isSaving={isSaving.projects} colorClass="text-orange-500" />
            <div className="p-8 space-y-6">
              {((editMode.projects ? formData.projects : profile.projects) || []).map((proj, idx) => (
                <div key={idx} className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 p-7 relative group hover:border-[var(--border-default)] transition-colors">
                  {editMode.projects && (
                    <button onClick={() => handleRemoveArrayItem('projects', idx)} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                  {editMode.projects ? (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <ProfileField label="Project Title" value={proj.title} isEdit={true} onChange={v => handleUpdateArrayItem('projects', idx, 'title', v)} />
                      <ProfileField label="Link" value={proj.link} isEdit={true} onChange={v => handleUpdateArrayItem('projects', idx, 'link', v)} />
                      <div className="col-span-2">
                        <ProfileField label="Technologies Used (Comma separated)" value={proj.technologies} isEdit={true} onChange={v => handleUpdateArrayItem('projects', idx, 'technologies', v)} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-3">Description</label>
                        <textarea className="w-full h-20 bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] p-4 outline-none resize-y focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" value={proj.description || ''} onChange={e => handleUpdateArrayItem('projects', idx, 'description', e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      <div className="flex justify-between items-start pb-5 mb-5 border-b border-[var(--border-strong)]/80">
                        <h4 className="text-[18px] font-black text-[var(--text-primary)] tracking-wide uppercase">{proj.title}</h4>
                        {proj.link && (
                          <a href={proj.link.startsWith('http') ? proj.link : `https://${proj.link}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)] hover:text-white transition-all flex items-center gap-2 shrink-0 ml-4 border border-[var(--border-default)] hover:border-blue-500 hover:bg-blue-500/10 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] px-4 py-2 bg-[var(--bg-base)] group/btn">
                            View Project <LinkIcon size={10} className="text-blue-500 group-hover/btn:text-blue-400" />
                          </a>
                        )}
                      </div>
                      
                      {proj.description && (
                        <ul className="mb-6 space-y-2.5">
                          {(proj.description || '').split(/\\n|\n/).filter(line => line.trim() !== '').map((line, i) => (
                            <li key={i} className="flex items-start gap-3">
                               <span className="text-orange-500 mt-1.5 text-[8px] shrink-0">■</span>
                               <span className="text-[13px] text-[var(--text-primary)] leading-relaxed">{line.replace(/^[•\-\*]\s*/, '').trim()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      
                      {proj.technologies && (
                        <div className="mt-auto pt-5 border-t border-[var(--border-strong)]/80 flex items-start gap-3">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mt-1 shrink-0">Tech</span>
                          <div className="flex flex-wrap gap-2">
                             {(proj.technologies || '').split(',').map((tech, i) => (
                               <span key={i} className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border-strong)] px-3 py-1.5 hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors">
                                 {tech.trim()}
                               </span>
                             ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {editMode.projects && (
                <button onClick={() => handleAddArrayItem('projects', { title: '', description: '', link: '', technologies: '' })} className="w-full py-4 border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-zinc-500 hover:bg-[var(--bg-base)] transition-colors text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Project
                </button>
              )}
              {(!profile.projects || profile.projects.length === 0) && !editMode.projects && (
                <span className="text-[12px] text-[var(--text-muted)]">No projects added yet.</span>
              )}
            </div>
          </div>

          {/* Section: Personal Attributes (Languages, Hobbies) */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="Personal Attributes" icon={Heart} isEditing={editMode.attributes} onEdit={() => handleEdit('attributes')} onCancel={() => handleCancel('attributes')} onSave={() => handleSave('attributes')} onClear={() => handleClear('attributes')} isSaving={isSaving.attributes} colorClass="text-red-500" />
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Languages */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-4 flex items-center gap-2"><Languages size={14}/> Languages</label>
                {editMode.attributes && (
                  <input type="text" placeholder="Add language and press Enter..." onKeyDown={e => handleAddTag(e, 'languages')} className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] p-4 outline-none mb-4 focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" />
                )}
                <div className="flex flex-wrap gap-2">
                  {((editMode.attributes ? formData.languages : profile.languages) || []).map((lang, idx) => (
                    <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 border ${editMode.attributes ? 'bg-[#0A0A0A] border-[var(--border-strong)] text-[var(--text-secondary)] text-[12px]' : 'bg-[var(--bg-base)] border-[var(--border-strong)] text-[var(--text-primary)] text-[10px] font-black uppercase tracking-widest'}`}>
                      {lang}
                      {editMode.attributes && <button onClick={() => handleRemoveTag(lang, 'languages')} className="text-[var(--text-muted)] hover:text-red-400 transition-colors"><X size={12} /></button>}
                    </div>
                  ))}
                  {(!profile.languages || profile.languages.length === 0) && !editMode.attributes && (
                    <div className="w-full py-3 px-4 bg-[var(--bg-input)] border border-dashed border-[var(--border-subtle)] text-[12px] font-mono text-[var(--text-muted)] flex items-center justify-center rounded-sm">
                      Not specified
                    </div>
                  )}
                </div>
              </div>

              {/* Hobbies */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-4 flex items-center gap-2"><Heart size={14}/> Hobbies & Interests</label>
                {editMode.attributes && (
                  <input type="text" placeholder="Add hobby and press Enter..." onKeyDown={e => handleAddTag(e, 'hobbies')} className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] p-4 outline-none mb-4 focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" />
                )}
                <div className="flex flex-wrap gap-2">
                  {((editMode.attributes ? formData.hobbies : profile.hobbies) || []).map((hobby, idx) => (
                    <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 border ${editMode.attributes ? 'bg-[#0A0A0A] border-[var(--border-strong)] text-[var(--text-secondary)] text-[12px]' : 'bg-[var(--bg-base)] border-[var(--border-strong)] text-[var(--text-primary)] text-[10px] font-black uppercase tracking-widest'}`}>
                      {hobby}
                      {editMode.attributes && <button onClick={() => handleRemoveTag(hobby, 'hobbies')} className="text-[var(--text-muted)] hover:text-red-400 transition-colors"><X size={12} /></button>}
                    </div>
                  ))}
                  {(!profile.hobbies || profile.hobbies.length === 0) && !editMode.attributes && (
                    <div className="w-full py-3 px-4 bg-[var(--bg-input)] border border-dashed border-[var(--border-subtle)] text-[12px] font-mono text-[var(--text-muted)] flex items-center justify-center rounded-sm">
                      Not specified
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Personal & Contact */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="Personal & Contact" icon={User} isEditing={editMode.personal} onEdit={() => handleEdit('personal')} onCancel={() => handleCancel('personal')} onSave={() => handleSave('personal')} onClear={() => handleClear('personal')} isSaving={isSaving.personal} colorClass="text-blue-500" />
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-[var(--bg-elevated)]/80 border border-[var(--border-strong)]/80 p-px">
                <div className="md:col-span-2 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="First Name" value={profile.first_name} isEdit={editMode.personal} onChange={v => setFormData({...formData, first_name: v})} /></div>
                <div className="md:col-span-2 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Last Name" value={profile.last_name} isEdit={editMode.personal} onChange={v => setFormData({...formData, last_name: v})} /></div>
                <div className="md:col-span-2 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Email" value={profile.email} isEdit={editMode.personal} onChange={v => setFormData({...formData, email: v})} icon={Mail} /></div>
                <div className="md:col-span-1 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Phone" value={profile.phone} isEdit={editMode.personal} onChange={v => setFormData({...formData, phone: v})} icon={Phone} /></div>
                <div className="md:col-span-1 bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Location" value={profile.location} isEdit={editMode.personal} onChange={v => setFormData({...formData, location: v})} icon={MapPin} /></div>
              </div>
            </div>
          </div>

          {/* Section: Links */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="External Links" icon={LinkIcon} isEditing={editMode.links} onEdit={() => handleEdit('links')} onCancel={() => handleCancel('links')} onSave={() => handleSave('links')} onClear={() => handleClear('links')} isSaving={isSaving.links} colorClass="text-purple-500" />
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--bg-elevated)]/80 border border-[var(--border-strong)]/80 p-px">
                <div className="bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="LinkedIn Profile" value={profile.linkedin} isEdit={editMode.links} onChange={v => setFormData({...formData, linkedin: v})} link /></div>
                <div className="bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="Portfolio Website" value={profile.portfolio} isEdit={editMode.links} onChange={v => setFormData({...formData, portfolio: v})} link /></div>
                <div className="bg-[#0A0A0A] p-6 hover:bg-[#0F0F0F] transition-colors"><ProfileField label="GitHub Profile" value={profile.github} isEdit={editMode.links} onChange={v => setFormData({...formData, github: v})} link /></div>
              </div>
            </div>
          </div>

          {/* Section: Skills */}
          <div className="bg-[#0A0A0A] border border-[var(--border-strong)]/80 hover:border-[var(--border-default)] transition-colors relative overflow-hidden">
            <SectionHeader title="Technical & Core Skills" icon={Cpu} isEditing={editMode.skills} onEdit={() => handleEdit('skills')} onCancel={() => handleCancel('skills')} onSave={() => handleSave('skills')} onClear={() => handleClear('skills')} isSaving={isSaving.skills} colorClass="text-pink-500" />
            <div className="p-8">
              {editMode.skills && (
                <div className="mb-6">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-3">Add New Skill</label>
                  <input type="text" placeholder="Type a skill and press Enter..." onKeyDown={e => handleAddTag(e, 'skills')} className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] p-4 outline-none focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {((editMode.skills ? formData.skills : profile.skills) || []).map((skill, idx) => (
                  <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 border ${editMode.skills ? 'bg-[#0A0A0A] border-[var(--border-strong)] text-[var(--text-secondary)] text-[12px]' : 'bg-[var(--bg-base)] border-[var(--border-strong)] text-[var(--text-primary)] text-[10px] font-black uppercase tracking-widest'}`}>
                    {skill}
                    {editMode.skills && <button onClick={() => handleRemoveTag(skill, 'skills')} className="text-[var(--text-muted)] hover:text-red-400 transition-colors"><X size={12} /></button>}
                  </div>
                ))}
                {(!profile.skills || profile.skills.length === 0) && !editMode.skills && <span className="text-[12px] text-[var(--text-muted)]">No skills added yet.</span>}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── OBSIDIAN BRAIN MODAL ── */}
      {showBrainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-elevated)] border border-blue-500/30 w-full max-w-3xl flex flex-col max-h-[90vh] mb-[10vh]">
            <div className="p-5 border-b border-blue-500/20 bg-blue-500/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Brain size={14} />
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-[var(--text-primary)] tracking-tight">Train Obsidian Brain</h2>
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mt-0.5">Upload your context to the AI</p>
                </div>
              </div>
              <button onClick={() => setShowBrainModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-auto">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-3">Paste Data (Up to 100k words)</label>
              <textarea 
                className="w-full h-80 bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] p-5 outline-none font-mono resize-none focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                placeholder="Paste your extensive background info, project histories, or raw data here to train the AI..."
                value={brainData}
                onChange={(e) => setBrainData(e.target.value)}
                spellCheck="false"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-3 flex items-center gap-2">
                <Sparkles size={12} className="text-blue-500" />
                This data will be parsed and saved as a markdown context file for your AI.
              </p>
            </div>
            
            <div className="p-5 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2 bg-white/[0.01]">
              <button onClick={() => setShowBrainModal(false)} className="btn btn-outline">
                <X size={14} /> Cancel
              </button>
              <button 
                className="btn btn-primary disabled:opacity-50" 
                onClick={() => { handleSaveBrain(); setShowBrainModal(false); }}
                disabled={isSavingBrain || !brainData.trim()}
              >
                {isSavingBrain ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Save Brain Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LATEX PASTE MODAL ── */}
      {showLatexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] mb-[10vh]">
            <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
                  <Code2 size={14} />
                </div>
                <h2 className="text-[16px] font-bold text-[var(--text-primary)] tracking-tight">Paste LaTeX Resume</h2>
              </div>
              <button onClick={() => setShowLatexModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-auto">
              <p className="text-[13px] text-[var(--text-secondary)] mb-4">Paste your raw LaTeX code here. The engine will compile and use it as your Master Resume.</p>
              <textarea 
                className="w-full h-80 bg-[var(--bg-input)]/60 border border-[var(--border-subtle)] text-[#10B981] font-mono text-[12px] p-5 outline-none resize-none focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                placeholder="\\documentclass[10pt, letterpaper]{article}..."
                value={latexResume}
                onChange={(e) => setLatexResume(e.target.value)}
                spellCheck="false"
              />
            </div>
            
            <div className="p-5 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2 bg-white/[0.01]">
              <button onClick={() => setShowLatexModal(false)} className="btn btn-outline">
                <X size={14} /> Cancel
              </button>
              <button className="btn btn-primary" onClick={() => { handleAutoFill(); setShowLatexModal(false); }}>
                <Check size={14} /> Fetch resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ RESUME PREVIEW SECTION ═══════════════ */}
      <ResumePreviewSection profile={profile} />

      {/* ═══════════════ BRAIN / KNOWLEDGE GRAPH PREVIEW ═══════════════ */}
      <BrainPreviewSection profile={profile} />

      {/* ═══════════════ RAW → STRUCTURED DATA PREVIEW ═══════════════ */}
      <RawDataPreviewSection />

    </div>
  );
}

function SectionHeader({ title, icon: Icon, isEditing, onEdit, onCancel, onSave, onClear, isSaving, colorClass }) {
  return (
    <div className="p-5 border-b border-[var(--border-strong)]/80 bg-transparent flex items-center justify-between group relative overflow-hidden">
      <div className={`absolute left-0 top-0 w-[3px] h-full opacity-50 group-hover:opacity-100 transition-opacity bg-current ${colorClass}`} />
      <div className="flex items-center gap-4 pl-2">
        <div className={`flex items-center justify-center ${colorClass}`}>
          <Icon size={16} />
        </div>
        <h2 className="text-[14px] font-black uppercase tracking-[0.1em] text-[var(--text-primary)]">{title}</h2>
      </div>
      {!isEditing ? (
        <button className="btn btn-primary btn-sm" onClick={onEdit}>
          <Edit3 size={12} /> Edit
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button className="btn btn-destructive btn-sm" onClick={onClear} title="Clear all fields in this section">
            <Trash2 size={12} /> Clear All
          </button>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>
            <X size={12} /> Cancel
          </button>
          <button className="btn btn-primary btn-sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
          </button>
        </div>
      )}
    </div>
  );
}

function PreferredLocationsField({ label, value, isEdit, onChange, icon: Icon }) {
  const [locs, setLocs] = useState(() => (Array.isArray(value) ? value.join(',') : (value || '')).split(',').map(l => l.trim()).filter(Boolean));

  useEffect(() => {
    if (!isEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocs((Array.isArray(value) ? value.join(',') : (value || '')).split(',').map(l => l.trim()).filter(Boolean));
    }
  }, [value, isEdit]);

  if (isEdit) {
    const handleLocationChange = (idx, newVal) => {
      const newLocs = [...locs];
      newLocs[idx] = newVal;
      setLocs(newLocs);
      onChange(newLocs.filter(Boolean).join(', '));
    };

    const addLocation = () => {
      if (locs.length < 5) {
        setLocs([...locs, '']);
      }
    };

    const removeLocation = (idx) => {
      const newLocs = locs.filter((_, i) => i !== idx);
      setLocs(newLocs);
      onChange(newLocs.filter(Boolean).join(', '));
    };

    const renderLocs = locs.length === 0 ? [''] : locs;

    return (
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block">{label}</label>
          <span className="text-[10px] text-[var(--text-muted)] font-bold">{locs.filter(Boolean).length}/5</span>
        </div>
        <div className="space-y-2">
          {renderLocs.map((loc, idx) => (
            <div key={idx} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                {Icon && (
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    <Icon size={14} />
                  </div>
                )}
                <input 
                  className={`w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] py-3 outline-none ${Icon ? 'pl-10 pr-4' : 'px-4'} focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300`}
                  value={loc} 
                  onChange={e => handleLocationChange(idx, e.target.value)} 
                  placeholder={`Location ${idx + 1}...`}
                />
              </div>
              {renderLocs.length > 1 && (
                <button onClick={() => removeLocation(idx)} className="text-[var(--text-muted)] hover:text-red-400 p-2 shrink-0 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {locs.length < 5 && (
            <button onClick={addLocation} className="text-[11px] font-bold uppercase tracking-widest text-[var(--c-primary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 mt-3">
              <Plus size={12} /> Add Location
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-3">{label}</label>
      <div className="flex flex-wrap gap-2">
        {locs.length > 0 ? locs.map((loc, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border-strong)] text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
            {Icon && <Icon size={12} className="text-[var(--text-muted)]" />}
            {loc}
          </span>
        )) : (
          <span className="text-[14px] text-[var(--text-primary)]/30 italic">Not specified</span>
        )}
      </div>
    </div>
  );
}

function ProfileField({ label, value, isEdit, onChange, link, icon: Icon }) {
  if (isEdit) {
    return (
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-3">{label}</label>
        <div className="relative">
          {Icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <Icon size={14} />
            </div>
          )}
          <input 
            className={`w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] py-3 outline-none ${Icon ? 'pl-10 pr-4' : 'px-4'} focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300`}
            value={value || ''} 
            onChange={e => onChange(e.target.value)} 
            placeholder={`Enter ${label.toLowerCase()}...`}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-2">{label}</label>
      {link && value ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors flex items-center gap-2 group whitespace-normal break-all max-w-full">
          <span className="whitespace-normal break-all">{value}</span>
          <LinkIcon size={12} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </a>
      ) : (
        <div className="text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-2">
          {Icon && <Icon size={14} className="text-[var(--text-muted)]" />}
          {value || <span className="text-[var(--text-disabled)] font-mono text-[12px]">Not specified</span>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RESUME PREVIEW SECTION
// ═══════════════════════════════════════════════════════════
function ResumePreviewSection({ profile }) {
  const [expanded, setExpanded] = useState(false);
  const [masterData, setMasterData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/brain?type=master_resume');
      const data = await res.json();
      setMasterData(data);
    } catch (e) {
      // Fallback: show profile data
      setMasterData(null);
    }
    setLoading(false);
  };

  useEffect(() => { if (expanded && !masterData) loadMasterData(); }, [expanded]);

  const data = masterData || {};
  const skills = data.skills || {};
  const experience = data.experience || {};
  const projects = data.key_projects || [];
  const education = data.education || [];

  return (
    <div className="border border-[var(--border-strong)] bg-[var(--bg-surface)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-[var(--bg-base)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText size={16} className="text-emerald-500" />
          <h2 className="text-[14px] font-black uppercase tracking-[0.1em] text-[var(--text-primary)]">Resume Preview</h2>
        </div>
        <span className="text-[12px] text-[var(--text-muted)]">{expanded ? '▲ Collapse' : '▼ Expand'}</span>
      </button>

      {expanded && (
        <div className="p-5 border-t border-[var(--border-strong)] space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" /> Loading resume data...</div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-[#1A2B4A] text-white p-4 rounded">
                <h3 className="text-lg font-bold">{data.header?.name || profile?.first_name + ' ' + (profile?.last_name || '')}</h3>
                <p className="text-sm text-white/70">{data.header?.tagline || profile?.title || 'Professional'}</p>
                <p className="text-xs text-white/50 mt-1">{data.header?.email || profile?.email} | {data.header?.phone || profile?.phone}</p>
              </div>

              {/* Skills */}
              {Object.keys(skills).length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(skills).filter(([k]) => Array.isArray(skills[k])).flatMap(([, arr]) => arr).slice(0, 20).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)]">{s.replace(/\\\\/g, '')}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {Object.keys(experience).length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Experience ({Object.keys(experience).length} entries)</h4>
                  {Object.entries(experience).map(([key, exp]) => (
                    <div key={key} className="mb-2 p-3 bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                      <div className="font-bold text-[13px] text-[var(--text-primary)]">{exp.company_name || key}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{exp.title || exp.role} | {exp.tenure}</div>
                      <div className="text-[10px] text-emerald-500 mt-1">
                        {[exp.bullet1, exp.bullet2, exp.bullet3, exp.bullet4, ...(exp.bullets || [])].filter(Boolean).length} bullets ✓
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Projects */}
              {projects.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Key Projects ({projects.length})</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {projects.map((p, i) => (
                      <div key={i} className="p-2 bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                        <div className="font-bold text-[12px] text-[var(--text-primary)]">{p.name}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{p.subtitle}</div>
                        <div className="text-[10px] text-emerald-500">{p.bullets?.length || 0} bullets</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completeness */}
              <div className="flex flex-wrap gap-2 mt-3">
                {['header', 'skills', 'experience', 'key_projects', 'education', 'page2'].map(field => (
                  <span key={field} className={`px-2 py-1 text-[10px] font-bold rounded ${
                    data[field] && (Array.isArray(data[field]) ? data[field].length > 0 : Object.keys(data[field]).length > 0)
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {data[field] ? '✓' : '✗'} {field}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BRAIN / KNOWLEDGE GRAPH PREVIEW
// ═══════════════════════════════════════════════════════════
function BrainPreviewSection({ profile }) {
  const [expanded, setExpanded] = useState(false);
  const [brainStats, setBrainStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  const loadBrainStats = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/brain?type=stats');
      const data = await res.json();
      setBrainStats(data);
    } catch (e) {
      setBrainStats(null);
    }
    setLoading(false);
  };

  useEffect(() => { if (expanded && !brainStats) loadBrainStats(); }, [expanded]);

  const stats = brainStats || {};
  const tabs = ['overview', 'projects', 'skills', 'experience', 'graph'];

  return (
    <div className="border border-[var(--border-strong)] bg-[var(--bg-surface)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-[var(--bg-base)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Brain size={16} className="text-purple-500" />
          <h2 className="text-[14px] font-black uppercase tracking-[0.1em] text-[var(--text-primary)]">Obsidian Brain & Knowledge Graph</h2>
        </div>
        <span className="text-[12px] text-[var(--text-muted)]">{expanded ? '▲ Collapse' : '▼ Expand'}</span>
      </button>

      {expanded && (
        <div className="p-5 border-t border-[var(--border-strong)]">
          {loading ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" /> Loading brain data...</div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-4 border-b border-[var(--border-subtle)]">
                {tabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      activeTab === tab
                        ? 'text-purple-500 border-b-2 border-purple-500'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Projects', value: stats.projects?.length || 0, color: 'text-blue-500' },
                    { label: 'Skills', value: stats.skillCount || 0, color: 'text-green-500' },
                    { label: 'Experience', value: stats.experience?.length || 0, color: 'text-orange-500' },
                    { label: 'Domains', value: stats.domainCount || 0, color: 'text-purple-500' },
                    { label: 'KG Nodes', value: stats.kgNodes || 0, color: 'text-cyan-500' },
                    { label: 'KG Edges', value: stats.kgEdges || 0, color: 'text-pink-500' },
                    { label: 'Keywords', value: stats.keywordCount || 0, color: 'text-amber-500' },
                    { label: 'Achievements', value: stats.achievementCount || 0, color: 'text-emerald-500' },
                  ].map(stat => (
                    <div key={stat.label} className="p-3 bg-[var(--bg-base)] border border-[var(--border-subtle)] text-center">
                      <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Projects Tab */}
              {activeTab === 'projects' && stats.projects && (
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {stats.projects.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[12px]">
                      <div>
                        <span className="font-bold text-[var(--text-primary)]">{p.name}</span>
                        <span className="text-[var(--text-muted)] ml-2">{p.subtitle}</span>
                      </div>
                      <div className="flex gap-1">
                        {p.domain && <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-500 text-[9px] font-bold rounded">{p.domain}</span>}
                        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 text-[9px] font-bold rounded">{p.bullets?.length || 0}b</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills Tab */}
              {activeTab === 'skills' && stats.skillBlocks && (
                <div className="space-y-3">
                  {Object.entries(stats.skillBlocks).map(([block, skillStr]) => (
                    <div key={block}>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">{block}</h5>
                      <div className="flex flex-wrap gap-1">
                        {(typeof skillStr === 'string' ? skillStr.split(',') : []).map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)]">{s.trim()}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Experience Tab */}
              {activeTab === 'experience' && stats.experience && (
                <div className="space-y-2">
                  {stats.experience.map((exp, i) => (
                    <div key={i} className="p-3 bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                      <div className="font-bold text-[13px] text-[var(--text-primary)]">{exp.company}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{exp.role || exp.title} | {exp.tenure || exp.period}</div>
                      <div className="text-[10px] text-emerald-500 mt-1">{exp.bullets?.length || 0} bullets | {exp.achievements?.length || 0} achievements | Tags: {exp.tags?.join(', ') || 'none'}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Graph Tab */}
              {activeTab === 'graph' && (
                <div className="p-4 bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                  <div className="text-center">
                    <div className="text-3xl font-black text-purple-500">{stats.kgNodes || 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Nodes</div>
                    <div className="text-xl font-black text-pink-500 mt-2">{stats.kgEdges || 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Edges</div>
                  </div>
                  {stats.kgNodesByType && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {Object.entries(stats.kgNodesByType).map(([type, count]) => (
                        <div key={type} className="text-center p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                          <div className="text-lg font-bold text-[var(--text-primary)]">{count}</div>
                          <div className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">{type}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] mt-3 text-center">Built: {stats.kgBuiltAt || 'Not built'}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RAW → STRUCTURED DATA PREVIEW
// ═══════════════════════════════════════════════════════════
function RawDataPreviewSection() {
  const [expanded, setExpanded] = useState(false);
  const [rawText, setRawText] = useState('');
  const [structured, setStructured] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processRawData = async () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    try {
      const res = await apiFetch('/api/ai/ingest-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText })
      });
      const data = await res.json();
      setStructured(data.brain || data);
    } catch (e) {
      toast.error('Failed to process raw data');
    }
    setIsProcessing(false);
  };

  return (
    <div className="border border-[var(--border-strong)] bg-[var(--bg-surface)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-[var(--bg-base)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Code2 size={16} className="text-amber-500" />
          <h2 className="text-[14px] font-black uppercase tracking-[0.1em] text-[var(--text-primary)]">Raw → Structured Data Preview</h2>
        </div>
        <span className="text-[12px] text-[var(--text-muted)]">{expanded ? '▲ Collapse' : '▼ Expand'}</span>
      </button>

      {expanded && (
        <div className="p-5 border-t border-[var(--border-strong)]">
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Raw Input */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Raw Input</h4>
              <textarea
                className="w-full h-[300px] bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[12px] p-3 font-mono outline-none resize-none"
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Paste raw profile text, resume content, or Obsidian notes here..."
              />
              <button 
                className="btn btn-primary btn-sm mt-2 w-full"
                onClick={processRawData}
                disabled={isProcessing || !rawText.trim()}
              >
                {isProcessing ? <><Loader2 size={12} className="animate-spin" /> Processing...</> : <><Sparkles size={12} /> Structure & Organize</>}
              </button>
            </div>

            {/* Right: Structured Output */}
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Structured Output</h4>
              <div className="h-[300px] bg-[var(--bg-base)] border border-[var(--border-subtle)] p-3 overflow-auto text-[12px]">
                {structured ? (
                  <div className="space-y-3">
                    {structured.profile && (
                      <div>
                        <div className="text-[10px] font-bold uppercase text-emerald-500 mb-1">✓ Profile</div>
                        <div className="text-[var(--text-primary)] font-bold">{structured.profile.name}</div>
                        <div className="text-[var(--text-muted)]">{structured.profile.title}</div>
                        <div className="text-[var(--text-muted)]">{structured.profile.core_identity}</div>
                      </div>
                    )}
                    {structured.projects?.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase text-blue-500 mb-1">✓ {structured.projects.length} Projects</div>
                        {structured.projects.slice(0, 5).map((p, i) => (
                          <div key={i} className="text-[11px] text-[var(--text-secondary)]">• {p.name} ({p.bullets?.length || 0} bullets)</div>
                        ))}
                      </div>
                    )}
                    {structured.experience_detailed?.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase text-orange-500 mb-1">✓ {structured.experience_detailed.length} Experience Entries</div>
                        {structured.experience_detailed.map((e, i) => (
                          <div key={i} className="text-[11px] text-[var(--text-secondary)]">• {e.company} ({e.bullets?.length || 0} bullets)</div>
                        ))}
                      </div>
                    )}
                    {structured.keyword_index && (
                      <div className="text-[10px] font-bold uppercase text-purple-500">✓ {Object.keys(structured.keyword_index).length} Keywords Indexed</div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-[12px]">
                    Paste raw data and click "Structure & Organize" to see the result
                  </div>
                )}
              </div>
              {structured && (
                <button
                  className="btn btn-primary btn-sm mt-2 w-full"
                  onClick={async () => {
                    try {
                      await apiFetch('/api/brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: JSON.stringify(structured) }) });
                      toast.success('Structured data saved to brain');
                    } catch (e) { toast.error('Failed to save'); }
                  }}
                >
                  <Check size={12} /> Save to Brain
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

