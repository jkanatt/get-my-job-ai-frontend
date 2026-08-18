'use client';

import { createContext, useContext, useState } from 'react';

const ComposeContext = createContext();

export function ComposeProvider({ children }) {
  const [sessions, setSessions] = useState([]);

  const openCompose = (initialData = {}) => {
    setSessions(prev => {
      const hasFullScreen = prev.some(s => s.isFullScreen);
      const newSession = {
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        isMinimized: false,
        isFullScreen: hasFullScreen,
        data: initialData
      };
      
      if (hasFullScreen) {
        return [
          ...prev.map(s => ({ ...s, isFullScreen: false, isMinimized: true })),
          newSession
        ];
      }
      return [...prev, newSession];
    });
  };

  const closeCompose = (id) => {
    setSessions(prev => prev.filter(session => session.id !== id));
  };

  const toggleMinimize = (id) => {
    setSessions(prev => prev.map(session => 
      session.id === id ? { ...session, isMinimized: !session.isMinimized } : session
    ));
  };

  const toggleFullScreen = (id) => {
    setSessions(prev => {
      const target = prev.find(s => s.id === id);
      const willBeFullScreen = !target.isFullScreen;
      
      return prev.map(session => {
        if (session.id === id) {
          return { ...session, isFullScreen: willBeFullScreen, isMinimized: false };
        }
        if (willBeFullScreen) {
          return { ...session, isFullScreen: false, isMinimized: true };
        }
        return session;
      });
    });
  };

  const minimizeAllFullScreen = () => {
    setSessions(prev => prev.map(session => 
      session.isFullScreen ? { ...session, isFullScreen: false, isMinimized: true } : session
    ));
  };

  return (
    <ComposeContext.Provider value={{ sessions, openCompose, closeCompose, toggleMinimize, toggleFullScreen, minimizeAllFullScreen }}>
      {children}
    </ComposeContext.Provider>
  );
}

export function useCompose() {
  const context = useContext(ComposeContext);
  if (context === undefined) {
    throw new Error('useCompose must be used within a ComposeProvider');
  }
  return context;
}
