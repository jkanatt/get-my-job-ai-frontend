'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/shared/design-system/components/Sidebar';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext';
import { brand } from '@/config/brand.config';
import { isPublicRoute } from '@/config/routes.config';

export default function AppShell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Only redirect if we are not on a public route and not loading
    const publicRoute = isPublicRoute(pathname);
    
    if (!isLoading && !publicRoute && !user && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [user, isLoading, pathname]);

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="w-10 h-10 border-4 border-[var(--c-primary)]/20 border-t-[var(--c-primary)] rounded-full animate-spin"></div>
      </div>
    );
  }


  if (!user) {
    return null;
  }

  return (
    <div className="app-shell flex flex-col md:flex-row min-h-screen">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[var(--bg-base)] border-b border-[var(--border-subtle)] sticky top-0 z-30">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="w-8 h-8 bg-[var(--text-primary)] rounded-none flex items-center justify-center text-[var(--bg-base)] font-black text-[10px]">
            {brand.name.toUpperCase()}
          </div>
          <span className="tracking-tight">{brand.name.toLowerCase()}</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 -mr-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Toggle Menu"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-[var(--bg-base)]/90 z-40 backdrop-blur-md transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Wrapper */}
      <div className={`fixed inset-y-0 left-0 z-50 h-screen transform transition-transform duration-200 ease-linear md:sticky md:top-0 md:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="main-content flex-1 w-full min-w-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
        {children}
      </main>
    </div>
  );
}
