/**
 * Career Portal Scraper v2.0 — Production-Grade Multi-Source Engine
 * ══════════════════════════════════════════════════════════════════════
 * Scrapes ALL company career pages with parallel batch processing.
 *
 * Key upgrades from v1:
 *   - Parallel batching: 5 concurrent requests (configurable)
 *   - No portal cap: scans ALL enabled portals
 *   - Stale job cleanup: removes jobs older than N days
 *   - Auto-scan cooldown: checks last scan timestamp (3-hour window)
 *   - Retry with exponential backoff on transient errors
 *   - Connection pooling via shared axios instance
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

// ─── User-Agent Pool ────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0',
];

const REQUEST_TIMEOUT = 20_000;
const BATCH_SIZE = 5;            // 5 concurrent requests
const INTER_BATCH_DELAY = 800;   // 800ms between batches
const MAX_RETRIES = 2;           // Retry transient failures
const STALE_JOB_DAYS = 10;       // Remove jobs older than 10 days

// ─── Keyword matching ───────────────────────────────────────────────
const PM_KEYWORDS = [
  'product manager', 'product management', 'product lead', 'product owner',
  'product director', 'product head', 'product strategy', 'product analyst',
  'growth manager', 'growth lead', 'chief of staff', 'program manager',
  'group product manager', 'senior product manager', 'associate product manager',
  'principal product manager', 'vp product', 'head of product',
  'technical program manager', 'product marketing', 'business analyst',
  'strategy manager', 'operations manager', 'project manager',
];

function matchesKeywords(text, userKeywords = []) {
  const lower = (text || '').toLowerCase();
  const allKeywords = [...PM_KEYWORDS, ...userKeywords.map(k => k.toLowerCase())];
  return allKeywords.some(kw => lower.includes(kw));
}

function computeUrlHash(url) {
  return 'portal_' + crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
}

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Shared Axios Instance with connection pooling ──────────────────
const httpClient = axios.create({
  timeout: REQUEST_TIMEOUT,
  maxRedirects: 5,
  validateStatus: s => s < 400,
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});

// ─── Job Listing Extraction ─────────────────────────────────────────
const JOB_CARD_SELECTORS = [
  '.job-listing a', '.job-card a', '.job-item a', '.job-row a',
  '.position-listing a', '.position-card a', '.career-listing a',
  '.opening a', '.vacancy a', '.role-card a',
  '[data-job] a', '[data-role] a', '[data-position] a',
  '.css-19uc56f a', '.posting-title a', '.posting a',
  '.job-title a', '.job-name a',
  'li a[href*="job"]', 'li a[href*="position"]', 'li a[href*="career"]',
  'li a[href*="opening"]', 'li a[href*="apply"]', 'li a[href*="requisition"]',
  'div a[href*="job"]', 'div a[href*="position"]',
  'tr a[href*="job"]', 'tr a[href*="career"]',
  'a[href*="/jobs/"]', 'a[href*="/careers/"]', 'a[href*="/positions/"]',
  'a[href*="/openings/"]', 'a[href*="requisition"]',
  // Workday, Greenhouse, Lever specific
  'a[href*="myworkdayjobs"]', 'a[href*="greenhouse"]', 'a[href*="lever.co"]',
  'a[href*="smartrecruiters"]', 'a[href*="eightfold"]', 'a[href*="ashbyhq"]',
];

const TITLE_SELECTORS = [
  'h2', 'h3', 'h4', '.job-title', '.position-title', '.role-title',
  '.posting-name', '.job-name', '[data-title]', '.title',
];

function resolveUrl(href, baseUrl) {
  if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) return null;
  if (href.startsWith('http')) return href;
  try {
    const url = new URL(baseUrl);
    if (href.startsWith('/')) {
      return `${url.protocol}//${url.host}${href}`;
    }
    return `${baseUrl.replace(/\/$/, '')}/${href}`;
  } catch {
    return null;
  }
}

function extractJobsFromHTML($, baseUrl, portal) {
  const jobs = [];
  const seenUrls = new Set();

  // Strategy 1: Selectors
  for (const selector of JOB_CARD_SELECTORS) {
    try {
      $(selector).each((_, el) => {
        const $el = $(el);
        let href = $el.attr('href') || '';
        let title = $el.text().trim();

        const fullUrl = resolveUrl(href, baseUrl);
        if (!fullUrl || seenUrls.has(fullUrl)) return;
        if (title.length < 5 || title.length > 200) return;

        seenUrls.add(fullUrl);

        // Try to get a better title from parent
        const parent = $el.closest('li, div, tr, article, section');
        if (parent.length) {
          for (const ts of TITLE_SELECTORS) {
            const titleEl = parent.find(ts).first();
            if (titleEl.length && titleEl.text().trim().length > 5) {
              title = titleEl.text().trim();
              break;
            }
          }
        }

        title = title.replace(/\s+/g, ' ').trim();
        if (title.length < 5) return;

        let location = '';
        if (parent.length) {
          const locEl = parent.find('.location, .job-location, [data-location], .city').first();
          if (locEl.length) location = locEl.text().trim();
        }

        jobs.push({
          title,
          url: fullUrl,
          location: location || 'India',
          company: portal.name,
          source: 'career_portal',
          portalId: portal.id,
          category: portal.category,
        });
      });
    } catch {
      // Selector might fail on some pages
    }
    if (jobs.length >= 100) break;
  }

  // Strategy 2: Text-based fallback
  if (jobs.length === 0) {
    $('a').each((_, el) => {
      if (jobs.length >= 50) return false;
      const $el = $(el);
      const text = $el.text().trim();
      const href = $el.attr('href') || '';

      const fullUrl = resolveUrl(href, baseUrl);
      if (!fullUrl || seenUrls.has(fullUrl)) return;
      if (text.length < 10 || text.length > 200) return;

      if (matchesKeywords(text)) {
        seenUrls.add(fullUrl);
        jobs.push({
          title: text.replace(/\s+/g, ' ').trim(),
          url: fullUrl,
          location: 'India',
          company: portal.name,
          source: 'career_portal',
          portalId: portal.id,
          category: portal.category,
        });
      }
    });
  }

  return jobs;
}

// ─── Single portal scraper with retry ───────────────────────────────
async function scrapeOnePortal(portal, userKeywords) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data: html, status } = await httpClient.get(portal.url, {
        headers: { 'User-Agent': randomUA() },
      });

      if (!html || typeof html !== 'string') {
        return { portal, jobs: [], error: 'Empty response' };
      }

      const $ = cheerio.load(html);
      $('script, style, noscript, svg, iframe, header, footer, nav').remove();

      const jobs = extractJobsFromHTML($, portal.url, portal);
      const relevant = jobs.filter(j => matchesKeywords(j.title, userKeywords));

      for (const job of relevant) {
        job.job_url_hash = computeUrlHash(job.url);
        job.skills = [];
        job.status = 'new';
        job.ats_score = 60;
      }

      return { portal, jobs: relevant, error: null };

    } catch (err) {
      lastError = err.response?.status
        ? `HTTP ${err.response.status}`
        : err.code === 'ECONNABORTED' ? 'Timeout'
        : err.code === 'ENOTFOUND' ? 'DNS Error'
        : err.message?.substring(0, 60);

      // Don't retry on 4xx (client errors)
      if (err.response?.status >= 400 && err.response?.status < 500) {
        return { portal, jobs: [], error: lastError };
      }

      // Wait before retry
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  return { portal, jobs: [], error: lastError };
}

// ─── Main scraper: Parallel batch processing ────────────────────────
/**
 * Scrape ALL career portals with parallel batching.
 *
 * @param {object[]} portals - Portal configs from career-portals.json
 * @param {string[]} userKeywords - User's target keywords
 * @param {function} onProgress - Callback(portal, jobs, index, total, error)
 * @param {object} options - { batchSize, calculateAtsScore }
 * @returns {Promise<{jobs, errors, totalScanned, stats}>}
 */
