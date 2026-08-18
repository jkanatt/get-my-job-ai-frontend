/**
 * Event Deduplicator — Detects and merges duplicate news/funding events
 * ═══════════════════════════════════════════════════════════════════════
 * When multiple sources report the same funding round or news event,
 * this module detects duplicates and consolidates them into a single
 * record with multiple supporting sources.
 */

import crypto from 'crypto';
import { normalizeCompanyName, similarity } from './EntityResolver.js';

/**
 * Generate a deduplication hash for a funding event.
 * Two funding events with the same hash are considered duplicates.
 */
export function generateFundingHash(event) {
  const components = [
    normalizeCompanyName(event.companyName || ''),
    (event.funding?.round || 'unknown').toLowerCase(),
    approximateAmount(event.funding?.amountUsd),
    approximateDate(event.publishedAt || event.funding?.date),
  ].join('|');

  return crypto.createHash('sha256').update(components).digest('hex').slice(0, 32);
}

/**
 * Generate a deduplication hash for a news event.
 */
export function generateNewsHash(event) {
  const components = [
    normalizeCompanyName(event.companyName || ''),
    (event.category || 'other').toLowerCase(),
    normalizeTitle(event.title || ''),
    approximateDate(event.publishedAt),
  ].join('|');

  return crypto.createHash('sha256').update(components).digest('hex').slice(0, 32);
}

/**
 * Deduplicate a list of scraped items.
 * Returns consolidated items with multiple sources merged.
 *
 * @param {object[]} items - All scraped items from multiple sources
 * @returns {object[]} Deduplicated items
 */
export function deduplicateEvents(items) {
  const groups = new Map();

  for (const item of items) {
    const hash = item.category === 'funding' && item.funding
      ? generateFundingHash(item)
      : generateNewsHash(item);

    if (groups.has(hash)) {
      // Merge with existing group
      const existing = groups.get(hash);
      existing.sources.push({
        id: item.sourceId,
        name: item.sourceName,
        url: item.sourceUrl,
      });
      existing.sourceCount += 1;

      // Keep the most detailed version
      if ((item.description?.length || 0) > (existing.description?.length || 0)) {
        existing.description = item.description;
      }
      if (item.funding && !existing.funding) {
        existing.funding = item.funding;
      }
      // Merge investor lists
      if (item.funding?.otherInvestors?.length) {
        const existingInvestors = new Set(existing.funding?.otherInvestors || []);
        for (const inv of item.funding.otherInvestors) {
          existingInvestors.add(inv);
        }
        if (existing.funding) {
          existing.funding.otherInvestors = [...existingInvestors];
        }
      }
    } else {
      // New unique event
      groups.set(hash, {
        ...item,
        dedupeHash: hash,
        sources: [{
          id: item.sourceId,
          name: item.sourceName,
          url: item.sourceUrl,
        }],
        sourceCount: 1,
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Find near-duplicates using semantic similarity.
 * Catches events that have different wording but describe the same thing.
 */
export function findNearDuplicates(items, threshold = 0.85) {
  const duplicatePairs = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];

      // Only compare items in the same category
      if (a.category !== b.category) continue;

      // Company name must be similar
      const companySim = similarity(a.companyName || '', b.companyName || '');
      if (companySim < 0.7) continue;

      // Title similarity
      const titleSim = similarity(
        normalizeTitle(a.title || ''),
        normalizeTitle(b.title || '')
      );

      // Date proximity (within 7 days)
      const dateClose = areDatesClose(a.publishedAt, b.publishedAt, 7);

      if (titleSim >= threshold && dateClose) {
        duplicatePairs.push({
          indexA: i,
          indexB: j,
          similarity: titleSim,
          companySimilarity: companySim,
        });
      }

      // For funding events, also check amount + round match
      if (a.category === 'funding' && b.category === 'funding') {
        if (a.funding && b.funding) {
          const amountMatch = approximateAmount(a.funding.amountUsd) === approximateAmount(b.funding.amountUsd);
          const roundMatch = a.funding.round === b.funding.round;

          if (amountMatch && roundMatch && companySim >= 0.7 && dateClose) {
            duplicatePairs.push({
              indexA: i,
              indexB: j,
              similarity: 0.95,
              companySimilarity: companySim,
              matchType: 'funding-data',
            });
          }
        }
      }
    }
  }

  return duplicatePairs;
}

/**
 * Merge near-duplicates into consolidated events.
 */
export function mergeNearDuplicates(items, threshold = 0.85) {
  const duplicatePairs = findNearDuplicates(items, threshold);
  if (duplicatePairs.length === 0) return items;

  // Build union-find groups
  const parent = Array.from({ length: items.length }, (_, i) => i);
  const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (i, j) => { parent[find(i)] = find(j); };

  for (const pair of duplicatePairs) {
    union(pair.indexA, pair.indexB);
  }

  // Group items by their root
  const groupMap = new Map();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root).push(items[i]);
  }

  // Merge each group
  return Array.from(groupMap.values()).map(group => {
    if (group.length === 1) return group[0];

    // Use the item with the most detail as the base
    const base = group.reduce((best, item) => {
      const score = (item.description?.length || 0) + (item.funding ? 50 : 0) + (item.sources?.length || 1) * 10;
      const bestScore = (best.description?.length || 0) + (best.funding ? 50 : 0) + (best.sources?.length || 1) * 10;
      return score > bestScore ? item : best;
    });

    // Merge all sources
    const allSources = [];
    const seenUrls = new Set();
    for (const item of group) {
      const sources = item.sources || [{ id: item.sourceId, name: item.sourceName, url: item.sourceUrl }];
      for (const src of sources) {
        if (!seenUrls.has(src.url)) {
          seenUrls.add(src.url);
          allSources.push(src);
        }
      }
    }

    return {
      ...base,
      sources: allSources,
      sourceCount: allSources.length,
    };
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Approximate an amount to a bucket for comparison.
 * $14.5M and $15M should be considered the same.
 */
function approximateAmount(amount) {
  if (!amount || amount === 0) return '0';
  if (amount < 1_000_000) return `${Math.round(amount / 100_000)}00k`;
  if (amount < 1_000_000_000) return `${Math.round(amount / 1_000_000)}m`;
  return `${Math.round(amount / 100_000_000) / 10}b`;
}

/**
 * Approximate a date to week-level for comparison.
 */
function approximateDate(dateStr) {
  if (!dateStr) return 'unknown';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const week = Math.floor(date.getDate() / 7);
    const month = date.getMonth();
    return `${year}-${month}-w${week}`;
  } catch {
    return 'unknown';
  }
}

/**
 * Check if two dates are within N days of each other.
 */
function areDatesClose(dateA, dateB, maxDays = 7) {
  if (!dateA || !dateB) return true; // If dates are missing, don't disqualify
  try {
    const a = new Date(dateA);
    const b = new Date(dateB);
    const diffMs = Math.abs(a.getTime() - b.getTime());
    return diffMs <= maxDays * 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

/**
 * Normalize a title for comparison (remove filler words, punctuation).
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|a|an|in|at|on|for|to|of|and|or|is|has|was|will|by|with|from)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
