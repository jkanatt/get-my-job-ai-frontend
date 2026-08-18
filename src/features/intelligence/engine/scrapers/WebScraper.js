/**
 * Web Scraper — Cheerio/Axios-based HTML scraper for structured pages
 * ═══════════════════════════════════════════════════════════════════════
 * Scrapes news article pages, company directories, and investor portfolios.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { parseAmount, normalizeRoundType } from '../SourceRegistry.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT = 20_000;

/**
 * Scrape a list page for funding articles.
 */
export async function scrapeWebPage(source) {
  try {
    const { data: html } = await axios.get(source.url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const $ = cheerio.load(html);
    const items = [];

    // Generic article extraction — works for most news sites
    const articleSelectors = [
      'article',
      '.post',
      '.article-card',
      '.news-item',
      '.entry',
      '.story-card',
      '[class*="article"]',
      '[class*="post-card"]',
      '[class*="story"]',
    ];

    let articles = $([]);
    for (const selector of articleSelectors) {
      articles = $(selector);
      if (articles.length > 0) break;
    }

    // Fallback: get all links that look like article links
    if (articles.length === 0) {
      articles = $('a[href*="/story/"], a[href*="/article/"], a[href*="/post/"], a[href*="/news/"]').closest('div, li, article');
    }

    articles.each((i, el) => {
      if (i >= 50) return false; // Cap at 50 items

      const $el = $(el);
      const title = extractTitle($, $el);
      const link = extractLink($, $el, source.url);
      const description = extractDescription($, $el);
      const date = extractDate($, $el);

      if (!title || title.length < 10) return;

      const fullText = `${title} ${description}`;

      items.push({
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: link || source.url,
        title: title.slice(0, 300),
        description: description?.slice(0, 500) || '',
        publishedAt: date,
        category: categorizeText(fullText),
        companyName: extractCompanyFromHeadline(title),
        funding: extractFundingData(fullText),
        region: source.region,
        dedupeHash: crypto.createHash('sha256').update(`${source.id}:${title}`).digest('hex').slice(0, 32),
        rawData: { url: link },
      });
    });

    return { source: source.id, success: true, itemCount: items.length, items };
  } catch (error) {
    return { source: source.id, success: false, error: error.message, itemCount: 0, items: [] };
  }
}

/**
 * Scrape a company's careers page to extract job count.
 */
export async function scrapeCareerPage(companyUrl) {
  try {
    const careersUrls = [
      `${companyUrl}/careers`,
      `${companyUrl}/jobs`,
      `${companyUrl}/career`,
      `${companyUrl}/join-us`,
      `${companyUrl}/work-with-us`,
    ];

    for (const url of careersUrls) {
      try {
        const { data: html } = await axios.get(url, {
          timeout: 10_000,
          headers: { 'User-Agent': USER_AGENT },
          maxRedirects: 3,
        });

        const $ = cheerio.load(html);
        const jobLinks = $('a[href*="apply"], a[href*="position"], a[href*="role"], a[href*="opening"], .job-listing, .position-card, [class*="job-card"]');

        if (jobLinks.length > 0) {
          const departments = new Set();
          const locations = new Set();

          jobLinks.each((_, el) => {
            const text = $(el).text();
            const deptMatch = text.match(/(?:Engineering|Product|Design|Sales|Marketing|Operations|Finance|HR|Legal|Data|Research)/i);
            if (deptMatch) departments.add(deptMatch[0]);

            const locMatch = text.match(/(?:Remote|Bangalore|Mumbai|Delhi|Hyderabad|Chennai|Pune|Singapore|London|New York|San Francisco|Berlin)/i);
            if (locMatch) locations.add(locMatch[0]);
          });

          return {
            success: true,
            jobCount: jobLinks.length,
            departments: [...departments],
            locations: [...locations],
            careersUrl: url,
          };
        }
      } catch {
        // Try next URL
        continue;
      }
    }

    return { success: false, jobCount: 0, departments: [], locations: [] };
  } catch (error) {
    return { success: false, error: error.message, jobCount: 0, departments: [], locations: [] };
  }
}

/**
 * Scrape all registered web sources.
 */
export async function scrapeAllWebSources(sources) {
  const results = [];

  for (const source of sources) {
    const result = await scrapeWebPage(source);
    results.push(result);

    if (result.success) {
      console.log(`[Web] ✓ ${source.name}: ${result.itemCount} items`);
    } else {
      console.warn(`[Web] ✗ ${source.name}: ${result.error}`);
    }

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
  }

  return results;
}

// ─── Extraction Helpers ────────────────────────────────────────────────

function extractTitle($, $el) {
  const selectors = ['h1', 'h2', 'h3', 'h4', '.title', '.headline', '[class*="title"]', 'a'];
  for (const sel of selectors) {
    const text = $el.find(sel).first().text().trim();
    if (text && text.length > 10 && text.length < 300) return text;
  }
  return $el.text().trim().split('\n')[0]?.trim() || null;
}

function extractLink($, $el, baseUrl) {
  const link = $el.find('a').first().attr('href');
  if (!link) return null;
  if (link.startsWith('http')) return link;
  try {
    return new URL(link, baseUrl).href;
  } catch {
    return null;
  }
}

function extractDescription($, $el) {
  const selectors = ['p', '.summary', '.excerpt', '.description', '[class*="excerpt"]', '[class*="summary"]'];
  for (const sel of selectors) {
    const text = $el.find(sel).first().text().trim();
    if (text && text.length > 20) return text;
  }
  return '';
}

function extractDate($, $el) {
  const selectors = ['time', '.date', '.published', '[datetime]', '[class*="date"]', '[class*="time"]'];
  for (const sel of selectors) {
    const $date = $el.find(sel).first();
    const datetime = $date.attr('datetime') || $date.text().trim();
    if (datetime) {
      const parsed = new Date(datetime);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return null;
}

function extractFundingData(text) {
  if (!text) return null;
  const amountMatch = text.match(/[\$₹]?\s*([\d,.]+)\s*(million|mn|m|billion|bn|b|crore|cr|lakh|lk)/i);
  if (!amountMatch) return null;

  const currency = /[₹]|(?:rs|inr)/i.test(text) ? 'INR' : 'USD';
  const amount = parseAmount(`${amountMatch[1]} ${amountMatch[2]}`, currency.toLowerCase());
  const roundMatch = text.match(/(?:series|round)\s+([a-h])/i) || text.match(/\b(seed|pre-seed|angel|bridge)\b/i);

  return {
    amount,
    amountUsd: amount,
    currency,
    round: roundMatch ? normalizeRoundType(roundMatch[1] || roundMatch[0]) : 'undisclosed',
  };
}

function extractCompanyFromHeadline(title) {
  if (!title) return null;
  const match = title.match(/^([A-Z][^,:;—\-]+?)\s+(?:raises?|secures?|closes?|bags?|gets?|announces?)\s/i);
  return match ? match[1].trim() : null;
}

function categorizeText(text) {
  if (/\b(funding|raised|series|round|seed|investment|valuation)\b/i.test(text)) return 'funding';
  if (/\b(acquir|merger|bought|takeover)\b/i.test(text)) return 'ma';
  if (/\b(ipo|listing|public offering)\b/i.test(text)) return 'ipo';
  if (/\b(layoff|laid off|restructur|downsize)\b/i.test(text)) return 'workforce';
  if (/\b(launch|product|feature|release)\b/i.test(text)) return 'product';
  if (/\b(hir|recruit|appoint)\b/i.test(text)) return 'hiring';
  if (/\b(partner|collaborat|alliance)\b/i.test(text)) return 'partnership';
  if (/\b(expand|new office|new market|enter)\b/i.test(text)) return 'growth';
  return 'other';
}
