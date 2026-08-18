import useSWR, { mutate as globalMutate } from 'swr';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/shared/context/AuthContext';
import { auth } from '@/infrastructure/_legacy_firebase/client';

// ─── Auth-aware fetch helper ─────────────────────────────────────────────────

async function authFetch(url, token, options = {}) {
  if (!token) throw new Error('Not authenticated');

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = new Error('API request failed');
    error.status = res.status;
    try { error.info = await res.json(); } catch { error.info = { error: res.statusText }; }

    if (error.status >= 500) {
      toast.error(error.info?.error || 'Server error occurred');
    }

    throw error;
  }

  return res.json();
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export function useJobs(page = 1, limit = 500, filters = {}) {
  const offset = (page - 1) * limit;
  const { user, session } = useAuth();
  const token = session?.access_token;
  
  const queryParams = new URLSearchParams({
    page,
    limit,
    offset,
    ...(filters.role && { role: filters.role }),
    ...(filters.location && { location: filters.location }),
    ...(filters.time && { time: filters.time })
  }).toString();

  const fetchJobs = async () => {
    return authFetch(`/api/jobs?${queryParams}`, token);
  };

  const { data, error, mutate } = useSWR(user ? ['jobs', user.uid, queryParams] : null, fetchJobs);

  const addJob = async (jobData) => {
    return authFetch('/api/jobs', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData)
    }).then(() => mutate());
  };

  const updateJob = async (id, updates) => {
    return authFetch('/api/jobs', token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates })
    }).then(() => mutate());
  };

  const deleteJob = async (id) => {
    return authFetch(`/api/jobs?id=${id}`, token, {
      method: 'DELETE'
    }).then(() => mutate());
  };

  return {
    jobs: data?.jobs || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading: !error && !data,
    isError: error,
    errorDetails: error?.info || null,
    addJob,
    updateJob,
    deleteJob,
    mutate,
  };
}

// ─── Applications ────────────────────────────────────────────────────────────

export function useApplications(page = 1, limit = 500) {
  const offset = (page - 1) * limit;
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchApplications = async () => {
    return authFetch(`/api/applications?page=${page}&limit=${limit}&offset=${offset}`, token);
  };

  const { data, error, mutate } = useSWR(user ? ['applications', user.uid, page, limit] : null, fetchApplications);

  const addApplication = async (appData) => {
    const data = await authFetch('/api/applications', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });
    mutate();
    return data.id;
  };

  const updateApplication = async (id, updates) => {
    await authFetch('/api/applications', token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates })
    });
    mutate();
  };

  const bulkUpdateApplications = async (ids, updates) => {
    if (!user || !ids.length) return;
    await authFetch('/api/applications', token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, ...updates })
    });
    mutate();
  };

  const deleteApplication = async (id) => {
    await authFetch(`/api/applications/${id}`, token, {
      method: 'DELETE'
    });
    mutate();
  };

  return {
    applications: data?.applications || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    limit: data?.limit || limit,
    offset: data?.offset || offset,
    isLoading: !error && !data,
    isError: error,
    errorDetails: error?.info,
    mutate,
    addApplication,
    updateApplication,
    bulkUpdateApplications,
    deleteApplication
  };
}

// ─── Emails ──────────────────────────────────────────────────────────────────

export function useEmails(type = 'inbox', searchQuery = '', limitCount = 500, offset = 0) {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchEmails = async () => {
    const params = new URLSearchParams({
      type: type || 'inbox',
      limit: limitCount.toString(),
      offset: offset.toString()
    });
    if (searchQuery) params.append('q', searchQuery);

    return authFetch(`/api/emails?${params.toString()}`, token);
  };

  const { data, error, mutate } = useSWR(user ? ['emails', user.uid, type, searchQuery, limitCount, offset] : null, fetchEmails, { refreshInterval: 5000 });

  const addEmail = async (emailData) => {
    const data = await authFetch('/api/emails', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });
    mutate();
    return data;
  };

  return {
    emails: data?.emails || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    limit: data?.limit || limitCount,
    offset: data?.offset || offset,
    isLoading: !error && !data,
    isError: error,
    mutate,
    addEmail
  };
}

// ─── Tracking Events ─────────────────────────────────────────────────────────

