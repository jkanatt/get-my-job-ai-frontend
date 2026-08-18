import React, { useState, useEffect } from 'react';
import { Network, Search, AlertCircle, ArrowRight } from 'lucide-react';

export default function DependencyView({ onSelectNode }) {
  const [topNodes, setTopNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopCoupled = async () => {
      try {
        // Querying with empty or 'src' and limit returns highest pagerank nodes
        const res = await fetch('/api/codegraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'query', target: 'src', limit: 25 })
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setTopNodes(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopCoupled();
  }, []);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">Dependency Hotspots</h1>
        <p className="text-[var(--text-secondary)] text-sm">
          Modules and symbols with the highest CodeGraph centrality scores. High scores indicate high coupling and a large blast radius.
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] animate-pulse">
          <Network className="w-5 h-5 mr-2" />
          <span className="text-xs font-mono">Calculating Centrality...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--border-color)] bg-[var(--bg-base)]/50 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              <div className="col-span-1">Score</div>
              <div className="col-span-2">Kind</div>
              <div className="col-span-4">Name</div>
              <div className="col-span-4">File Path</div>
              <div className="col-span-1 text-right">Inspect</div>
            </div>
            
            <div className="divide-y divide-[var(--border-color)]">
              {topNodes.map((item, i) => {
                const n = item.node;
                const score = (item.score || 0).toFixed(1);
                // Highlight very high scores
                const isCritical = item.score > 20;

                return (
                  <div key={n.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[var(--bg-base)] transition-colors group">
                    <div className="col-span-1 flex items-center gap-2">
                      {isCritical && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                      <span className={`text-xs font-mono ${isCritical ? 'text-amber-500 font-bold' : 'text-[var(--text-secondary)]'}`}>
                        {score}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                        {n.kind}
                      </span>
                    </div>
                    <div className="col-span-4 truncate text-sm text-[var(--text-base)] font-medium" title={n.name}>
                      {n.name}
                    </div>
                    <div className="col-span-4 truncate text-xs text-[var(--text-muted)] font-mono" title={n.filePath}>
                      {n.filePath}
                    </div>
                    <div className="col-span-1 text-right">
                      <button 
                        onClick={() => onSelectNode(n)}
                        className="text-[var(--text-muted)] hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <ArrowRight className="w-4 h-4 ml-auto" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
