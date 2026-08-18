'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function MermaidRenderer({ chart, id }) {
  const containerRef = useRef(null);
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      if (!chart || !containerRef.current) return;
      try {
        // Dynamically import mermaid to avoid SSR issues
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });

        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        if (isMounted) {
          setSvg(svg);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (isMounted) {
          setSvg(`<div class="text-red-500">Error rendering chart</div>`);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-auto p-8"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