export function useTrackingEvents(applicationId) {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchEvents = async () => {
    if (!applicationId) return [];
    const data = await authFetch(`/api/applications/${applicationId}/tracking`, token);
    return data.events || [];
  };

  const { data, error, mutate } = useSWR(user && applicationId ? ['tracking_events', user.uid, applicationId] : null, fetchEvents);

  const addEvent = async (eventData) => {
    const data = await authFetch(`/api/applications/${applicationId}/tracking`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    mutate();
    return data.id;
  };

  return {
    events: data || [],
    isLoading: !error && !data,
    isError: error,
    mutate,
    addEvent
  };
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export function useCalendar() {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchCalendar = async () => {
    const data = await authFetch('/api/calendar', token);
    return data.events || [];
  };

  const { data, error, mutate } = useSWR(user ? ['calendar', user.uid] : null, fetchCalendar);

  const addEvent = async (eventData) => {
    const data = await authFetch('/api/calendar', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    mutate();
    return data.event?.id;
  };

  const deleteEvent = async (id) => {
    await authFetch(`/api/calendar?id=${id}`, token, {
      method: 'DELETE'
    });
    mutate();
  };

  return {
    events: data || [],
    isLoading: !error && !data,
    isError: error,
    mutate,
    addEvent,
    deleteEvent
  };
}

// ─── Settings ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  gmail_user: '',
  sender_name: '',
  resume_prefix: 'Resume',
  build_path: '',
  linkedin_keywords: '',
  max_posts_per_scan: 200,
  auto_scan_interval: 'off',
  min_ats_threshold: 40,
  headless_mode: true,
  auto_date_naming: true,
  auto_apply: false,
  sync_enabled: false,
  email_signature: '',
  is_onboarded: false
};

export function useSettings() {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchSettings = async () => {
    return authFetch('/api/settings', token);
  };

  const { data, error, mutate } = useSWR(user ? ['settings', user.uid] : null, fetchSettings);

  const updateSettings = async (updates) => {
    if (!user) return;
    const result = await authFetch('/api/settings', token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    mutate();
    return result;
  };

  return {
    settings: data || DEFAULT_SETTINGS,
    isLoading: !error && !data,
    isError: error,
    mutate,
    updateSettings
  };
}

// ─── Email Counts ────────────────────────────────────────────────────────────

export function useEmailCounts() {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchCounts = async () => {
    return authFetch('/api/emails/counts', token);
  };
  const { data, error, mutate } = useSWR(user ? ['emailCounts', user.uid] : null, fetchCounts);
  return {
    counts: data || { inbox: 0, sent: 0, draft: 0, scheduled: 0, trash: 0, starred: 0 },
    isLoading: !error && !data,
    mutate
  };
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export function useProfile() {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchProfile = async () => {
    return authFetch('/api/profile', token);
  };

  const { data, error, mutate } = useSWR(user ? ['profile', user.uid] : null, fetchProfile);

  const updateProfile = async (updates) => {
    if (!user) return;
    await authFetch('/api/profile', token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    mutate();
  };

  // Compute profile completion state
  const profile = data || null;
  const missingFields = [];
  
  if (profile && Object.keys(profile).length > 0) {
    if (!profile.name || !profile.email || !profile.phone) missingFields.push('Contact Information');
    if (!profile.experience || profile.experience.length === 0) missingFields.push('Experience');
    if (!profile.skills || profile.skills.length === 0) missingFields.push('Skills');
    if (!profile.education || profile.education.length === 0) missingFields.push('Education');
    if (!profile.projects || profile.projects.length === 0) missingFields.push('Projects');
    if (!profile.portfolio_links || profile.portfolio_links.length === 0) missingFields.push('Portfolio Links');
  } else {
    // If loading or empty, assume all fields are missing
    missingFields.push('Contact Information', 'Experience', 'Skills', 'Education', 'Projects', 'Portfolio Links');
  }

  const totalRequiredFields = 6;
  const completionPercentage = Math.round(((totalRequiredFields - missingFields.length) / totalRequiredFields) * 100);
  const isComplete = completionPercentage === 100;

  return {
    profile,
    missingFields,
    completionPercentage,
    isComplete,
    isLoading: !error && !data,
    isError: error,
    mutate,
    updateProfile
  };
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export function useDashboardStats(timeFilter = 'all') {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchStats = async () => {
    return authFetch(`/api/dashboard?timeFilter=${timeFilter}`, token);
  };

  const { data, error, mutate } = useSWR(user ? ['dashboardStats', user.uid, timeFilter] : null, fetchStats);
  return {
    stats: data || { metrics: {}, sparklineData: [], funnelData: [], nextInterview: null, activityFeed: [], needsAttention: [], isEmpty: true },
    isLoading: !error && !data,
    mutate
  };
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export function useContacts(page = 1, limit = 500) {
  const offset = (page - 1) * limit;
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchContacts = async () => {
    return authFetch(`/api/contacts?page=${page}&limit=${limit}&offset=${offset}`, token);
  };

  const { data, error, mutate } = useSWR(user ? ['contacts', user.uid, page, limit] : null, fetchContacts);

  const addContact = async (contactData) => {
    const data = await authFetch('/api/contacts', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactData)
    });
    mutate();
    return data;
  };

  return {
    contacts: data?.contacts || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    limit: data?.limit || limit,
    offset: data?.offset || offset,
    isLoading: !error && !data,
    isError: error,
    errorDetails: error?.info,
    mutate,
    addContact
  };
}

// ─── Email Sync Engine ───────────────────────────────────────────────────────

export function useEmailSyncEngine(intervalMs = 60000) {
  const { settings } = useSettings();
  const { user, session } = useAuth();
  const token = session?.access_token;

  useEffect(() => {
    // Sync runs whenever we have auth — IMAP uses App Password from env, not OAuth
    // The sync_enabled flag is a legacy from Google OAuth flow.
    // We now always sync when credentials are available.
    if (!user || !token) return;

    let isSyncing = false;
    let cancelled = false;

    const sync = async () => {
      if (isSyncing || cancelled) return;
      isSyncing = true;
      
      const MAX_LOOPS = 10; // Prevent infinite loops
      let loopCount = 0;
      let totalSynced = 0;

      try {
        // Auto-loop: keep syncing until all pending emails are processed
        while (loopCount < MAX_LOOPS && !cancelled) {
          loopCount++;
          
          const res = await fetch('/api/emails/sync', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!res.ok) {
            if (res.status === 403) {
              console.warn('Email sync skipped: App Password not configured or invalid.');
            } else if (res.status === 429) {
              console.warn('Email sync rate limited. Will retry next interval.');
            } else {
              console.error('Email sync failed:', res.status);
            }
            break;
          }

          const data = await res.json();
          totalSynced += (data.count || 0);

          // If no more pending emails, stop looping
          if (!data.has_more || data.count === 0) {
            break;
          }

          // Small delay between loops to avoid hammering the server
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Trigger SWR revalidation so all pages update in real-time
        if (totalSynced > 0) {
          // SWR keys are arrays like ['applications', userId, page, limit]
          // Must check both array[0] and string keys for compatibility
          const keysToInvalidate = ['applications', 'emails', 'emailCounts', 'calendar', 'dashboardStats'];
          globalMutate(
            key => {
              if (Array.isArray(key)) return keysToInvalidate.includes(key[0]);
              if (typeof key === 'string') return keysToInvalidate.some(k => key.includes(k));
              return false;
            },
            undefined,
            { revalidate: true }
          );
        }
      } catch (err) {
        console.error('Background sync failed:', err);
      } finally {
        isSyncing = false;
      }
    };

    // Run immediately on mount
    sync();

    // Set up polling interval
    const interval = setInterval(sync, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [intervalMs, user, token]);
}

// ─── Email Templates ─────────────────────────────────────────────────────────

export function useEmailTemplates() {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const fetchTemplates = async () => {
    return authFetch('/api/email-templates', token);
  };

  const { data, error, isLoading, mutate } = useSWR(user ? ['email_templates', user.uid] : null, fetchTemplates);

  const addTemplate = async (templateData) => {
    if (!user) return;
    try {
      await authFetch('/api/email-templates', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });
      mutate();
      toast.success('Template added successfully');
    } catch (e) {
      toast.error('Failed to add template: ' + e.message);
      throw e;
    }
  };

  const updateTemplate = async (id, updateData) => {
    if (!user) return;
    try {
      await authFetch('/api/email-templates', token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updateData })
      });
      mutate();
      toast.success('Template updated');
    } catch (e) {
      toast.error('Failed to update: ' + e.message);
      throw e;
    }
  };

  const deleteTemplate = async (id) => {
    if (!user) return;
    try {
      await authFetch(`/api/email-templates/${id}`, token, { method: 'DELETE' });
      mutate();
      toast.success('Template deleted');
    } catch (e) {
      toast.error('Failed to delete: ' + e.message);
      throw e;
    }
  };

  return {
    templates: data || [],
    isLoading,
    isError: error,
    mutate,
    addTemplate,
    updateTemplate,
    deleteTemplate
  };
}
