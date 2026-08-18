"use client";

import React, { useState, useEffect } from "react";
import {
  Target,
  FileText,
  Mail,
  X,
  CheckCircle,
  Loader2,
  Sparkles,
  Link2,
  AlertCircle,
  ArrowRight,
  Download,
  Copy,
  ScanLine,
  BrainCircuit,
  Bot,
  FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/utils/apiFetch';

const BUILD_STEPS = [
  { id: "analyze", label: "Analyzing Requirements", sublabel: "Extracting JD semantics & ATS keywords", icon: ScanLine, duration: 2500 },
  { id: "brain", label: "Syncing Obsidian Brain", sublabel: "Retrieving top projects & experience", icon: BrainCircuit, duration: 3000 },
  { id: "agents", label: "Executing AI Agents", sublabel: "Drafting tailored content in parallel", icon: Bot, duration: 5000 },
  { id: "compile", label: "Compiling Artifacts", sublabel: "Generating PDFs and verifying formats", icon: FileCheck, duration: 2500 }
];

export default function BuildEngineModal({ isOpen, onClose }) {
  const [step, setStep] = useState("input"); // input, configure, processing, results
  const [jdText, setJdText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleType, setRoleType] = useState("");
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  
  const [outputs, setOutputs] = useState({
    resume: true,
    cover_letter: true,
    email: true
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);

  // Escape to close
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && !isProcessing) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [onClose, isProcessing]);

  if (!isOpen) return null;

  const toggleOutput = (key) => setOutputs(prev => ({ ...prev, [key]: !prev[key] }));

  const handleBuild = async () => {
    const selectedOutputs = Object.keys(outputs).filter(k => outputs[k]);
    if (selectedOutputs.length === 0) {
      toast.error("Please select at least one output to generate.");
      return;
    }

    setStep("processing");
    setIsProcessing(true);
    setError(null);
    setPipelineStep(0);
    setProgressWidth(0);
    setPipelineComplete(false);

    let isCancelled = false;
    const animatePipeline = async () => {
      for (let i = 0; i < BUILD_STEPS.length; i++) {
        if (isCancelled) break;
        setPipelineStep(i);
        const startPct = (i / BUILD_STEPS.length) * 100;
        const endPct = ((i + 1) / BUILD_STEPS.length) * 100;
        const duration = BUILD_STEPS[i].duration;
        const steps = 30;
        const increment = (endPct - startPct) / steps;
        
        for (let s = 0; s < steps; s++) {
          if (isCancelled) break;
          await new Promise(r => setTimeout(r, duration / steps));
          setProgressWidth(prev => Math.min(prev + increment, endPct));
        }
      }
      if (!isCancelled) {
        setPipelineComplete(true);
      }
    };
    
    animatePipeline();

    try {
      const res = await apiFetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_text: jdText,
          company_name: companyName,
          role_type: roleType,
          recruiter_name: recruiterName,
          recruiter_email: recruiterEmail,
          outputs: selectedOutputs
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run build engine");

      isCancelled = true;
      setProgressWidth(100);
      setPipelineStep(BUILD_STEPS.length);
      setPipelineComplete(true);

      setTimeout(() => {
        setResults(data);
        setStep("results");
        setIsProcessing(false);
      }, 600);
    } catch (err) {
      isCancelled = true;
      setError(err.message);
      setStep("configure");
      setIsProcessing(false);
    }
  };

  const handleCopyEmail = () => {
    if (results?.outputs?.email) {
      // Strip HTML tags for clipboard (simple version)
      const text = results.outputs.email.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n\n').trim();
      navigator.clipboard.writeText(text);
      toast.success("Email drafted copied to clipboard");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 ease-out"
      onClick={() => { if (!isProcessing) onClose(); }}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="w-full max-w-4xl flex flex-col relative bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] shadow-none rounded-none overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
          style={{ minHeight: "70vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)] uppercase flex items-center gap-3">
                <Sparkles className="text-[var(--c-primary)]" size={24} /> Document Generation Engine
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1 font-bold tracking-widest uppercase">
                End-to-End Autonomous Output
              </p>
            </div>
            <button 
              onClick={onClose} 
              disabled={isProcessing}
              className="w-10 h-10 flex items-center justify-center border-2 border-transparent hover:border-[var(--border-strong)] rounded-none transition-colors disabled:opacity-50"
            >
              <X size={20} className="text-[var(--text-secondary)]" />
            </button>
          </div>

          {error && (
            <div className="mx-8 mt-6 p-4 bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs font-bold tracking-widest uppercase">
              <AlertCircle size={16} className="shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            
            {/* STEP 1: INPUT */}
            {step === "input" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Company Name</label>
                    <input
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] outline-none py-3 px-4 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--text-primary)] rounded-none"
                      placeholder="e.g. Acme Corp"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Role Title</label>
                    <input
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] outline-none py-3 px-4 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--text-primary)] rounded-none"
                      placeholder="e.g. Senior Product Manager"
                      value={roleType}
                      onChange={(e) => setRoleType(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Recruiter Name (Optional)</label>
                    <input
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] outline-none py-3 px-4 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--text-primary)] rounded-none"
                      placeholder="e.g. John Doe"
                      value={recruiterName}
                      onChange={(e) => setRecruiterName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Recruiter Email (Optional)</label>
                    <input
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] outline-none py-3 px-4 text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--text-primary)] rounded-none"
                      placeholder="e.g. john@acme.com"
                      value={recruiterEmail}
                      onChange={(e) => setRecruiterEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2 flex flex-col pt-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] flex justify-between">
                    <span>Job Description (Required)</span>
                  </label>
                  <textarea
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-strong)] outline-none p-4 min-h-[250px] resize-none text-sm font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--text-primary)] rounded-none custom-scrollbar"
                    placeholder="Paste the full JD here..."
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  />
                </div>

              </div>
            )}

            {/* STEP 2: CONFIGURE OUTPUTS */}
            {step === "configure" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center">
                  <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight uppercase">
                    Select Target Outputs
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] font-bold tracking-widest uppercase mt-2">
                    Choose which documents the engine should generate
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
                  {/* Resume */}
                  <div 
                    onClick={() => toggleOutput('resume')}
                    className={`cursor-pointer border-2 p-6 transition-all rounded-none ${outputs.resume ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <Target size={24} />
                      {outputs.resume && <CheckCircle size={20} />}
                    </div>
                    <h4 className="font-black tracking-widest uppercase text-sm mb-2">Tailored Resume</h4>
                    <p className={`text-xs ${outputs.resume ? 'text-[var(--bg-base)]/80' : 'text-[var(--text-tertiary)]'}`}>ATS-optimized PDF tailored exactly to the JD</p>
                  </div>

                  {/* Cover Letter */}
                  <div 
                    onClick={() => toggleOutput('cover_letter')}
                    className={`cursor-pointer border-2 p-6 transition-all rounded-none ${outputs.cover_letter ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <FileText size={24} />
                      {outputs.cover_letter && <CheckCircle size={20} />}
                    </div>
                    <h4 className="font-black tracking-widest uppercase text-sm mb-2">Cover Letter</h4>
                    <p className={`text-xs ${outputs.cover_letter ? 'text-[var(--bg-base)]/80' : 'text-[var(--text-tertiary)]'}`}>Personalized narrative matching selected projects</p>
                  </div>

                  {/* Email */}
                  <div 
                    onClick={() => toggleOutput('email')}
                    className={`cursor-pointer border-2 p-6 transition-all rounded-none ${outputs.email ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <Mail size={24} />
                      {outputs.email && <CheckCircle size={20} />}
                    </div>
                    <h4 className="font-black tracking-widest uppercase text-sm mb-2">Email Draft</h4>
                    <p className={`text-xs ${outputs.email ? 'text-[var(--bg-base)]/80' : 'text-[var(--text-tertiary)]'}`}>Direct-to-recruiter pitch email</p>
                  </div>
                </div>

              </div>
            )}

            {/* STEP 3: PROCESSING PIPELINE */}
            {step === "processing" && (
              <div className="flex flex-col min-h-[55vh] p-8 bg-[#050505] text-white/90 border border-white/10 rounded-none shadow-2xl my-4 mx-2">
                {/* Header Dashboard Bar */}
                <div className="mb-10 flex flex-col gap-6 border-b border-white/10 pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/5 rounded-none border border-white/10 flex items-center justify-center">
                        <Sparkles className="text-white/80 animate-pulse" size={20} />
                      </div>
                      <h3 className="text-lg font-medium tracking-[0.2em] uppercase text-white/90">
                        Igniting Engines
                      </h3>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xs font-semibold text-white/40 tracking-widest uppercase">
                        Status: {pipelineComplete ? "Online" : "Processing"}
                      </div>
                      <div className="text-xs font-bold text-[#10B981] tracking-widest uppercase px-4 py-2 bg-[#10B981]/10 border border-[#10B981]/20 rounded-none">
                        {Math.round(progressWidth)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-1 bg-white/5 rounded-none overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-[#10B981] transition-all duration-300 ease-out shadow-[0_0_10px_#10B981]" 
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Left: Sequential Pipeline List */}
                  <div className="md:col-span-5 flex flex-col justify-center space-y-3">
                    {BUILD_STEPS.map((ps, i) => {
                      const isActive = pipelineStep === i && !pipelineComplete;
                      const isDone = pipelineStep > i || pipelineComplete;
                      const StepIcon = ps.icon;
                      
                      return (
                        <div key={ps.id} className={`flex items-center gap-4 p-4 rounded-none border transition-all duration-500 ease-out ${
                          isActive 
                            ? "bg-white/5 border-white/20 shadow-lg -translate-y-1" 
                            : isDone
                              ? "bg-transparent border-white/5 opacity-80"
                              : "bg-transparent border-transparent opacity-40"
                        }`}>
                           <div className={`flex items-center justify-center w-8 h-8 ${isActive ? "text-white" : isDone ? "text-[#10B981]" : "text-white/30"}`}>
                              {isDone ? <CheckCircle size={20} /> : isActive ? <Loader2 size={20} className="animate-spin" /> : <StepIcon size={20} />}
                           </div>
                           <div className="flex-1">
                             <div className={`text-xs font-semibold uppercase tracking-widest ${isActive ? "text-white" : isDone ? "text-white/80" : "text-white/40"}`}>
                               {ps.label}
                             </div>
                           </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Right: Active Process HUD */}
                  <div className="md:col-span-7 flex flex-col items-center justify-center border border-white/10 rounded-none bg-[#0A0A0A] relative overflow-hidden min-h-[400px]">
                    {/* Architectural Grid Pattern (Ultra-dark) */}
                    <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '32px 32px', backgroundPosition: '-16px -16px' }}></div>
                    
                    {/* Scanning Line overlay */}
                    {!pipelineComplete && (
                      <div className="absolute top-0 left-0 right-0 h-[1px] bg-[#10B981] shadow-[0_0_15px_#10B981] z-20 animate-[scan_3s_ease-in-out_infinite]" />
                    )}
                    
                    {BUILD_STEPS.map((ps, i) => {
                      const isActive = pipelineStep === i && !pipelineComplete;
                      if (!isActive && !pipelineComplete) return null;
                      if (pipelineComplete && i !== BUILD_STEPS.length - 1) return null;
                      
                      const StepIcon = ps.icon;
                      const displayDone = pipelineComplete;

                      return (
                        <div key={`hud-${ps.id}`} className="relative z-10 flex flex-col items-center text-center p-8 animate-in zoom-in-95 duration-700">
                          
                          {/* Clean Engine Core Graphic */}
                          <div className={`relative flex items-center justify-center w-48 h-48 mb-8 rounded-none border transition-colors duration-700 ${
                            displayDone ? 'border-[#10B981]/50 bg-[#10B981]/5 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/10 animate-[spin_20s_linear_infinite]'
                          }`}>
                            <div className={`absolute inset-0 flex items-center justify-center border border-white/5 rounded-none scale-75 ${!displayDone ? 'animate-[spin_12s_linear_infinite_reverse]' : ''}`} />
                            
                            <div className={`absolute inset-0 flex items-center justify-center ${!displayDone ? 'animate-[spin_20s_linear_infinite_reverse]' : ''}`}>
                              {displayDone ? (
                                <CheckCircle size={56} className="text-[#10B981] animate-in zoom-in duration-500" />
                              ) : (
                                <StepIcon size={48} className="text-white/80 animate-pulse" />
                              )}
                            </div>
                          </div>
                          
                          {/* Process Metadata */}
                          <div className="flex flex-col items-center">
                            <h4 className={`text-sm font-medium tracking-[0.2em] uppercase mb-2 ${displayDone ? 'text-[#10B981]' : 'text-white'}`}>
                              {displayDone ? "Operations Complete" : ps.label}
                            </h4>
                            <p className="text-[10px] font-medium text-white/40 tracking-widest uppercase">
                              {displayDone ? "All artifacts generated and verified" : ps.sublabel}
                            </p>
                          </div>

                          {/* Data Stream Indicators */}
                          {!displayDone && (
                            <div className="mt-10 flex gap-2">
                              {[1,2,3,4,5].map(d => (
                                <div key={d} className="w-1.5 h-1.5 rounded-none bg-white/40 animate-pulse" style={{ animationDelay: `${d*150}ms` }} />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: RESULTS */}
            {step === "results" && results && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Header Metrics */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-[var(--bg-elevated)] p-6 border-t-2 border-[var(--c-primary)] rounded-none shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Final ATS Score</span>
                    <span className="text-4xl font-black text-[var(--c-primary)]">{results.metrics?.finalScore || 90}%</span>
                    <span className="text-xs text-emerald-500 font-bold mt-2">+{results.metrics?.improvement || 0}% Increase</span>
                  </div>
                  <div className="bg-[var(--bg-elevated)] p-6 border-t-2 border-[#8B5CF6] rounded-none shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Keyword Match</span>
                    <span className="text-4xl font-black text-[var(--text-primary)]">{results.metrics?.keywordMatch || 85}%</span>
                  </div>
                  <div className="bg-[var(--bg-elevated)] p-6 border-t-2 border-[#F59E0B] rounded-none shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Skills Coverage</span>
                    <span className="text-4xl font-black text-[var(--text-primary)]">{results.metrics?.skillsCoverage || 95}%</span>
                  </div>
                  <div className="bg-[var(--bg-elevated)] p-6 border-t-2 border-[#10B981] rounded-none shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Project Relevance</span>
                    <span className="text-4xl font-black text-[var(--text-primary)]">{results.metrics?.projectRelevance || 92}%</span>
                  </div>
                </div>

                {/* Outputs Panel */}
                <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-8">
                  <h3 className="text-sm font-black tracking-widest uppercase text-[var(--text-primary)] border-b border-[var(--border-strong)] pb-4 mb-6">
                    Generated Outputs
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Resume */}
                    {results.outputs.resume && (
                      <div className="border border-[var(--border-strong)] p-6 flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                          <Target className="text-[var(--c-primary)]" size={24} />
                          <span className="font-bold tracking-widest uppercase text-sm">Tailored Resume</span>
                        </div>
                        <a 
                          href={results.outputs.resume.replace('./public', '')} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-auto w-full border border-[var(--text-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-base)] transition-colors flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest"
                        >
                          <Download size={16} /> Download PDF
                        </a>
                      </div>
                    )}

                    {/* Cover Letter */}
                    {results.outputs.coverLetter && (
                      <div className="border border-[var(--border-strong)] p-6 flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                          <FileText className="text-[var(--c-primary)]" size={24} />
                          <span className="font-bold tracking-widest uppercase text-sm">Cover Letter</span>
                        </div>
                        <a 
                          href={results.outputs.coverLetter.replace('./public', '')} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-auto w-full border border-[var(--text-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-base)] transition-colors flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest"
                        >
                          <Download size={16} /> Download PDF
                        </a>
                      </div>
                    )}

                    {/* Email Draft */}
                    {results.outputs.email && (
                      <div className="border border-[var(--border-strong)] p-6 flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                          <Mail className="text-[var(--c-primary)]" size={24} />
                          <span className="font-bold tracking-widest uppercase text-sm">Email Draft</span>
                        </div>
                        <button 
                          onClick={handleCopyEmail}
                          className="mt-auto w-full border border-[var(--text-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-base)] transition-colors flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest"
                        >
                          <Copy size={16} /> Copy to Clipboard
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>
          
          {/* Fixed Footer Actions */}
          {step !== "processing" && (
            <div className="border-t border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6 px-8 flex items-center justify-between shrink-0">
              {step === "input" && (
                <>
                  <div />
                  <button
                    onClick={() => {
                      if (!jdText.trim()) return toast.error("Job Description is required");
                      setStep("configure");
                    }}
                    className="bg-[var(--text-primary)] text-[var(--bg-base)] px-8 py-3 font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:opacity-90 transition-opacity rounded-none"
                  >
                    Next Step <ArrowRight size={16} />
                  </button>
                </>
              )}
              {step === "configure" && (
                <>
                  <button
                    onClick={() => setStep("input")}
                    className="text-[var(--text-secondary)] px-6 py-3 font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-strong)] rounded-none"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleBuild}
                    className="bg-[var(--c-primary)] text-[var(--bg-base)] px-8 py-3 font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:brightness-110 transition-all rounded-none"
                  >
                    <Sparkles size={16} /> Ignite Engine
                  </button>
                </>
              )}
              {step === "results" && (
                <>
                  <div />
                  <button
                    onClick={onClose}
                    className="bg-[var(--text-primary)] text-[var(--bg-base)] px-8 py-3 font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:opacity-90 transition-opacity rounded-none"
                  >
                    Finish
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
