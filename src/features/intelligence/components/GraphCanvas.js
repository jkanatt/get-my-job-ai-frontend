'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { RefreshCw, Maximize, Minimize } from 'lucide-react';

// Dynamically import react-force-graph-2d to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { 
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#0a0a0c] text-zinc-500">
      <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500/50" />
      <span className="font-mono text-xs tracking-wider">INITIALIZING GRAPH ENGINE...</span>
    </div>
  )
});

const NODE_COLORS = {
  class: '#f59e0b',     // amber-500
  function: '#10b981',  // emerald-500
  interface: '#3b82f6', // blue-500
  variable: '#ec4899',  // pink-500
  import: '#6366f1',    // indigo-500
  file: '#71717a',      // zinc-500
  folder: '#eab308',    // yellow-500
  component: '#8b5cf6', // violet-500
  unknown: '#52525b'
};

export default function GraphCanvas({ onNodeClick, selectedNode }) {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  
  // Track hover state for styling
  const [hoverNode, setHoverNode] = useState(null);

  // Resize observer
  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById('graph-container');
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [fullscreen]);

  // Fetch initial graph data
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/codegraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'graph' })
        });
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);

        let nodes = [];
        let links = data.edges || [];
        
        // Add nodes and build folder hierarchy
        const nodeMap = new Set();
        
        if (data.nodes) {
          data.nodes.forEach(n => {
            const id = n.id;
            nodes.push({
              id,
              name: n.name,
              kind: n.kind,
              file: n.filePath,
              val: n.kind === 'class' ? 12 : n.kind === 'function' ? 8 : 4
            });
            nodeMap.add(id);
            
            // Connect symbol to its file
            if (n.filePath) {
              links.push({ source: id, target: n.filePath });
            }
          });
          
          // Build file/folder structure nodes
          const fileGroups = {};
          data.nodes.forEach(n => {
            if (!fileGroups[n.filePath]) fileGroups[n.filePath] = [];
            fileGroups[n.filePath].push(n);
          });
          
          Object.keys(fileGroups).forEach(filePath => {
            if (!filePath) return;
            const parts = filePath.split('/');
            let currentPath = '';
            
            parts.forEach((part, index) => {
              const parentPath = currentPath;
              currentPath += (currentPath ? '/' : '') + part;
              
              if (!nodeMap.has(currentPath)) {
                nodes.push({
                  id: currentPath,
                  name: part,
                  kind: index === parts.length - 1 ? 'file' : 'folder',
                  file: currentPath,
                  val: index === parts.length - 1 ? 15 : 20
                });
                nodeMap.add(currentPath);
              }
              
              if (parentPath && parentPath !== currentPath) {
                // Link child to parent folder
                links.push({ source: currentPath, target: parentPath });
              }
            });
          });
        }
        
        setGraphData({ nodes, links });
      } catch (err) {
        toast.error('Failed to load initial graph');
      } finally {
        setLoading(false);
      }
    };
    fetchGraph();
  }, []);

  // Dynamically expand node when selected
  useEffect(() => {
    if (!selectedNode || !selectedNode.id) return;
    
    const expandNode = async () => {
      try {
        const [callersRes, calleesRes] = await Promise.all([
          fetch('/api/codegraph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'callers', target: selectedNode.id }) }),
          fetch('/api/codegraph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'callees', target: selectedNode.id }) })
        ]);
        
        const callers = await callersRes.json();
        const callees = await calleesRes.json();
        
        setGraphData(prev => {
          const newNodes = [...prev.nodes];
          const newLinks = [...prev.links];
          const nodeMap = new Set(newNodes.map(n => n.id));

          const addNode = (n) => {
            const id = n.id || n.name;
            if (!nodeMap.has(id)) {
              newNodes.push({ id, name: n.name, kind: n.kind, file: n.filePath || n.file, val: 5 });
              nodeMap.add(id);
            }
            return id;
          };

          if (Array.isArray(callers)) {
            callers.forEach(c => {
              const cid = addNode(c);
              newLinks.push({ source: cid, target: selectedNode.id });
            });
          }
          if (Array.isArray(callees)) {
            callees.forEach(c => {
              const cid = addNode(c);
              newLinks.push({ source: selectedNode.id, target: cid });
            });
          }

          return { nodes: newNodes, links: newLinks };
        });

        // Center on node
        if (fgRef.current) {
          const fgNode = graphData.nodes.find(n => n.id === selectedNode.id);
          if (fgNode) {
            fgRef.current.centerAt(fgNode.x, fgNode.y, 1000);
            fgRef.current.zoom(2, 1000);
          }
        }
      } catch (err) {
        console.error('Failed to expand node', err);
      }
    };
    
    expandNode();
  }, [selectedNode]);

  const handleNodeClick = useCallback(node => {
    if (onNodeClick) onNodeClick(node);
    
    // Zoom in on the node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(3, 2000);
    }
  }, [onNodeClick]);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoverNode === node;
    const color = NODE_COLORS[node.kind] || NODE_COLORS.unknown;
    
    // Draw outer glow if selected
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val * 0.4 + 2, 0, 2 * Math.PI, false);
      ctx.fillStyle = `${color}40`; // 25% opacity
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val * 0.3, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw border
    ctx.strokeStyle = isSelected ? '#ffffff' : isHovered ? color : '#18181b';
    ctx.lineWidth = isSelected ? 1 / globalScale : 0.5 / globalScale;
    ctx.stroke();

    // Draw text label at higher zoom levels
    if (globalScale > 2 || isSelected || isHovered) {
      const label = node.name;
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSelected ? '#ffffff' : '#a1a1aa';
      ctx.fillText(label, node.x, node.y + (node.val * 0.3) + (6 / globalScale));
    }
  }, [selectedNode, hoverNode]);

  return (
    <div 
      id="graph-container" 
      className={`relative bg-[#09090b] ${fullscreen ? 'fixed inset-0 z-50' : 'w-full h-full rounded-xl border border-[var(--border-color)] overflow-hidden'}`}
    >
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <div className="px-3 py-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg shadow-xl">
          <p className="text-[10px] font-mono text-zinc-400 font-semibold tracking-wider">
            NODES: <span className="text-white">{graphData.nodes.length}</span> | EDGES: <span className="text-white">{graphData.links.length}</span>
          </p>
        </div>
      </div>

      <button 
        onClick={() => setFullscreen(!fullscreen)}
        className="absolute top-4 right-4 z-10 p-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg shadow-xl text-zinc-400 hover:text-white transition-colors"
      >
        {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>

      {!loading && graphData.nodes.length > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeCanvasObject={paintNode}
          nodeRelSize={1}
          linkColor={() => '#27272a'}
          linkWidth={0.5}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          onNodeHover={setHoverNode}
          onNodeClick={handleNodeClick}
          d3VelocityDecay={0.3}
          d3AlphaDecay={0.02}
          cooldownTicks={100}
        />
      )}
    </div>
  );
}
