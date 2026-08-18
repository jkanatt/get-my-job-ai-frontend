'use client';

import React, { useState } from 'react';
import { X, ExternalLink, Code2, ArrowRight, ArrowLeft, Bot, GitMerge, LayoutTemplate, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { codebaseTaxonomy } from '@/shared/data/codebaseTaxonomy';

export default function SidePanel({ node, onClose }) {
  const [activeTab, setActiveTab] = useState('details'); // details, context
  const [loadingContext, setLoadingContext] = useState(false);
  const [aiContext, setAiContext] = useState(null);

  const isFolder = typeof node === 'string'; // Assuming folder path is passed directly
  const folderTaxonomy = isFolder ? (
    Object.entries(codebaseTaxonomy).find(([key]) => node.startsWith(key))?.[1]
  ) : null;

  const handleGenerateContext = async () => {
    if (isFolder) return;
    try {
      setLoadingContext(true);
      const res = await fetch('/api/codegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'node', target: node.id })
      });
      const data = await res.json();
      setAiContext(JSON.stringify(data, null, 2));
      toast.success('AI Context generated from graph');
    } catch (err) {
      toast.error('Failed to generate context');
    } finally {
      setLoadingContext(false);
    }
  };

  const copyToClipboard = () => {
    if (aiContext) {
      navigator.clipboard.writeText(aiContext);
      toast.success('Copied to clipboard');
    }
  };

  return (
    <div className="w-80 border-l border-[var(--border-color)] bg-[var(--bg-base)] flex flex-col z-10 shadow-2xl h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isFolder ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                DIRECTORY
              </span>
            ) : (
              <Badge kind={node.kind || 'file'} />
            )}
            <h2 className="text-sm font-semibold text-[var(--text-base)] truncate max-w-[200px]" title={isFolder ? node : node.name}>
              {isFolder ? node.split('/').pop() || '/' : node.name}
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] truncate" title={isFolder ? node : node.file}>
            {isFolder ? node : (node.file || node.path)}
          </p>
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-base)] p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-color)]">
        <Tab active={activeTab === 'details'} onClick={() => setActiveTab('details')}>Details</Tab>
        {!isFolder && <Tab active={activeTab === 'context'} onClick={() => setActiveTab('context')}>AI Context</Tab>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'details' && (
          <div className="space-y-6">
            
            {isFolder && folderTaxonomy ? (
              <div className="space-y-4">
                <Section title="Architecture Review">
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    <strong className="block text-[var(--text-base)] mb-1">{folderTaxonomy.name}</strong>
                    {folderTaxonomy.description}
                  </div>
                </Section>
                <Section title="Design Intent">
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {folderTaxonomy.purpose}
                  </div>
                </Section>
                <Section title="Role in System">
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {folderTaxonomy.role}
                  </div>
                </Section>
                <Section title="Technical Debt & Risks">
                  <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded-md leading-relaxed border border-amber-500/20 flex items-start gap-2">
                    <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                    <span>{folderTaxonomy.weaknesses}</span>
                  </div>
                </Section>
              </div>
            ) : isFolder ? (
              <Section title="Directory Information">
                <div className="text-xs text-[var(--text-muted)]">
                  Standard structural directory.
                </div>
              </Section>
            ) : (
              <>
                <Section title="Properties">
                  <div className="space-y-2 text-xs">
                    <PropertyRow label="ID" value={node.id || 'N/A'} />
                    <PropertyRow label="Kind" value={node.kind || 'file'} />
                    <PropertyRow label="Path" value={node.file || node.path} />
                    {node.nodeCount !== undefined && <PropertyRow label="Child Nodes" value={node.nodeCount} />}
                    {node.size !== undefined && <PropertyRow label="Size" value={`${(node.size/1024).toFixed(2)} KB`} />}
                  </div>
                </Section>

                {node.id && (
                  <Section title="Actions">
                    <div className="grid grid-cols-2 gap-2">
                      <ActionButton icon={<ArrowLeft />} label="Find Callers" />
                      <ActionButton icon={<ArrowRight />} label="Find Callees" />
                      <ActionButton icon={<GitMerge />} label="Blast Radius" />
                      <ActionButton icon={<ExternalLink />} label="Open File" />
                    </div>
                  </Section>
                )}
              </>
            )}
          </div>
        )}

        {!isFolder && activeTab === 'context' && (
          <div className="space-y-4 h-full flex flex-col">
            <p className="text-xs text-[var(--text-muted)]">
              Generate a massive markdown context payload containing the source code, callers, and callees of this node to paste into your AI assistant.
            </p>
            {!aiContext ? (
              <button 
                onClick={handleGenerateContext}
                disabled={loadingContext || !node.id}
                className="w-full py-2 bg-[var(--c-primary)] hover:opacity-90 text-white rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loadingContext ? 'Generating...' : (
                  <>
                    <Bot className="w-4 h-4" />
                    Generate Context
                  </>
                )}
              </button>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <button 
                  onClick={copyToClipboard}
                  className="w-full py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-t-md text-xs font-medium flex items-center justify-center gap-2 transition-colors border border-emerald-500/20"
                >
                  <Code2 className="w-4 h-4" />
                  Copy Markdown
                </button>
                <div className="flex-1 bg-black rounded-b-md border border-[var(--border-color)] p-2 overflow-y-auto">
                  <pre className="text-[10px] text-[var(--text-muted)] font-mono whitespace-pre-wrap">
                    {aiContext}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ kind }) {
  const colors = {
    class: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    function: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    interface: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    variable: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    file: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
  };
  
  const defaultColor = 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
  const colorClass = colors[kind] || defaultColor;

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border ${colorClass}`}>
      {kind || 'unknown'}
    </span>
  );
}

function Tab({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
        active 
          ? 'border-[var(--c-primary)] text-[var(--c-primary)]' 
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function PropertyRow({ label, value }) {
  return (
    <div className="flex justify-between py-1 border-b border-[var(--border-color)] last:border-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-secondary)] font-mono truncate max-w-[180px]" title={value}>
        {value}
      </span>
    </div>
  );
}

function ActionButton({ icon, label }) {
  return (
    <button className="flex items-center gap-2 p-2 rounded-md border border-[var(--border-color)] hover:bg-[var(--bg-elevated)] hover:border-zinc-700 transition-colors text-left text-[var(--text-secondary)]">
      <div className="text-[var(--text-muted)]">
        {React.cloneElement(icon, { size: 14 })}
      </div>
      <span className="text-[10px] font-medium truncate">{label}</span>
    </button>
  );
}
