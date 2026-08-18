/**
 * RSS Feed Scraper — Parses RSS/Atom feeds for funding and startup news
 * ═══════════════════════════════════════════════════════════════════════
 * Uses Cheerio to parse XML feeds and extracts structured funding data
 * from article titles, descriptions, and content.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import {
  FUNDING_PATTERNS,
  NEWS_CATEGORY_PATTERNS,
  parseAmount,
  normalizeRoundType,
} from '../SourceRegistry.js';

const USER_AGENT = 'Get My Job-Intelligence/1.0 (+https://getmyjob.com/bot)';
const REQUEST_TIMEOUT = 15_000;

/**
 * Fetch and parse a single RSS feed.
 * @param {object} source - Source config from SourceRegistry
 * @returns {Promise<object[]>} Array of extracted items
 */
export async function scrapeRSSFeed(source) {
  try {
    const response = await axios.get(source.url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml',
      },
      responseType: 'text',
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];

    // Handle both RSS <item> and Atom <entry>
    const entries = $('item').length > 0 ? $('item') : $('entry');

    entries.each((_, el) => {
      const $el = $(el);

      const title = $el.find('title').first().text().trim();
      const link = $el.find('link').first().attr('href') || $el.find('link').first().text().trim();
      const description = $el.find('description').first().text().trim()
        || $el.find('summary').first().text().trim()
        || $el.find('content\\:encoded, encoded').first().text().trim();
      const pubDate = $el.find('pubDate').first().text().trim()
        || $el.find('published').first().text().trim()
        || $el.find('updated').first().text().trim();

      if (!title) return;

      const fullText = `${title} ${stripHTML(description)}`;

      // Extract funding data from the text
      const funding = extractFundingFromText(fullText);
      const category = categorizeEvent(fullText);
      const companyName = extractCompanyName(title, fullText);

      const item = {
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: link,
        title,
        description: stripHTML(description).slice(0, 500),
        publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
        category,
        companyName,
        funding,
        region: source.region,
        dedupeHash: generateHash(`${source.id}:${title}:${link}`),
        rawData: { title, link, description: description?.slice(0, 1000), pubDate },
      };

      items.push(item);
    });

    return {
      source: source.id,
      success: true,
      itemCount: items.length,
      items,
    };
  } catch (error) {
    return {
      source: source.id,
      success: false,
      error: error.message,
      itemCount: 0,
      items: [],
    };
  }
}

/**
 * Scrape all registered RSS sources.
 * @param {object[]} sources - Array of RSS source configs
 * @returns {Promise<object[]>} All extracted items from all sources
 */
export async function scrapeAllRSSFeeds(sources) {
  const results = [];

  // Process feeds sequentially with a small delay to be polite
  for (const source of sources) {
    const result = await scrapeRSSFeed(source);
    results.push(result);

    if (result.success) {
      console.log(`[RSS] ✓ ${source.name}: ${result.itemCount} items`);
    } else {
      console.warn(`[RSS] ✗ ${source.name}: ${result.error}`);
    }

    // Polite delay between requests (300-800ms random)
    await sleep(300 + Math.random() * 500);
  }

  return results;
}

// ─── Extraction Helpers ────────────────────────────────────────────────

/**
 * Extract funding information from text content.
 */
function extractFundingFromText(text) {
  if (!text) return null;

  let amount = null;
  let currency = 'USD';
  let round = null;
  let leadInvestor = null;
  let otherInvestors = [];

  // Detect currency
  if (/(?:₹|rs\.?|inr)/i.test(text)) currency = 'INR';
  else if (/(?:€|eur)/i.test(text)) currency = 'EUR';
  else if (/(?:£|gbp)/i.test(text)) currency = 'GBP';

  // Extract amount
  for (const pattern of FUNDING_PATTERNS.amounts) {
    const match = text.match(pattern);
    if (match) {
      amount = parseAmount(`${match[1]} ${match[2] || ''}`, currency.toLowerCase());
      break;
    }
  }

  // Extract round
  for (const pattern of FUNDING_PATTERNS.rounds) {
    const match = text.match(pattern);
    if (match) {
      round = normalizeRoundType(match[1] || match[0]);
      break;
    }
  }

  // Extract investors
  for (const pattern of FUNDING_PATTERNS.investors) {
    const match = text.match(pattern);
    if (match) {
      const investorStr = match[1].trim();
      const investors = investorStr.split(/,\s*(?:and\s+)?|\s+and\s+/).map(s => s.trim()).filter(Boolean);
      if (investors.length > 0) {
        leadInvestor = investors[0];
        otherInvestors = investors.slice(1);
      }
      break;
    }
  }

  if (!amount && !round) return null;

  return {
    amount,
    amountUsd: amount, // Already converted in parseAmount
    currency,
    round,
    leadInvestor,
    otherInvestors,
  };
}

