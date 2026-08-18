'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Square, Upload, AlertTriangle, Cpu, Terminal, ArrowRight } from 'lucide-react';
import { auth } from '@/infrastructure/_legacy_firebase/client';
import { useSettings, useProfile } from '@/shared/hooks';
import { brand } from '@/config/brand.config';

const PROCESSING_STAGES = [
  { label: 'INITIALIZING_CORE_SYSTEM', progress: 15 },
  { label: 'EXTRACTING_SEMANTIC_DATA', progress: 40 },
  { label: 'RUNNING_AI_MODELS', progress: 70 },
  { label: 'STRUCTURING_IDENTITY_GRAPH', progress: 95 },
  { label: 'FINALIZING_WORKSPACE', progress: 100 },
];

export default function LandingPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const { updateSettings } = useSettings();
  const { updateProfile } = useProfile();

  // Parallax Setup
  const containerRef = useRef(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150, mass: 0.5 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothMouseY, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(smoothMouseX, [-0.5, 0.5], [-10, 10]);
  const bgX = useTransform(smoothMouseX, [-0.5, 0.5], [-20, 20]);
  const bgY = useTransform(smoothMouseY, [-0.5, 0.5], [-20, 20]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isProcessing) return;
    if (stageIndex >= PROCESSING_STAGES.length - 1) return;
    const timer = setTimeout(() => setStageIndex(i => i + 1), 2000);
    return () => clearTimeout(timer);
  }, [isProcessing, stageIndex]);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError('');
    setIsProcessing(true);
    setStageIndex(0);

    try {
      // 1. Ensure user is logged in
      if (!auth.currentUser) {
        throw new Error('You must be logged in to initialize your profile.');
      }
      const token = await auth.currentUser.getIdToken();
      setStageIndex(1);

      // 2. Parse Resume
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/ai/parse-resume', { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData 
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Resume parsing failed');
      }
      const parsed = await res.json();
      setStageIndex(2);

      // 3. Extract Name directly from parsed response (zero friction)
      const firstName = parsed.first_name || 'Anonymous';
      const lastName = parsed.last_name || 'User';
      
      const profileData = {
        ...parsed,
        first_name: firstName,
        last_name: lastName,
      };

      await updateProfile(profileData);

      // 4. Mark onboarded
      setStageIndex(3);
      await updateSettings({ is_onboarded: true });

      setStageIndex(4);
      setTimeout(() => router.push('/dashboard'), 1500);
      
    } catch (err) {
      setError(err.message || 'An error occurred during processing.');
      setIsProcessing(false);
      setStageIndex(0);
    }
  };

  const handleSkip = async () => {
    setError('');
    setIsProcessing(true);
    setStageIndex(0);

    try {
      if (!auth.currentUser) {
        throw new Error('You must be logged in to skip initialization.');
      }
      await updateSettings({ is_onboarded: true });

      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'An error occurred.');
      setIsProcessing(false);
    }
  };

  const fadeSlideUp = {
    hidden: { opacity: 0, y: 30 },
    show: (i) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }
    })
  };

  if (isProcessing) {
    const stage = PROCESSING_STAGES[stageIndex];
    return (
      <main className="flex min-h-screen w-full bg-[#050505] flex-col items-center justify-center font-mono px-6 relative overflow-hidden">
        {/* Sharp background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30" />
        
        <div className="relative z-10 w-full max-w-lg border border-neutral-800 bg-neutral-950 p-8 shadow-lg shadow-black/30">
          <div className="flex items-center gap-4 mb-8 border-b border-neutral-800 pb-4">
            <Cpu className="w-6 h-6 text-blue-500 animate-pulse" />
            <span className="text-sm tracking-widest text-neutral-400">SYSTEM.PROCESSING</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={stageIndex}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h2 className="text-lg text-white font-bold tracking-tight">{stage.label}</h2>
              
              <div className="w-full h-2 bg-neutral-900 border border-neutral-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stage.progress}%` }}
                  transition={{ duration: 1.5, ease: 'circOut' }}
                  className="h-full bg-blue-500"
                />
              </div>
              
              <div className="flex justify-between items-center text-xs text-neutral-500">
                <span>[LOG_{stageIndex + 1}]</span>
                <span>{stage.progress}%</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    );
  }

  return (
    <main 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="flex min-h-screen w-full bg-[#050505] selection:bg-blue-500/30 p-0 transition-all duration-500 font-sans text-white relative overflow-hidden [perspective:1200px]"
    >
      {/* ─── Parallax Background Elements ─── */}
      <motion.div 
        style={{ x: bgX, y: bgY }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] border border-blue-500/10 rotate-12 bg-blue-500/[0.02]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] border border-purple-500/10 -rotate-12 bg-purple-500/[0.02]" />
      </motion.div>
      
      <div className="flex-1 flex flex-col justify-center relative z-10 w-full h-full min-h-screen">
        
        {/* Parallax Card Container */}
        <motion.div 
          style={{ rotateX, rotateY }}
          className="w-full h-full flex flex-col justify-center [transform-style:preserve-3d]"
        >
          {/* Header */}
          <motion.div custom={0} variants={fadeSlideUp} initial="hidden" animate={mounted ? "show" : "hidden"} className="flex flex-col items-start space-y-6 mb-8 w-full max-w-7xl mx-auto px-6 md:px-12 [transform:translateZ(40px)]">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 text-xs font-mono tracking-widest uppercase">
              <Square className="w-3 h-3 text-blue-500 fill-blue-500" />
              {brand.name}_Core
            </div>
            <h1 className="text-[48px] md:text-[64px] lg:text-[80px] font-bold tracking-tighter leading-[0.9] text-white">
              Career.<br/>Automated.
            </h1>
            <p className="text-neutral-400 text-base md:text-lg max-w-[500px] leading-relaxed">
              Upload your resume. {brand.name} extracts your semantic graph and deploys your professional command center instantly.
            </p>
          </motion.div>

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full max-w-7xl mx-auto px-6 md:px-12 mb-6 [transform:translateZ(20px)]"
              >
                <div className="p-4 bg-red-950 border border-red-900 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-red-200 text-sm font-medium">
                    {error}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Action Card (Sharp/Brutalist) - Fit to borders */}
          <motion.div custom={1} variants={fadeSlideUp} initial="hidden" animate={mounted ? "show" : "hidden"} className="w-full [transform:translateZ(60px)]">
            <div className="w-full bg-[#0A0A0A] border-y border-white/10 shadow-[0_12px_30px_0_rgba(0,0,0,0.5)] p-8 md:p-16 lg:p-24 relative group hover:border-white/20 transition-colors duration-300">
              
              <div className="w-full max-w-7xl mx-auto space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-8">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-neutral-500" />
                    <span className="text-xs font-mono text-neutral-400">DATA_INPUT</span>
                  </div>
                  <span className="text-xs font-mono text-blue-500">READY</span>
                </div>

                <label className="
                  relative cursor-pointer flex flex-col items-center justify-center text-center gap-6 py-20 px-8 
                  border border-dashed border-white/20 bg-white/[0.01] transition-all duration-300 hover:bg-blue-500/[0.05] hover:border-blue-500/50 group/drop
                ">
                  <div className="w-16 h-16 bg-white/5 flex items-center justify-center transition-all duration-300 group-hover/drop:bg-blue-500 group-hover/drop:text-black">
                    <Upload className="w-6 h-6 text-neutral-400 group-hover/drop:text-black" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-tight">
                      Initialize Profile
                    </h3>
                    <p className="text-neutral-500 text-sm font-mono uppercase tracking-widest">
                      PDF, DOCX, TXT
                    </p>
                  </div>
                  
                  {/* Decorative corner brackets */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/20 transition-colors group-hover/drop:border-blue-500" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/20 transition-colors group-hover/drop:border-blue-500" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/20 transition-colors group-hover/drop:border-blue-500" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/20 transition-colors group-hover/drop:border-blue-500" />

                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.doc,.docx,.txt,.tex" 
                    onChange={handleFileUpload} 
                    disabled={isProcessing}
                  />
                </label>
              </div>

            </div>
          </motion.div>
          
          {/* Footer Actions */}
          <motion.div custom={2} variants={fadeSlideUp} initial="hidden" animate={mounted ? "show" : "hidden"} className="mt-8 flex items-center justify-between w-full [transform:translateZ(30px)] border-t border-white/5 pt-6">
             <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
               <span>SYS.OK</span>
               <div className="w-1 h-1 bg-neutral-600" />
               <span>E2E_ENCRYPTION</span>
             </div>

             <button
               onClick={handleSkip}
               disabled={isProcessing}
               className="group flex items-center gap-2 text-xs font-mono text-neutral-500 hover:text-white transition-colors cursor-pointer"
             >
               <span>SKIP_INIT</span>
               <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
             </button>
          </motion.div>
        </motion.div>

      </div>
    </main>
  );
}


