/**
 * Company Website Source — Primary Source Corroboration
 * ═══════════════════════════════════════════════════════════════════════
 * Scrapes a company's own /press, /blog, /about, /newsroom pages.
 * This is the highest-trust primary source — when a company's own website
 * confirms a funding event, it upgrades verification to CONFIRMED.
 *
 * Design principle from reference architecture:
 *   "CompanyWebsiteSource — highest trust primary source, used to upgrade
 *    VerificationStatus to HIGH_CONFIDENCE or CONFIRMED when it
 *    corroborates a news report."
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { parseAmount, normalizeRoundType } from '../SourceRegistry.js';

const USER_AGENT = 'Get My Job-Intelligence/1.0 (+https://getmyjob.com/bot)';
const REQUEST_TIMEOUT = 12_000;

const CANDIDATE_PATHS = [
  '/press', '/press-releases', '/newsroom',
  '/blog', '/news', '/about',
  '/company', '/about-us', '',
];

/**
 * Scrape a company's own website for press releases and funding announcements.
 *
 * @param {object} company - Company record with `website` field
 * @returns {Promise<object[]>} Array of extracted items
 */
export async function scrapeCompanyWebsite(company) {
  if (!company?.website) return [];

  const baseUrl = company.website.replace(/\/+$/, '');
  const items = [];

  for (const path of CANDIDATE_PATHS) {
    const url = `${baseUrl}${path}`;

    try {
      const { data: html, status } = await axios.get(url, {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
        },
        maxRedirects: 3,
        validateStatus: s => s < 400,
      });

      if (!html || typeof html !== 'string') continue;

      const $ = cheerio.load(html);

      // Remove script/style noise
      $('script, style, nav, footer, header').remove();

      const pageText = $('body').text().replace(/\s+/g, ' ').trim();
      const pageTitle = $('title').text().trim();

      // Check if page contains funding-related content
      if (!hasFundingSignals(pageText)) continue;

      // Extract press releases / blog posts
      const pressItems = extractPressReleases($, url, company);
      items.push(...pressItems);

      // Also extract from raw page text if it mentions funding
      const fundingMentions = extractFundingMentions(pageText, url, company, path);
      items.push(...fundingMentions);

    } catch (err) {
      // Expected: many paths will 404, that's fine
      if (err.response?.status !== 404) {
        console.debug(`[CompanyWebsite] ${url}: ${err.message}`);
      }
    }
  }

  // Dedupe within this company's results
  const seen = new Set();
  const deduped = items.filter(item => {
    if (seen.has(item.dedupeHash)) return false;
    seen.add(item.dedupeHash);
    return true;
  });

  if (deduped.length > 0) {
    console.log(`[CompanyWebsite] ${company.canonical_name}: found ${deduped.length} items`);
  }

  return deduped;
}

/**
 * Batch scrape — corroborate funding events by checking each company's website.
 *
 * @param {object[]} companies - Array of company records to check
 * @param {number} concurrency - Max parallel requests
 * @returns {Promise<object[]>} All items found
 */
