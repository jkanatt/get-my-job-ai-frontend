"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { brand } from '@/config/brand.config';
import { toast } from "sonner";
import { apiFetch } from "@/shared/utils/apiFetch";
import {
  X,
  Loader2,
  Sparkles,
  RefreshCw,
  Send,
  CheckCircle,
  AlertCircle,
  Maximize2,
  Minimize2,
  Wand2,
  Check,
  ShieldAlert
} from "lucide-react";

export default function FormApplyModal({ job, onClose }) {
  const [step, setStep] = useState("loading"); // loading, review, submitting, success
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState(null);
  
  // Field-level AI processing states
  const [processingField, setProcessingField] = useState(null); // { index: 0, action: 'rephrase' }
  const [validationResult, setValidationResult] = useState(null); // { valid: true/false, errors: [], warnings: [] }
  const [isValidating, setIsValidating] = useState(false);

  let meta = null;
  if (job?.skills?.length > 0) {
    try {
      const parsed = typeof job.skills[0] === 'string' ? JSON.parse(job.skills[0]) : job.skills[0];
      if (parsed && parsed._meta) meta = parsed;
    } catch (e) {}
  }
  
  const formUrl = meta?.form_link || (job?.url !== "manual" ? job?.url : "");

  useEffect(() => {
    if (!formUrl) {
      setTimeout(() => {
        setError("No valid form URL found for this job.");
        setStep("review");
      }, 0);
      return;
    }

    const loadFormPreview = async () => {
      try {
        const res = await apiFetch("/api/forms/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: formUrl }),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load form preview");
        
        // Transform formData.mappings to formData.fields so the UI binds seamlessly
        // API preview returns { url, mappings: [ { name, type, required, proposed_answer, ... } ] }
        const parsedData = {
           url: data.preview.url,
           fields: data.preview.mappings.map(m => ({
               label: m.name,
               type: m.type,
               required: m.required,
               value: m.proposed_answer,
               confidence: m.confidence_score,
               reasoning: m.reasoning,
               options: m.options || []
           }))
        };

        setFormData(parsedData);
        setStep("review");
      } catch (err) {
        console.error(err);
        setError(err.message);
        setStep("review");
      }
    };

    loadFormPreview();
  }, [formUrl]);

  const handleFieldChange = (index, newValue) => {
    const updated = { ...formData };
    updated.fields[index].value = newValue;
    setFormData(updated);
  };

  const callAiEndpoint = async (endpoint, index, field) => {
    setProcessingField({ index, action: endpoint });
    try {
      const res = await apiFetch(`/api/forms/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: endpoint,
          answer: field.value || '',
          question: field.label, 
          context: job?.title + " at " + job?.company 
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      const updated = { ...formData };
      updated.fields[index].value = data.suggested_answer;
      updated.fields[index].confidence = data.confidence_score;
      updated.fields[index].reasoning = data.reasoning;
      setFormData(updated);
    } catch (err) {
      toast.error(`Failed to ${endpoint}: ` + err.message);
    } finally {
      setProcessingField(null);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await apiFetch("/api/forms/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: 'validate',
          fields: formData.fields,
          context: job?.title + " at " + job?.company 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setValidationResult(data);
    } catch (err) {
      toast.error("Validation failed: " + err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    setStep("submitting");
    try {
      const res = await apiFetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      
      setStep("success");
    } catch (err) {
      console.error(err);
      setError(err.message);
      setStep("review");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-0 sm:p-4 md:p-8">
      <div className="bg-[var(--bg-base)] border-2 border-[var(--border-strong)] shadow-none rounded-none w-full h-full flex flex-col relative overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-strong)] bg-[var(--bg-surface)] shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-none bg-[var(--c-primary)] flex items-center justify-center text-black">
                <Sparkles size={16} />
              </div>
              <h2 className="text-[20px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                AI Application Workspace
              </h2>
            </div>
            <div className="text-[13px] font-mono text-[var(--text-muted)] mt-1 flex items-center gap-2">
              <span className="text-[var(--text-primary)] font-bold">{job?.title}</span> @ {job?.company}
              <span className="opacity-50">|</span>
              <a href={formUrl} target="_blank" className="hover:text-white hover:underline transition-colors">{formUrl}</a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-transparent hover:border-[var(--border-strong)]"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-[var(--bg-base)] relative">
          
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center m-auto">
              <Loader2 className="w-16 h-16 text-[var(--c-primary)] animate-spin" />
              <div>
                <div className="text-[20px] font-black uppercase tracking-wider text-[var(--text-primary)] mb-2">Analyzing ATS Form</div>
                <div className="text-[14px] text-[var(--text-muted)] max-w-md mx-auto font-mono">
                  Loading {formUrl}, extracting schemas, mapping constraints, and aligning with Brain data...
                </div>
              </div>
            </div>
          )}

          {step === "submitting" && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center m-auto">
              <Loader2 className="w-16 h-16 text-[var(--c-accent)] animate-spin" />
              <div>
                <div className="text-[20px] font-black uppercase tracking-wider text-[var(--text-primary)] mb-2">Executing Submission</div>
                <div className="text-[14px] text-[var(--text-muted)] max-w-md mx-auto font-mono">
                  Puppeteer is actively navigating the DOM, inserting values, and bypassing ATS validation hooks...
                </div>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center m-auto">
              <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-500 mb-2">
                <CheckCircle size={40} />
              </div>
              <div>
                <h3 className="text-[28px] font-black text-[var(--text-primary)] uppercase tracking-wider mb-2">Payload Delivered</h3>
                <p className="text-[var(--text-muted)] text-[14px] font-mono">
                  The AI form engine successfully completed and submitted the application to {job?.company}.
                </p>
              </div>
              <button onClick={onClose} className="btn-brutal bg-[var(--text-primary)] text-[var(--bg-base)] mt-8 px-12 py-4 text-[16px]">
                RETURN TO DASHBOARD
              </button>
            </div>
          )}

          {step === "review" && (
            <div className="flex w-full h-full">
              
              {/* Left Panel: Form Fields */}
              <div className="flex-1 p-8 overflow-y-auto">
                {error && (
                  <div className="mb-8 p-4 border border-red-500/50 bg-red-500/10 text-red-400 flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 shrink-0" />
                    <div>
                      <div className="font-bold text-[14px] uppercase tracking-wider mb-1">System Error</div>
                      <span className="text-[13px] font-mono">{error}</span>
                    </div>
                  </div>
                )}

                {formData?.fields ? (
                  <div className="space-y-8 max-w-3xl mx-auto">
                    {formData.fields.map((field, idx) => (
                      <div key={idx} className="group flex flex-col p-6 border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--text-primary)] transition-colors relative">
                        
                        {/* Field Header */}
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <label className="text-[16px] font-bold text-[var(--text-primary)] leading-snug">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <div className="text-[11px] text-[var(--text-muted)] font-mono px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)]">
                            {field.type.toUpperCase()}
                          </div>
                        </div>

                        {/* Input Area */}
                        {field.type === "textarea" ? (
                          <textarea
                            value={field.value || ""}
                            onChange={(e) => handleFieldChange(idx, e.target.value)}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-4 text-[14px] text-[var(--text-primary)] outline-none )] min-h-[140px] resize-y focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                            placeholder="Your answer..."
                          />
                        ) : field.type === "radio" || field.type === "checkbox" || field.type === "select" ? (
                          <select
                            value={field.value || ""}
                            onChange={(e) => handleFieldChange(idx, e.target.value)}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-4 text-[14px] text-[var(--text-primary)] outline-none )] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                          >
                            <option value="">Select option...</option>
                            {field.options?.map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                            {field.value && !field.options?.includes(field.value) && (
                              <option value={field.value}>{field.value} (Custom Input)</option>
                            )}
                          </select>
                        ) : (
                          <input
                            type={field.type === "email" ? "email" : "text"}
                            value={field.value || ""}
                            onChange={(e) => handleFieldChange(idx, e.target.value)}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-4 text-[14px] text-[var(--text-primary)] outline-none )] focus:border-[var(--text-secondary)] focus:ring-0 focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] transition-all ease-out duration-300"
                            placeholder="Your answer..."
                          />
                        )}

                        {/* Reasoning / Confidence Badge */}
                        {(field.confidence || field.reasoning) && (
                           <div className="mt-3 flex items-start gap-3">
                              {field.confidence && (
                                <div className={`shrink-0 text-[10px] font-bold px-2 py-1 flex items-center gap-1 border ${field.confidence > 80 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/30 text-amber-400 bg-amber-500/10'}`}>
                                   {field.confidence}% Match
                                </div>
                              )}
                              {field.reasoning && (
                                <div className="text-[12px] text-[var(--text-muted)] italic">
                                  {field.reasoning}
                                </div>
                              )}
                           </div>
                        )}

                        {/* Floating Action Bar (visible on hover) */}
                        <div className="absolute -bottom-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-[var(--bg-base)] border-2 border-[var(--border-strong)] shadow-none rounded-none p-1 gap-1">
                          {[
                            { id: 'improve', icon: Wand2, label: 'Improve' },
                            { id: 'expand', icon: Maximize2, label: 'Expand' },
                            { id: 'shorten', icon: Minimize2, label: 'Shorten' },
                            { id: 'rephrase', icon: RefreshCw, label: 'Rephrase' },
                            { id: 'regenerate', icon: Sparkles, label: 'Regenerate' },
                          ].map(action => (
                            <button
                              key={action.id}
                              onClick={() => callAiEndpoint(action.id, idx, field)}
                              disabled={processingField?.index === idx}
                              className="p-2 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] text-[var(--text-muted)] transition-colors flex items-center justify-center relative group/btn"
                              title={action.label}
                            >
                              {processingField?.index === idx && processingField?.action === action.id ? (
                                <Loader2 size={16} className="animate-spin text-[var(--c-primary)]" />
                              ) : (
                                <action.icon size={16} />
                              )}
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[10px] font-bold uppercase px-2 py-1 opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap">
                                {action.label}
                              </span>
                            </button>
                          ))}
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  !error && <div className="text-center text-[var(--text-muted)] mt-24 font-mono">No valid fields extracted from payload.</div>
                )}
              </div>

              {/* Right Panel: Validation & Submit */}
              <div className="w-80 border-l border-[var(--border-strong)] bg-[var(--bg-surface)] flex flex-col shrink-0">
                <div className="p-6 border-b border-[var(--border-strong)] bg-[var(--bg-elevated)]">
                  <h3 className="text-[14px] font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                    <ShieldAlert size={16} /> Pre-Flight Checks
                  </h3>
                  <p className="text-[12px] text-[var(--text-muted)] font-mono mt-2">
                    Run AI validation to ensure formatting, consistency, and mandatory constraints are met before dispatch.
                  </p>
                  <button 
                    onClick={handleValidate} 
                    disabled={isValidating || !formData?.fields}
                    className="w-full mt-4 btn-brutal bg-[var(--bg-base)] text-[var(--text-primary)] py-2 text-[12px] font-bold flex items-center justify-center gap-2 border border-[var(--border-strong)]"
                  >
                    {isValidating ? <><Loader2 size={14} className="animate-spin"/> Running Audit...</> : "RUN AUDIT"}
                  </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                   {validationResult ? (
                     <div className="space-y-6">
                        {validationResult.valid ? (
                          <div className="p-4 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-3">
                             <Check size={20} />
                             <span className="text-[13px] font-bold uppercase tracking-wider">All Checks Passed</span>
                          </div>
                        ) : (
                          <div className="p-4 border border-red-500/30 bg-red-500/10 text-red-400">
                             <div className="font-bold text-[13px] uppercase tracking-wider mb-2 flex items-center gap-2">
                               <AlertCircle size={16} /> Validation Failed
                             </div>
                             <ul className="list-disc pl-5 text-[12px] space-y-1">
                               {validationResult.errors?.map((err, i) => (
                                 <li key={i}>{err}</li>
                               ))}
                             </ul>
                          </div>
                        )}

                        {validationResult.warnings?.length > 0 && (
                          <div className="p-4 border border-amber-500/30 bg-amber-500/10 text-amber-400">
                             <div className="font-bold text-[12px] uppercase tracking-wider mb-2">Warnings</div>
                             <ul className="list-disc pl-5 text-[12px] space-y-1">
                               {validationResult.warnings.map((warn, i) => (
                                 <li key={i}>{warn}</li>
                               ))}
                             </ul>
                          </div>
                        )}
                     </div>
                   ) : (
                     <div className="text-[12px] text-[var(--text-muted)] italic text-center mt-12">
                       No audit performed yet.
                     </div>
                   )}
                </div>

                <div className="p-6 border-t border-[var(--border-strong)] bg-[var(--bg-elevated)] flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Logo & Brand Name */}
                  <div className="hidden sm:flex items-center gap-2.5 opacity-50 hover:opacity-100 transition-all duration-500 ease-out group cursor-pointer w-full sm:w-auto">
                    <div className="relative group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 ease-out">
                      <Image src={brand.logo.path} alt={brand.name} width={18} height={18} className="object-contain drop-shadow-md group-hover:drop-shadow-[0_0_8px_var(--c-primary)] transition-all duration-500" />
                    </div>
                    <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide group-hover:tracking-[0.2em] group-hover:text-[var(--c-primary)] transition-all duration-500">{brand.name}</span>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!formData?.fields}
                    className="w-full sm:w-auto flex-1 btn-brutal bg-[var(--c-primary)] text-[var(--text-primary)] font-black uppercase tracking-widest py-4 flex items-center justify-center gap-2"
                  >
                    DISPATCH <Send size={16} />
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