/**
 * Categorize a news event based on text content.
 */
function categorizeEvent(text) {
  if (!text) return 'other';

  // Priority order matters — check most specific first
  const categoryOrder = ['funding', 'ma', 'ipo', 'workforce', 'hiring', 'leadership', 'partnership', 'product', 'growth'];

  for (const category of categoryOrder) {
    const patterns = NEWS_CATEGORY_PATTERNS[category];
    if (patterns && patterns.some(p => p.test(text))) {
      return category;
    }
  }

  return 'other';
}

/**
 * Attempt to extract a company name from the title/text.
 * Returns { name, confidence } for the pipeline to decide if LLM fallback is needed.
 *
 * Confidence levels:
 *   0.9+ = very likely correct (e.g., "Razorpay raises $75M")
 *   0.5-0.8 = uncertain, should verify with LLM
 *   < 0.5 = likely wrong, must use LLM
 */
function extractCompanyName(title, fullText) {
  if (!title) return null;

  // ── Blacklist: common false-positive headline prefixes ──
  const BLACKLIST_PATTERNS = [
    /^exclusive[:\s]/i, /^breaking[:\s]/i, /^update[:\s]/i, /^report[:\s]/i,
    /^week'?s?\s/i, /^no\s/i, /^the\s+(latest|biggest|best|top|most|new)\s/i,
    /^this\s/i, /^how\s/i, /^why\s/i, /^what\s/i, /^when\s/i, /^where\s/i,
    /^daily\s/i, /^monthly\s/i, /^annual\s/i, /^fresh\s/i,
    /^charting\s/i, /^tracking\s/i, /^inside\s/i, /^behind\s/i,
    /^show\s+hn/i, /^ask\s+hn/i, /^tell\s+hn/i, /^launch\s+hn/i,
    /^israeli\s/i, /^indian\s/i, /^london'?s?\s/i, /^glasgow-based\s/i,
    /^munich-based\s/i, /^cyprus-based\s/i, /^finland'?s?\s/i,
    /^[\w]+-based\s/i, // Any "City-based ..." pattern
    /^repeat\s+founder\s/i, /^marc\s+benioff/i,
    /^edtech\s+platform/i, /^fintech\s/i, /^legaltech\s/i, /^healthtech\s/i,
  ];

  // ── Pattern 1: "CompanyName raises/secures $X" (highest confidence) ──
  const raisesMatch = title.match(/^([A-Z][A-Za-z0-9.·\s]{1,40}?)\s+(?:raises?|secures?|closes?|bags?|gets?|receives?|nabs?|lands?)\s/i);
  if (raisesMatch) {
    const candidate = raisesMatch[1].trim();
    if (!BLACKLIST_PATTERNS.some(p => p.test(candidate)) && candidate.split(/\s+/).length <= 5) {
      return candidate;
    }
  }

  // ── Pattern 2: "CompanyName, a/an SaaS startup..." ──
  const commaMatch = title.match(/^([A-Z][A-Za-z0-9.·\s]{1,35}?),\s+(?:a|an|the)\s/i);
  if (commaMatch) {
    const candidate = commaMatch[1].trim();
    if (!BLACKLIST_PATTERNS.some(p => p.test(candidate)) && candidate.split(/\s+/).length <= 4) {
      return candidate;
    }
  }

  // ── Pattern 3: "backed CompanyName" or "invests in CompanyName" ──
  const investMatch = title.match(/(?:backs?|invests?\s+in|leads?\s+\$?\w+\s+(?:round|funding)\s+(?:for|in|at))\s+([A-Z][A-Za-z0-9.·\s]{1,30}?)(?:\s*[,.\-—|]|$)/i);
  if (investMatch) {
    const candidate = investMatch[1].trim();
    if (!BLACKLIST_PATTERNS.some(p => p.test(candidate))) {
      return candidate;
    }
  }

  // ── Pattern 4: Title before separator — only if short and capitalized ──
  const separatorMatch = title.match(/^([A-Z][A-Za-z0-9.·\s]{2,30}?)(?:\s[—|–\-]\s)/);
  if (separatorMatch) {
    const candidate = separatorMatch[1].trim();
    if (!BLACKLIST_PATTERNS.some(p => p.test(candidate)) && candidate.split(/\s+/).length <= 4) {
      return candidate;
    }
  }

  // If all patterns fail, return null — the pipeline will use LLM fallback
  return null;
}

/**
 * Strip HTML tags from a string.
 */
function stripHTML(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

/**
 * Generate a SHA-256 hash for deduplication.
 */
function generateHash(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

/**
 * Promise-based sleep.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
