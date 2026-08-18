import React, { useState, useEffect } from 'react';
import { X, Code2, ArrowRight, ArrowLeft, GitMerge, ShieldAlert, GitCommit } from 'lucide-react';
import { toast } from 'sonner';

export default function NodeInspector({ node, onClose, onNavigate }) {
  const [activeTab, setActiveTab] = useState('source'); // source, relations, impact
  const [sourceCode, setSourceCode] = useState('');
  const [relations, setRelations] = useState({ callers: [], callees: [] });
  const [impact, setImpact] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!node?.id) return;
    
    const fetchDetails = async () => {
      setLoading(true);
      try {
        // Fetch Source (Raw markdown/text)
        const sourceRes = await fetch('/api/codegraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'node', target: node.name })
        });
        const sourceData = await sourceRes.json();
        setSourceCode(sourceData.data || 'No source available.');

        // Fetch Callers
        const callersRes = await fetch('/api/codegraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'callers', target: node.name })
        });
        const callersData = await callersRes.json();
        
        // Fetch Callees
        const calleesRes = await fetch('/api/codegraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'callees', target: node.name })
        });
        const calleesData = await calleesRes.json();
        
        // Extract array from response object if needed
        const c1 = callersData.callers || (Array.isArray(callersData) ? callersData : []);
        const c2 = calleesData.callees || (Array.isArray(calleesData) ? calleesData : []);
        
        setRelations({
          callers: Array.isArray(c1) ? c1 : [],
          callees: Array.isArray(c2) ? c2 : []
        });

      } catch (err) {
        console.error('Failed to fetch node details', err);
        toast.error('Failed to fetch node details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [node]);

  const handleFetchImpact = async () => {
    if (impact.length > 0) return; // already fetched
    try {
      setLoading(true);
      const res = await fetch('/api/codegraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'impact', target: node.name })
      });
      const data = await res.json();
      const impactArray = data.impact || (Array.isArray(data) ? data : []);
      setImpact(Array.isArray(impactArray) ? impactArray : []);
    } catch (err) {
      toast.error('Failed to fetch impact radius');
    } finally {
      setLoading(false);
    }
  };

  if (!node) return null;

  return (
    <div className="w-96 border-l border-[var(--border-color)] bg-[var(--bg-base)] flex flex-col z-20 shadow-2xl h-full transition-transform duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-start bg-[var(--bg-elevated)]">
        <div className="min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border bg-zinc-500/10 text-zinc-400 border-zinc-500/20 shrink-0">
              {node.kind || 'unknown'}
            </span>
            <h2 className="text-sm font-semibold text-white truncate" title={node.name}>
              {node.name}
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] truncate font-mono" title={node.file || node.path || node.id}>
            {node.file || node.path || node.id}
          </p>
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-color)]">
        <Tab active={activeTab === 'source'} onClick={() => setActiveTab('source')}>Source</Tab>
        <Tab active={activeTab === 'relations'} onClick={() => setActiveTab('relations')}>Relations</Tab>
        <Tab active={activeTab === 'impact'} onClick={() => { setActiveTab('impact'); handleFetchImpact(); }}>Impact</Tab>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {loading && (
          <div className="absolute inset-0 bg-[var(--bg-base)]/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        )}

        {/* SOURCE TAB */}
        {activeTab === 'source' && (
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3 text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
              <Code2 className="w-4 h-4" />
              Source Code
            </div>
            <div className="flex-1 bg-[#0d0d11] rounded-md border border-[var(--border-color)] overflow-hidden flex flex-col min-h-[300px]">
              <div className="overflow-y-auto custom-scrollbar p-3 flex-1">
                <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre-wrap break-all">
                  {sourceCode.replace(/```[a-z]*\n/g, '').replace(/```/g, '')}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* RELATIONS TAB */}
        {activeTab === 'relations' && (
          <div className="p-4 space-y-6">
            <RelationSection 
              title="Callers (Depends on this)" 
              icon={<ArrowLeft className="w-4 h-4 text-emerald-400" />}
              items={relations.callers}
              onNavigate={onNavigate}
            />
            <RelationSection 
              title="Callees (This depends on)" 
              icon={<ArrowRight className="w-4 h-4 text-blue-400" />}
              items={relations.callees}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {/* IMPACT TAB */}
        {activeTab === 'impact' && (
          <div className="p-4 space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-amber-500 mb-1">Blast Radius</h4>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  The following files and symbols will be potentially affected if you modify this node. Evaluated by tracing the dependency graph.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {impact.length === 0 && !loading && (
                <p className="text-xs text-[var(--text-muted)] italic text-center mt-6">No downstream impact detected.</p>
              )}
              {impact.map((item, i) => (
                <div key={i} className="p-2 border border-[var(--border-color)] rounded-md hover:border-indigo-500/50 cursor-pointer transition-colors bg-[var(--bg-elevated)]" onClick={() => onNavigate && onNavigate(item)}>
                  <div className="flex items-center gap-2 mb-1">
                    <GitCommit className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-xs text-[var(--text-base)] font-medium truncate" title={item.name}>{item.name}</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono truncate pl-5">
                    {item.filePath || item.file}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Tab({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${
        active 
          ? 'border-indigo-500 text-indigo-400' 
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}

function RelationSection({ title, icon, items, onNavigate }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider border-b border-[var(--border-color)] pb-2">
        {icon}
        {title}
        <span className="ml-auto bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded text-[10px] text-[var(--text-muted)]">
          {items.length}
        </span>
      </div>
      
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] italic">None found</p>
        ) : (
          items.map((item, i) => (
            <div key={i} className="p-2 border border-[var(--border-color)] rounded-md hover:border-indigo-500/50 cursor-pointer transition-colors" onClick={() => onNavigate && onNavigate(item)}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono">{item.kind}</span>
                <span className="text-xs text-[var(--text-base)] font-medium truncate" title={item.name}>{item.name}</span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                {item.filePath || item.file}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
