/**
 * GDELT 2.0 Connector
 * ═══════════════════════════════════════════════════════════════════════
 * Free, no-key global news event API (gdeltproject.org). Catches funding,
 * M&A, layoffs, and hiring news worldwide that India-focused RSS feeds miss.
 *
 * Endpoint: https://api.gdeltproject.org/api/v2/doc/doc
 * Rate limit: None enforced, but be respectful (max 1 req/sec).
 * Updates: Every 15 minutes.
 */

import axios from 'axios';
import crypto from 'crypto';
import { parseAmount, normalizeRoundType, NEWS_CATEGORY_PATTERNS } from '../SourceRegistry.js';

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';
const USER_AGENT = 'Get My Job-Intelligence/1.0';
const REQUEST_TIMEOUT = 20_000;

/**
 * Discover articles from GDELT matching a funding/startup query.
 *
 * @param {string} query - Search query
 * @param {number} maxRecords - Max articles to fetch
 * @param {string} timespan - GDELT timespan (e.g., "1d", "7d", "30d")
 * @returns {Promise<object[]>} Array of extracted items
 */
export async function discoverGDELT(query = 'startup funding', maxRecords = 50, timespan = '7d') {
  const items = [];

  try {
    const params = new URLSearchParams({
      query: query,
      mode: 'artlist',
      format: 'json',
      maxrecords: String(maxRecords),
      timespan: timespan,
      sort: 'DateDesc',
    });

    const { data } = await axios.get(`${GDELT_BASE}?${params.toString()}`, {
      timeout: REQUEST_TIMEOUT,
      headers: { 'User-Agent': USER_AGENT },
    });

    const articles = data?.articles || [];
    console.log(`[GDELT] Found ${articles.length} articles for "${query}"`);

    for (const article of articles) {
      try {
        const item = parseGDELTArticle(article, query);
        if (item) items.push(item);
      } catch (err) {
        // Non-fatal: individual article parse failures are expected
      }
    }
  } catch (err) {
    console.error(`[GDELT] Discovery failed for "${query}":`, err.message);
  }

  return items;
}

/**
 * Parse a single GDELT article into our standard item format.
 */
