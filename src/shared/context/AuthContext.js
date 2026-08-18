'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import * as MOCKS from '../mockData';

const AuthContext = createContext({
  user: null,
  session: null,
  isLoading: false,
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  // Hardcoded mock user for the dummy frontend
  const [user] = useState({
    uid: 'mock-frontend-user-123',
    email: 'demo@getmyjob.ai',
    displayName: 'Demo User',
    photoURL: 'https://i.pravatar.cc/150?u=demo@getmyjob.ai',
    getIdToken: async () => 'mock-token'
  });
  
  const [session] = useState({ user, access_token: 'mock-token' });

  useEffect(() => {
    // Intercept window.fetch to automatically return massive mock payloads for all /api/ requests
    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      
      if (typeof url === 'string' && url.startsWith('/api/')) {
        console.log(`[MOCK INTERCEPTOR] Intercepted call to ${url}`);
        
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        await delay(300); // Simulate network latency

        let mockData = {};

        if (url.includes('/api/jobs')) mockData = MOCKS.MOCK_JOBS;
        else if (url.includes('/api/applications') && url.includes('/tracking')) mockData = MOCKS.MOCK_TRACKING_EVENTS;
        else if (url.includes('/api/applications')) mockData = MOCKS.MOCK_APPLICATIONS;
        else if (url.includes('/documents')) mockData = MOCKS.MOCK_DOCUMENTS;
        else if (url.includes('/api/intelligence/fundings')) mockData = MOCKS.MOCK_FUNDINGS;
        else if (url.includes('/api/intelligence/news')) mockData = MOCKS.MOCK_NEWS;
        else if (url.includes('/api/portals/credentials')) mockData = MOCKS.MOCK_PORTALS;
        else if (url.includes('/api/emails/counts')) mockData = MOCKS.MOCK_EMAIL_COUNTS;
        else if (url.includes('/api/emails')) mockData = MOCKS.MOCK_EMAILS;
        else if (url.includes('/api/calendar')) mockData = MOCKS.MOCK_CALENDAR;
        else if (url.includes('/api/profile')) mockData = MOCKS.MOCK_PROFILE;
        else if (url.includes('/api/settings')) mockData = MOCKS.MOCK_SETTINGS;
        else if (url.includes('/api/dashboard')) mockData = MOCKS.MOCK_DASHBOARD_STATS;
        else if (url.includes('/api/contacts')) mockData = MOCKS.MOCK_CONTACTS;
        else if (url.includes('/api/email-templates')) mockData = MOCKS.MOCK_EMAIL_TEMPLATES;
        else if (url.includes('/api/codegraph')) mockData = { status: 'mock' }; // Intelligence components mock
        else if (url.includes('/api/graphify')) mockData = { status: 'mock' }; 
        else mockData = { success: true }; // Fallback

        return new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading: false, signOut: async () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
