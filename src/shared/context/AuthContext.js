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

if (typeof window !== 'undefined' && !window.__mockInterceptorInstalled) {
  window.__mockInterceptorInstalled = true;
  const originalFetch = window.fetch;
  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    
    if (typeof url === 'string' && url.startsWith('/api/')) {
      console.log(`[MOCK INTERCEPTOR] Intercepted call to ${url}`);
      
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      await delay(300); // Simulate network latency

      const method = (init && init.method) ? init.method.toUpperCase() : 'GET';
      if (method !== 'GET') {
        let reqBody = {};
        try { if (init.body) reqBody = JSON.parse(init.body); } catch (e) {}
        
        const newId = 'mock-' + Math.random().toString(36).substr(2, 9);
        const newItem = { id: newId, created_at: new Date().toISOString(), date: new Date().toISOString(), ...reqBody };

        if (method === 'POST') {
           if (url.includes('/tracking')) {
              if (MOCKS.MOCK_TRACKING_EVENTS && MOCKS.MOCK_TRACKING_EVENTS.events) {
                MOCKS.MOCK_TRACKING_EVENTS.events.unshift(newItem);
              }
           } else if (url.includes('/api/applications')) {
              if (MOCKS.MOCK_APPLICATIONS && MOCKS.MOCK_APPLICATIONS.applications) {
                MOCKS.MOCK_APPLICATIONS.applications.unshift(newItem);
                MOCKS.MOCK_APPLICATIONS.total += 1;
              }
           } else if (url.includes('/api/jobs')) {
              if (MOCKS.MOCK_JOBS && MOCKS.MOCK_JOBS.jobs) {
                MOCKS.MOCK_JOBS.jobs.unshift(newItem);
                MOCKS.MOCK_JOBS.total += 1;
              }
           } else if (url.includes('/api/calendar')) {
              if (MOCKS.MOCK_CALENDAR && MOCKS.MOCK_CALENDAR.events) {
                MOCKS.MOCK_CALENDAR.events.unshift(newItem);
              }
           } else if (url.includes('/api/emails') && !url.includes('/counts')) {
              if (MOCKS.MOCK_EMAILS && MOCKS.MOCK_EMAILS.emails) {
                newItem.labels = ["SENT"];
                MOCKS.MOCK_EMAILS.emails.unshift(newItem);
              }
           } else if (url.includes('/api/contacts')) {
              if (MOCKS.MOCK_CONTACTS && MOCKS.MOCK_CONTACTS.contacts) {
                MOCKS.MOCK_CONTACTS.contacts.unshift(newItem);
              }
           } else if (url.includes('/api/email-templates')) {
              if (Array.isArray(MOCKS.MOCK_EMAIL_TEMPLATES)) {
                MOCKS.MOCK_EMAIL_TEMPLATES.unshift(newItem);
              }
           }
        } else if (method === 'PUT' || method === 'PATCH') {
           if (url.includes('/api/applications') && !url.includes('/tracking')) {
              if (MOCKS.MOCK_APPLICATIONS && MOCKS.MOCK_APPLICATIONS.applications) {
                 const index = MOCKS.MOCK_APPLICATIONS.applications.findIndex(a => url.includes(a.id));
                 if (index !== -1) MOCKS.MOCK_APPLICATIONS.applications[index] = { ...MOCKS.MOCK_APPLICATIONS.applications[index], ...reqBody };
              }
           } else if (url.includes('/api/jobs')) {
              if (MOCKS.MOCK_JOBS && MOCKS.MOCK_JOBS.jobs) {
                 const index = MOCKS.MOCK_JOBS.jobs.findIndex(j => url.includes(j.id));
                 if (index !== -1) MOCKS.MOCK_JOBS.jobs[index] = { ...MOCKS.MOCK_JOBS.jobs[index], ...reqBody };
              }
           }
           if (url.includes('/api/profile')) {
              Object.assign(MOCKS.MOCK_PROFILE, reqBody);
           }
           if (url.includes('/api/settings')) {
              Object.assign(MOCKS.MOCK_SETTINGS, reqBody);
           }
        } else if (method === 'DELETE') {
           if (url.includes('/api/applications') && !url.includes('/tracking')) {
              if (MOCKS.MOCK_APPLICATIONS && MOCKS.MOCK_APPLICATIONS.applications) {
                 MOCKS.MOCK_APPLICATIONS.applications = MOCKS.MOCK_APPLICATIONS.applications.filter(a => !url.includes(a.id));
                 MOCKS.MOCK_APPLICATIONS.total -= 1;
              }
           } else if (url.includes('/api/jobs')) {
              if (MOCKS.MOCK_JOBS && MOCKS.MOCK_JOBS.jobs) {
                 MOCKS.MOCK_JOBS.jobs = MOCKS.MOCK_JOBS.jobs.filter(j => !url.includes(j.id));
                 MOCKS.MOCK_JOBS.total -= 1;
              }
           } else if (url.includes('/api/calendar')) {
              if (MOCKS.MOCK_CALENDAR && MOCKS.MOCK_CALENDAR.events) {
                MOCKS.MOCK_CALENDAR.events = MOCKS.MOCK_CALENDAR.events.filter(e => !url.includes(e.id));
              }
           }
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          id: newId,
          event: { id: newId } 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let mockData = {};

      if (url.includes('/api/jobs')) mockData = MOCKS.MOCK_JOBS;
      else if (url.includes('/api/applications') && url.includes('/tracking')) mockData = MOCKS.MOCK_TRACKING_EVENTS;
      else if (url.includes('/api/applications')) mockData = MOCKS.MOCK_APPLICATIONS;
      else if (url.includes('/documents')) mockData = MOCKS.MOCK_DOCUMENTS;
      else if (url.includes('/api/intelligence/fundings')) mockData = MOCKS.MOCK_FUNDINGS;
      else if (url.includes('/api/intelligence/news')) mockData = MOCKS.MOCK_NEWS;
      else if (url.includes('/api/portals/credentials')) mockData = MOCKS.MOCK_PORTALS;
      else if (url.includes('/api/emails/counts')) mockData = MOCKS.MOCK_EMAIL_COUNTS;
      else if (url.includes('/api/emails')) {
        const typeMatch = url.match(/type=([^&]+)/);
        const qMatch = url.match(/q=([^&]+)/);
        const folderType = typeMatch ? typeMatch[1].toUpperCase() : 'INBOX';
        const searchQuery = qMatch ? decodeURIComponent(qMatch[1]).toLowerCase() : '';
        
        let filteredEmails = (MOCKS.MOCK_EMAILS.emails || []).filter(e => e.labels && e.labels.includes(folderType));
        if (searchQuery) {
          filteredEmails = filteredEmails.filter(e => 
            (e.subject && e.subject.toLowerCase().includes(searchQuery)) || 
            (e.from_name && e.from_name.toLowerCase().includes(searchQuery)) ||
            (e.company && e.company.toLowerCase().includes(searchQuery))
          );
        }
        mockData = { emails: filteredEmails, total: filteredEmails.length };
      }
      else if (url.includes('/api/calendar')) mockData = MOCKS.MOCK_CALENDAR;
      else if (url.includes('/api/profile')) mockData = MOCKS.MOCK_PROFILE;
      else if (url.includes('/api/settings')) mockData = MOCKS.MOCK_SETTINGS;
      else if (url.includes('/api/dashboard')) mockData = MOCKS.MOCK_DASHBOARD_STATS;
      else if (url.includes('/api/contacts')) mockData = MOCKS.MOCK_CONTACTS;
      else if (url.includes('/api/email-templates')) mockData = MOCKS.MOCK_EMAIL_TEMPLATES;
      else if (url.includes('/api/codegraph')) mockData = { status: 'mock' }; // Intelligence components mock
      else if (url.includes('/api/graphify')) mockData = { status: 'mock' }; 
      else if (url.includes('/api/download-pdf')) {
        const dummyPdfContent = "%PDF-1.4\\n1 0 obj\\n<<\\n/Title (Mock PDF)\\n>>\\nendobj\\ntrailer\\n<<\\n/Root 1 0 R\\n>>\\n%%EOF";
        const blob = new Blob([dummyPdfContent], { type: 'application/pdf' });
        return new Response(blob, {
          status: 200,
          headers: { 'Content-Type': 'application/pdf' }
        });
      }
      else mockData = { success: true }; // Fallback

      return new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(input, init);
  };
}

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