export async function scrapeCompanyWebsites(companies, concurrency = 3) {
  const allItems = [];
  const batches = [];

  // Batch companies for controlled concurrency
  for (let i = 0; i < companies.length; i += concurrency) {
    batches.push(companies.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(company => scrapeCompanyWebsite(company))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.length > 0) {
        allItems.push(...result.value);
      }
    }

    // Respectful delay between batches
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[CompanyWebsite] Scraped ${companies.length} companies, found ${allItems.length} items`);

  return [{
    source: 'company-website',
    success: true,
    items: allItems,
    count: allItems.length,
  }];
}

// ─── Extractors ────────────────────────────────────────────────────────

const FUNDING_SIGNALS = /\b(raised|raises|funding|series [a-h]|seed round|venture|investment|investors?|valuation|secured|capital|round)\b/i;

function hasFundingSignals(text) {
  return FUNDING_SIGNALS.test(text);
}

function extractPressReleases($, baseUrl, company) {
  const items = [];

  // Look for structured press release lists
  const selectors = [
    'article', '.press-release', '.blog-post', '.news-item',
    '[class*="press"]', '[class*="news"]', '[class*="blog"]',
    '.post', '.entry', '.card',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, a').first().text().trim();
      const link = $el.find('a').first().attr('href') || '';
      const date = $el.find('time, [datetime], .date, .published').first().text().trim()
        || $el.find('time').attr('datetime') || '';
      const snippet = $el.text().replace(/\s+/g, ' ').trim().slice(0, 500);

      if (!title || title.length < 10 || !FUNDING_SIGNALS.test(`${title} ${snippet}`)) return;

      const fullLink = link.startsWith('http') ? link : `${baseUrl}${link}`;

      const funding = extractInlineFunding(`${title} ${snippet}`);

      const dedupeHash = crypto
        .createHash('sha256')
        .update(`company-site:${company.id || company.canonical_name}:${title.slice(0, 60)}`)
        .digest('hex')
        .slice(0, 32);

      items.push({
        sourceId: 'company-website',
        sourceName: `${company.canonical_name} (website)`,
        sourceUrl: fullLink,
        title,
        description: snippet,
        publishedAt: parseDate(date),
        category: 'funding',
        companyName: company.canonical_name,
        funding,
        region: company.is_indian ? 'india' : 'global',
        sourceType: 'company_site', // Critical: highest trust level
        dedupeHash,
        rawData: {
          companyId: company.id,
          companyWebsite: company.website,
          sourcePath: baseUrl,
        },
      });
    });
  }

  return items;
}

function extractFundingMentions(text, url, company, path) {
  const items = [];

  // Look for funding announcement patterns in raw text
  const patterns = [
    /(?:we have|we've|announces?|pleased to announce|today announced)\s+(?:raised|secured|closed)\s+(?:US\$|\$|₹|Rs\.?)?\s*([\d.]+)\s*(million|mn|m|billion|bn|b|crore|cr)/gi,
    /(?:series [a-h]|seed|pre-seed)\s+(?:funding|round|investment)\s+(?:of|worth|totaling)?\s*(?:US\$|\$|₹|Rs\.?)?\s*([\d.]+)\s*(million|mn|m|billion|bn|b|crore|cr)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const context = text.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);

      const dedupeHash = crypto
        .createHash('sha256')
        .update(`company-site-mention:${company.id || company.canonical_name}:${match[0].slice(0, 40)}`)
        .digest('hex')
        .slice(0, 32);

      items.push({
        sourceId: 'company-website',
        sourceName: `${company.canonical_name} (${path || 'homepage'})`,
        sourceUrl: url,
        title: `${company.canonical_name} — funding mention on company website`,
        description: context.trim(),
        publishedAt: null,
        category: 'funding',
        companyName: company.canonical_name,
        funding: extractInlineFunding(context),
        region: company.is_indian ? 'india' : 'global',
        sourceType: 'company_site',
        dedupeHash,
        rawData: {
          companyId: company.id,
          matchedPattern: match[0],
          pagePath: path,
        },
      });
    }
  }

  return items;
}

function extractInlineFunding(text) {
  const amountMatch = text.match(
    /(?:US\$|\$|₹|Rs\.?)\s*([\d.]+)\s*(million|mn|m|billion|bn|b|crore|cr|lakh)?/i
  );

  if (!amountMatch) return null;

  let amount = parseFloat(amountMatch[1]);
  const unit = (amountMatch[2] || '').toLowerCase();
  const unitMult = { million: 1e6, mn: 1e6, m: 1e6, billion: 1e9, bn: 1e9, b: 1e9, crore: 1e7, cr: 1e7, lakh: 1e5 };
  amount *= unitMult[unit] || 1;

  const isINR = /₹|rs\.?|crore|lakh/i.test(text);
  const currency = isINR ? 'INR' : 'USD';
  const amountUsd = isINR ? amount / 83 : amount;

  const roundMatch = text.match(/\b(pre-?seed|seed|series [a-h]|bridge|growth|debt)\b/i);

  const leadMatch = text.match(/led by ([A-Z][\w&.\- ]{2,40})/i);

  return {
    amount: amountUsd,
    currency,
    amountUsd,
    round: roundMatch ? normalizeRoundType(roundMatch[1]) : null,
    leadInvestor: leadMatch ? leadMatch[1].trim().replace(/[.,]+$/, '') : null,
    otherInvestors: [],
  };
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}
