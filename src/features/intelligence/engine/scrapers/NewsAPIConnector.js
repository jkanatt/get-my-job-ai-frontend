/**
 * NewsAPI.org Connector — Broad News Discovery
 * ═══════════════════════════════════════════════════════════════════════
 * Free tier: 100 requests/day. Strategic query batching to maximize
 * coverage across funding, M&A, hiring, and layoff categories.
 *
 * Endpoint: https://newsapi.org/v2/everything
 * API Key: Stored in env var NEWSAPI_KEY
 */

import axios from 'axios';
import crypto from 'crypto';
import { normalizeRoundType } from '../SourceRegistry.js';

const NEWSAPI_BASE = 'https://newsapi.org/v2/everything';
const REQUEST_TIMEOUT = 15_000;

/**
 * Query NewsAPI for startup/funding news.
 *
 * @param {string} query - Search query
 * @param {number} pageSize - Results per page (max 100 for free tier)
 * @returns {Promise<object[]>} Array of extracted items
 */
export async function queryNewsAPI(query, pageSize = 20) {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.info('[NewsAPI] No NEWSAPI_KEY set — skipping (free tier: newsapi.org/register)');
    return [];
  }

  const items = [];

  try {
    // Free tier only allows 30-day lookback
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data } = await axios.get(NEWSAPI_BASE, {
      timeout: REQUEST_TIMEOUT,
      params: {
        q: query,
        from: fromDate,
        sortBy: 'publishedAt',
        pageSize,
        apiKey,
        language: 'en',
      },
    });

    const articles = data?.articles || [];
    console.log(`[NewsAPI] Found ${articles.length} articles for "${query}"`);

    for (const article of articles) {
      try {
        const item = parseNewsAPIArticle(article, query);
        if (item) items.push(item);
      } catch (err) {
        // Non-fatal
      }
    }
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn('[NewsAPI] Rate limit reached (100/day free tier)');
    } else {
      console.error(`[NewsAPI] Query "${query}" failed:`, err.message);
    }
  }

  return items;
}

/**
 * Parse a single NewsAPI article.
 */
function parseNewsAPIArticle(article, queryContext) {
  const title = article.title || '';
  const description = article.description || '';
  const url = article.url || '';
  const source = article.source?.name || '';
  const publishedAt = article.publishedAt || null;

  if (!title || title === '[Removed]') return null;

  const fullText = `${title} ${description}`;
  const category = classifyArticle(fullText, queryContext);
  const companyName = extractCompany(title);
  const funding = extractFunding(fullText);
  const region = detectRegion(fullText, source);

  const dedupeHash = crypto
    .createHash('sha256')
    .update(`newsapi:${url}`)
    .digest('hex')
    .slice(0, 32);

  return {
    sourceId: 'newsapi',
    sourceName: `NewsAPI · ${source}`,
    sourceUrl: url,
    title,
    description: description.slice(0, 500),
    publishedAt,
    category,
    companyName,
    funding,
    region,
    sourceType: 'news',
    dedupeHash,
    rawData: {
      newsapiSource: source,
      author: article.author,
      urlToImage: article.urlToImage,
      queryContext,
    },
  };
}

/**
 * Batch discovery — strategic query rotation to maximize 100/day budget.
 * Uses 5 queries per cycle = 20 requests/cycle, allowing ~5 cycles/day.
 */
export async function scrapeAllNewsAPI() {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.info('[NewsAPI] Skipping — no API key configured');
    return [{ source: 'newsapi', success: true, items: [], count: 0 }];
  }

  const queries = [
    'startup funding India',
    'series funding round venture',
    'venture capital investment startup',
    'startup acquisition merger tech',
    'tech layoffs workforce',
  ];

  const allItems = [];

  for (const query of queries) {
    try {
      const items = await queryNewsAPI(query, 20);
      allItems.push(...items);
      // 1-second delay between queries to be respectful
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.warn(`[NewsAPI] Query failed:`, err.message);
    }
  }

  // Dedupe by URL
  const seen = new Set();
  const deduped = allItems.filter(item => {
    if (seen.has(item.dedupeHash)) return false;
    seen.add(item.dedupeHash);
    return true;
  });

  console.log(`[NewsAPI] Total: ${allItems.length} → ${deduped.length} after dedup`);

  return [{
    source: 'newsapi',
    success: true,
    items: deduped,
    count: deduped.length,
  }];
}

// ─── Classification helpers ────────────────────────────────────────────

function classifyArticle(text, queryContext) {
  const t = text.toLowerCase();
  if (/\b(raises?|raised|funding|series [a-h]|seed round|venture|secures?|ipo)\b/.test(t)) return 'funding';
  if (/\b(acquires?|acquisition|merges?|merger|buyout)\b/.test(t)) return 'ma';
  if (/\b(layoffs?|lays off|job cuts|restructur|workforce reduction)\b/.test(t)) return 'workforce';
  if (/\b(appoints?|hires?|hiring|joins as|new cto|new ceo)\b/.test(t)) return 'hiring';
  if (/\b(expands?|expansion|opens new office|new market)\b/.test(t)) return 'growth';
  if (/\b(launches|unveils|new product|rolls out)\b/.test(t)) return 'product';
  if (/\b(partners with|partnership|collaborat)\b/.test(t)) return 'partnership';
  if (/\b(steps down|resigns|board appoints)\b/.test(t)) return 'leadership';
  return 'other';
}

function extractCompany(title) {
  const match = title.match(/^([A-Z][\w&.\-' ]{1,50}?)\s+(raises?|secures?|bags|closes|acquires?|appoints?|launches|partners|lays off)/i);
  if (match) return match[1].trim();
  const colon = title.indexOf(':');
  if (colon > 0 && colon < 40) return title.slice(0, colon).trim();
  return null;
}

function extractFunding(text) {
  const amountMatch = text.match(
    /(?:raises?|raised|secures?|bags|closes?|funding of)\s*(?:US\$|\$|₹|Rs\.?)?\s*([\d.]+)\s*(million|mn|m|billion|bn|b|crore|cr|lakh)?/i
  );
  if (!amountMatch) return null;

  let amount = parseFloat(amountMatch[1]);
  const unit = (amountMatch[2] || '').toLowerCase();
  const unitMult = { million: 1e6, mn: 1e6, m: 1e6, billion: 1e9, bn: 1e9, b: 1e9, crore: 1e7, cr: 1e7, lakh: 1e5 };
  amount *= unitMult[unit] || 1;

  const isINR = /₹|rs\.?|crore|lakh/i.test(text);
  const currency = isINR ? 'INR' : 'USD';
  const amountUsd = isINR ? amount / 83 : amount;

  const roundMatch = text.match(/\b(pre-?seed|seed|series [a-h]|bridge|growth|debt|venture debt|strategic|ipo)\b/i);

  return {
    amount: amountUsd,
    currency,
    amountUsd,
    round: roundMatch ? normalizeRoundType(roundMatch[1]) : null,
  };
}

function detectRegion(text, source) {
  const indiaSignals = /india|bangalore|mumbai|delhi|hyderabad|bengaluru|pune|chennai|kolkata|₹|crore|lakh/i;
  if (indiaSignals.test(text) || indiaSignals.test(source)) return 'india';
  return 'global';
}