function parseGDELTArticle(article, queryContext) {
  const title = article.title || '';
  const url = article.url || '';
  const domain = article.domain || '';
  const seenDate = article.seendate || '';
  const language = article.language || 'English';
  const sourceCountry = article.sourcecountry || '';

  if (!title || !url) return null;

  // Skip non-English articles unless they're from Indian sources
  if (language !== 'English' && !isIndianSource(domain, sourceCountry)) {
    return null;
  }

  // Classify the article
  const category = classifyGDELTArticle(title, queryContext);
  const companyName = extractCompanyFromGDELT(title);
  const funding = extractFundingFromGDELT(title);
  const region = determineRegion(sourceCountry, domain, title);

  // Parse GDELT's date format (YYYYMMDDTHHMMSS)
  let publishedAt = null;
  if (seenDate) {
    try {
      const year = seenDate.slice(0, 4);
      const month = seenDate.slice(4, 6);
      const day = seenDate.slice(6, 8);
      const hour = seenDate.slice(9, 11) || '00';
      const minute = seenDate.slice(11, 13) || '00';
      publishedAt = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`).toISOString();
    } catch { /* non-fatal */ }
  }

  const dedupeHash = crypto
    .createHash('sha256')
    .update(`gdelt:${url}`)
    .digest('hex')
    .slice(0, 32);

  return {
    sourceId: 'gdelt',
    sourceName: `GDELT · ${domain}`,
    sourceUrl: url,
    title,
    description: '', // GDELT artlist mode doesn't return snippets
    publishedAt,
    category,
    companyName,
    funding,
    region,
    sourceType: 'news',
    dedupeHash,
    rawData: {
      gdeltDomain: domain,
      gdeltLanguage: language,
      gdeltCountry: sourceCountry,
      gdeltSocialImage: article.socialimage || null,
      queryContext,
    },
  };
}

/**
 * Batch discovery — rotate through multiple queries for comprehensive coverage.
 */
export async function scrapeAllGDELT() {
  const queries = [
    // Funding-specific
    { q: 'startup funding raised', timespan: '3d' },
    { q: 'series a series b funding round', timespan: '3d' },
    { q: 'venture capital investment startup', timespan: '3d' },

    // India-specific
    { q: 'India startup raises funding', timespan: '3d' },
    { q: 'Bangalore Mumbai startup funding', timespan: '7d' },

    // M&A / Growth / Layoffs
    { q: 'startup acquisition merger', timespan: '7d' },
    { q: 'tech layoffs workforce reduction', timespan: '7d' },
    { q: 'startup expansion hiring spree', timespan: '7d' },
  ];

  const allItems = [];

  for (const { q, timespan } of queries) {
    try {
      const items = await discoverGDELT(q, 30, timespan);
      allItems.push(...items);
      // Respectful delay between queries
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.warn(`[GDELT] Query "${q}" failed:`, err.message);
    }
  }

  // Dedupe by URL hash within batch
  const seen = new Set();
  const deduped = allItems.filter(item => {
    if (seen.has(item.dedupeHash)) return false;
    seen.add(item.dedupeHash);
    return true;
  });

  console.log(`[GDELT] Total: ${allItems.length} → ${deduped.length} after dedup`);

  return [{
    source: 'gdelt',
    success: true,
    items: deduped,
    count: deduped.length,
  }];
}

// ─── Classification ────────────────────────────────────────────────────

const FUNDING_KEYWORDS = /\b(raises?|raised|funding|series [a-h]|seed round|venture|valuation|secures?|bags|closes|closed|pre-seed|ipo)\b/i;
const HIRING_KEYWORDS = /\b(appoints?|hires?|hiring|joins as|expands team|new cto|new ceo|new cpo|talent)\b/i;
const MA_KEYWORDS = /\b(acquires?|acquisition|merges?|merger|buyout|takeover)\b/i;
const LAYOFF_KEYWORDS = /\b(layoffs?|lays off|job cuts|restructur|workforce reduction|downsiz)\b/i;
const GROWTH_KEYWORDS = /\b(expands?|expansion|opens new office|enters market|launches in|new country|new market)\b/i;
const PRODUCT_KEYWORDS = /\b(launches|unveils|new product|rolls out|introduces|releases)\b/i;
const LEADERSHIP_KEYWORDS = /\b(steps down|resigns|exits|board appoints|new board|ceo change|leadership)\b/i;

function classifyGDELTArticle(title, queryContext) {
  const t = title.toLowerCase();
  if (FUNDING_KEYWORDS.test(t)) return 'funding';
  if (MA_KEYWORDS.test(t)) return 'ma';
  if (LAYOFF_KEYWORDS.test(t)) return 'workforce';
  if (HIRING_KEYWORDS.test(t)) return 'hiring';
  if (GROWTH_KEYWORDS.test(t)) return 'growth';
  if (PRODUCT_KEYWORDS.test(t)) return 'product';
  if (LEADERSHIP_KEYWORDS.test(t)) return 'leadership';

  // Fall back to query context
  if (queryContext.includes('funding') || queryContext.includes('venture')) return 'funding';
  if (queryContext.includes('layoff')) return 'workforce';
  if (queryContext.includes('acquisition')) return 'ma';

  return 'other';
}

function extractCompanyFromGDELT(title) {
  // Pattern: "Company raises/secures/bags/acquires..."
  const match = title.match(/^([A-Z][\w&.\-' ]{1,60}?)\s+(raises?|secures?|bags|closes|acquires?|appoints?|launches|partners|lays off|expands)/i);
  if (match) return match[1].trim();

  // Pattern: "Company, a fintech startup, ..."
  const match2 = title.match(/^([A-Z][\w&.\-' ]{1,40}?),?\s+(?:a |an |the )/i);
  if (match2) return match2[1].trim();

  // Fallback: text before colon
  const colon = title.indexOf(':');
  if (colon > 0 && colon < 50) return title.slice(0, colon).trim();

  return null;
}

function extractFundingFromGDELT(title) {
  const amountMatch = title.match(
    /(?:raises?|raised|secures?|bags|closes?|funding of)\s*(?:US\$|\$|₹|Rs\.?|INR)?\s*([\d.]+)\s*(million|mn|m|billion|bn|b|crore|cr|lakh)?/i
  );

  if (!amountMatch) return null;

  let amount = parseFloat(amountMatch[1]);
  const unit = (amountMatch[2] || '').toLowerCase();
  const unitMult = {
    million: 1e6, mn: 1e6, m: 1e6,
    billion: 1e9, bn: 1e9, b: 1e9,
    crore: 1e7, cr: 1e7, lakh: 1e5,
  };
  amount *= unitMult[unit] || 1;

  // Detect currency
  const isINR = /₹|rs\.?|inr|crore|lakh/i.test(title);
  const currency = isINR ? 'INR' : 'USD';
  const amountUsd = isINR ? amount / 83 : amount; // Static FX, normalized later by CurrencyNormalizer

  // Extract round
  const roundMatch = title.match(/\b(pre-?seed|seed|series [a-h]|bridge|growth|debt|venture debt|strategic|ipo)\b/i);
  const round = roundMatch ? normalizeRoundType(roundMatch[1]) : guessRound(amountUsd);

  // Extract lead investor
  const leadMatch = title.match(/led by ([A-Z][\w&.\- ]{2,40})/i);
  const leadInvestor = leadMatch ? leadMatch[1].trim().replace(/[.,]+$/, '') : null;

  // Extract other investors
  const participationMatch = title.match(/(?:with participation from|also participated|joined by) ([A-Za-z0-9,&.\- ]{3,120})/i);
  const otherInvestors = participationMatch
    ? participationMatch[1].split(/,|and/).map(s => s.trim()).filter(s => s.length > 1)
    : [];

  return {
    amount: amountUsd,
    currency,
    amountUsd,
    round,
    leadInvestor,
    otherInvestors,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────

function isIndianSource(domain, country) {
  const indianDomains = ['yourstory.com', 'inc42.com', 'entrackr.com', 'vccircle.com',
    'economictimes.indiatimes.com', 'livemint.com', 'moneycontrol.com', 'ndtv.com',
    'business-standard.com', 'businesstoday.in'];
  return indianDomains.some(d => domain?.includes(d)) || country === 'India';
}

function determineRegion(country, domain, title) {
  if (country === 'India' || isIndianSource(domain, country)) return 'india';
  if (/india|bangalore|mumbai|delhi|hyderabad|bengaluru|pune|chennai/i.test(title)) return 'india';
  return 'global';
}

function guessRound(amountUsd) {
  if (!amountUsd) return 'undisclosed';
  if (amountUsd < 500_000) return 'pre-seed';
  if (amountUsd < 3_000_000) return 'seed';
  if (amountUsd < 20_000_000) return 'series-a';
  if (amountUsd < 60_000_000) return 'series-b';
  if (amountUsd < 150_000_000) return 'series-c';
  return 'series-d';
}
