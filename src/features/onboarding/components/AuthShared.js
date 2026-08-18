'use client';

import { motion } from 'framer-motion';
import { brand } from '@/config/brand.config';

/**
 * Shared Auth UI components — used across /, /login, and /signup pages.
 * Single source of truth for login/signup decorative elements.
 */

/* ─── Floating Particles ─── */
export function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/[0.03]"
          style={{
            width: `${60 + i * 40}px`,
            height: `${60 + i * 40}px`,
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            animation: `float-particle ${8 + i * 2}s ease-in-out infinite`,
            animationDelay: `${i * 1.2}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Step Item ─── */
export function StepItem({ number, text, active = false }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
      }}
      className="flex items-center gap-3"
    >
      <div className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-bold transition-all duration-500 ${active ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-lg' : 'bg-white/10 text-white/40'}`}>
        {number}
      </div>
      <div className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-500 ${active ? 'bg-[var(--text-primary)] text-[var(--bg-base)] border border-[var(--text-primary)] shadow-lg' : 'bg-[var(--bg-surface)] text-white/70 border border-white/5'}`}>
        {text}
      </div>
    </motion.div>
  );
}

/* ─── Permission Chip ─── */
export function PermChip({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[11px] font-medium">
      <Icon size={12} />
      {label}
    </div>
  );
}
