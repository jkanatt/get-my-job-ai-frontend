import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, Loader2 } from 'lucide-react';

export default function SemanticGraphCanvas({ onNodeClick, selectedNode }) {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef();
  const graphRef = useRef();

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await fetch('/api/graphify?type=graph');
        if (res.ok) {
          const data = await res.json();
          // Map graphify output to react-force-graph format
          const nodes = (data.nodes || []).map(n => ({
            id: n.id,
            name: n.id,
            type: n.type || 'file',
            ...n
          }));
          const links = (data.edges || []).map(e => ({
            source: e.source,
            target: e.target,
            label: e.label,
            type: e.type || 'EXTRACTED', // EXTRACTED, INFERRED, AMBIGUOUS
          }));
          setGraphData({ nodes, links });
        }
      } catch (err) {
        console.error('Failed to load semantic graph', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGraph();
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleNodeClick = useCallback((node) => {
    if (onNodeClick) onNodeClick(node);
    
    // Center node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(4, 1000);
    }
  }, [onNodeClick]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500">
        <Loader2 className="animate-spin mb-4" size={32} />
        <p>Parsing Codebase Graph...</p>
      </div>
    );
  }

  return (
    <div className="h-full relative bg-[#050505] rounded-xl overflow-hidden border border-[#1f1f22]" ref={containerRef}>
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="name"
        nodeColor={node => {
          if (selectedNode && selectedNode.id === node.id) return '#818cf8'; // Indigo 400
          if (node.type === 'file') return '#94a3b8'; // slate 400
          if (node.type === 'concept') return '#34d399'; // emerald 400
          return '#52525b'; // zinc 600
        }}
        nodeRelSize={4}
        linkColor={link => {
          if (link.type === 'INFERRED') return 'rgba(129, 140, 248, 0.6)'; // Indigo dashed visual
          if (link.type === 'AMBIGUOUS') return 'rgba(251, 191, 36, 0.4)'; // Amber 
          return 'rgba(63, 63, 70, 0.4)'; // zinc 700 for extracted
        }}
        linkWidth={link => link.type === 'INFERRED' ? 1.5 : 1}
        linkLineDash={link => link.type === 'INFERRED' ? [4, 4] : null}
        onNodeClick={handleNodeClick}
        enableNodeDrag={false}
        enableZoomPanInteraction={true}
      />
      <div className="absolute bottom-4 left-4 flex gap-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg border border-[#1f1f22] text-xs font-medium text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-zinc-700"></div> Code Links
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-indigo-400 border border-indigo-400 border-dashed"></div> AI Inferred
        </div>
      </div>
    </div>
  );
}
