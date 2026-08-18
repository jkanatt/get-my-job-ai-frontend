import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, FileWarning, Search, ArrowRight } from 'lucide-react';

export default function HealthView({ onSelectNode }) {
  const [largeFiles, setLargeFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/codegraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'files' })
        });
        const data = await res.json();
        
        if (Array.isArray(data)) {
          // Sort by size descending
          const sorted = [...data].sort((a, b) => (b.size || 0) - (a.size || 0));
          // Filter to files larger than 10KB (assuming size is in bytes)
          setLargeFiles(sorted.slice(0, 30));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-2 flex items-center gap-2">
          Architecture Health
        </h1>
        <p className="text-[var(--text-secondary)] text-sm">
          Identifying technical debt, monolithic files, and potential refactoring targets based on structural metrics.
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] animate-pulse">
          <Activity className="w-5 h-5 mr-2" />
          <span className="text-xs font-mono">Running Architecture Audit...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Monolithic Files */}
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-base)]/50">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileWarning className="w-4 h-4 text-amber-500" />
                  Monolithic Files (Size)
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Files exceeding standard limits. Candidates for splitting.</p>
              </div>
              
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)] max-h-[500px]">
                {largeFiles.map((file, i) => {
                  const sizeKB = (file.size / 1024).toFixed(1);
                  const isHuge = file.size > 50000; // > 50KB

                  return (
                    <div key={file.path} className="p-3 hover:bg-[var(--bg-base)] transition-colors group flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          {isHuge && <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />}
                          <p className="text-sm text-[var(--text-base)] truncate font-medium" title={file.path}>
                            {file.path.split('/').pop()}
                          </p>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] truncate font-mono">
                          {file.path}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-mono ${isHuge ? 'text-red-400 font-bold' : 'text-[var(--text-secondary)]'}`}>
                          {sizeKB} KB
                        </span>
                        <button 
                          onClick={() => onSelectNode({ id: file.path, name: file.path, kind: 'file' })}
                          className="text-[var(--text-muted)] hover:text-indigo-400 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coming Soon: Circular Dependencies */}
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-6 flex flex-col items-center justify-center text-center border-dashed">
              <Activity className="w-8 h-8 text-[var(--text-muted)] mb-3 opacity-50" />
              <h3 className="text-sm font-medium text-[var(--text-base)] mb-2">Cyclic Dependency Detection</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-[250px]">
                Graph cycle detection requires full graph parsing on the backend. This view will identify tightly coupled circular reference loops.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