export async function scrapeCareerPortals(portals, userKeywords = [], onProgress = null, options = {}) {
  const { batchSize = BATCH_SIZE, calculateAtsScore = null } = options;
  const allJobs = [];
  const errors = [];
  const stats = { success: 0, failed: 0, totalJobs: 0 };

  // Filter enabled portals and sort by priority
  const enabled = portals.filter(p => p.enabled !== false)
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  const total = enabled.length;
  let processed = 0;

  // Process in batches of `batchSize`
  for (let i = 0; i < enabled.length; i += batchSize) {
    const batch = enabled.slice(i, i + batchSize);

    // Run batch concurrently
    const results = await Promise.allSettled(
      batch.map(portal => scrapeOnePortal(portal, userKeywords))
    );

    for (const result of results) {
      processed++;

      if (result.status === 'fulfilled') {
        const { portal, jobs, error } = result.value;

        if (error) {
          errors.push({ portal: portal.name, id: portal.id, error });
          stats.failed++;
        } else {
          stats.success++;
        }

        // Apply custom ATS scoring
        if (calculateAtsScore) {
          for (const job of jobs) {
            job.ats_score = calculateAtsScore(job.title, job.skills, userKeywords);
          }
        }

        allJobs.push(...jobs);
        stats.totalJobs += jobs.length;

        if (onProgress) {
          onProgress(portal, jobs, processed - 1, total, error);
        }
      } else {
        // Promise rejected (shouldn't happen with our try/catch, but safety net)
        processed++;
        stats.failed++;
        errors.push({ portal: batch[0]?.name || 'Unknown', error: 'Promise rejected' });
      }
    }

    // Delay between batches (not after the last batch)
    if (i + batchSize < enabled.length) {
      await sleep(INTER_BATCH_DELAY);
    }
  }

  return { jobs: allJobs, errors, totalScanned: total, stats };
}

