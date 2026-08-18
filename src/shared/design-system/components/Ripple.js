'use client';

import { useState, useEffect } from 'react';

export default function Ripple({ color = 'rgba(99, 102, 241, 0.4)', duration = 600 }) {
  const [ripples, setRipples] = useState([]);

  useEffect(() => {
    const timeouts = ripples.map(
      (r, i) => setTimeout(() => setRipples(prev => prev.filter(x => x.id !== r.id)), duration)
    );
    return () => timeouts.forEach(clearTimeout);
  }, [ripples, duration]);

  const addRipple = (e) => {
    // Only trigger for primary mouse button
    if (e.button !== 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    setRipples(prev => [...prev, { x, y, size, id: Date.now() }]);
  };

  return (
    <div 
      className="absolute inset-0 overflow-hidden rounded-[inherit]" 
      onMouseDown={addRipple}
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full animate-ripple pointer-events-none"
          style={{
            top: ripple.y,
            left: ripple.x,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color,
            animationDuration: `${duration}ms`
          }}
        />
      ))}
    </div>
  );
}
