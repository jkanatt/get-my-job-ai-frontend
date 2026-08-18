'use client';

import useSWR from 'swr';
import { useAuth } from '@/shared/context/AuthContext';

/**
 * Simple fetch helper — no auth required for intelligence reads.
 */
async function publicFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('API request failed');
    error.status = res.status;
    try { error.info = await res.json(); } catch { error.info = { error: res.statusText }; }
    throw error;
  }
  return res.json();
}

/**
 * Auth-aware fetch helper — for protected endpoints.
 */
async function authFetch(url, token) {
  if (!token) throw new Error('Not authenticated');

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const error = new Error('API request failed');
    error.status = res.status;
    try { error.info = await res.json(); } catch { error.info = { error: res.statusText }; }
    throw error;
  }

  return res.json();
}

/**
 * Hook for fetching paginated, filtered funding data.
 * Public read — no authentication required.
 */
export function useFundings(filters = {}) {
  const params = new URLSearchParams();
  if (filters.region) params.set('region', filters.region);
  if (filters.industry) params.set('industry', filters.industry);
  if (filters.round) params.set('round', filters.round);
  if (filters.amountMin) params.set('amount_min', filters.amountMin);
  if (filters.amountMax) params.set('amount_max', filters.amountMax);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.investor) params.set('investor', filters.investor);
  if (filters.location) params.set('location', filters.location);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();

  const { data, error, isLoading, mutate } = useSWR(
    ['fundings', qs],
    () => publicFetch(`/api/intelligence/fundings${qs ? `?${qs}` : ''}`),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  return {
    fundings: data?.fundings || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook for full company intelligence data.
 * Public read — no authentication required.
 */
export function useCompanyIntelligence(companyId) {
  const { data, error, isLoading, mutate } = useSWR(
    companyId ? ['company-intel', companyId] : null,
    () => publicFetch(`/api/intelligence/companies/${companyId}`),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    company: data?.company || null,
    fundingHistory: data?.fundingHistory || [],
    people: data?.people || [],
    investors: data?.investors || [],
    newsEvents: data?.newsEvents || [],
    jobs: data?.jobs || [],
    hiringMetrics: data?.hiringMetrics || null,
    signals: data?.signals || [],
    snapshots: data?.snapshots || [],
    timeline: data?.timeline || [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook for paginated, categorized news feed.
 * Public read — no authentication required.
 */
export function useNews(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.companyId) params.set('company_id', filters.companyId);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.location) params.set('location', filters.location);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();

  const { data, error, isLoading, mutate } = useSWR(
    ['news', qs],
    () => publicFetch(`/api/intelligence/news${qs ? `?${qs}` : ''}`),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  return {
    news: data?.news || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    categoryStats: data?.categoryStats || {},
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook for a single news event detail.
 */
export function useNewsEvent(id) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? ['newsEvent', id] : null,
    () => publicFetch(`/api/intelligence/news/${id}`),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    event: data,
    isLoading,
    error,
    mutate,
  };
}