/**
 * Filter portals by category.
 */
export function filterPortalsByCategory(portals, categories = []) {
  if (!categories.length || categories.includes('all')) return portals;
  return portals.filter(p => categories.includes(p.category));
}

/**
 * Get category summary from portals.
 */
export function getCategorySummary(portals) {
  const summary = {};
  for (const p of portals) {
    if (!summary[p.category]) {
      summary[p.category] = { count: 0, enabled: 0 };
    }
    summary[p.category].count++;
    if (p.enabled !== false) summary[p.category].enabled++;
  }
  return summary;
}

/**
 * Calculate the stale cutoff date (jobs older than STALE_JOB_DAYS).
 * @returns {string} ISO date string for the cutoff
 */
export function getStaleJobCutoffDate(days = STALE_JOB_DAYS) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString();
}

/**
 * Check if a scan was performed within the cooldown window.
 * @param {object} supabase - Supabase client
 * @param {number} cooldownHours - Hours since last scan to consider "recent"
 * @returns {Promise<{shouldScan: boolean, lastScan: string|null, hoursSince: number}>}
 */
export async function checkScanCooldown(supabase, cooldownHours = 3) {
  try {
    const { data: lastScan } = await supabase
      .from('scan_history')
      .select('created_at, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastScan) {
      return { shouldScan: true, lastScan: null, hoursSince: Infinity };
    }

    const lastScanTime = new Date(lastScan.created_at);
    const now = new Date();
    const hoursSince = (now - lastScanTime) / (1000 * 60 * 60);

    return {
      shouldScan: hoursSince >= cooldownHours,
      lastScan: lastScan.created_at,
      hoursSince: Math.round(hoursSince * 10) / 10,
    };
  } catch {
    // If query fails, allow scan
    return { shouldScan: true, lastScan: null, hoursSince: Infinity };
  }
}

/**
 * Delete stale jobs (older than N days) from the database.
 * @param {object} supabase - Supabase client
 * @param {number} days - Delete jobs older than this many days
 * @returns {Promise<{deleted: number, error: string|null}>}
 */
export async function deleteStaleJobs(supabase, days = STALE_JOB_DAYS) {
  const cutoff = getStaleJobCutoffDate(days);

  try {
    // Only delete career_portal and API-sourced jobs, not manually added ones
    const { data, error } = await supabase
      .from('jobs')
      .delete()
      .lt('created_at', cutoff)
      .in('source', ['career_portal', 'remoteok', 'arbeitnow'])
      .select('id');

    if (error) {
      return { deleted: 0, error: error.message };
    }

    return { deleted: data?.length || 0, error: null };
  } catch (err) {
    return { deleted: 0, error: err.message };
  }
}
