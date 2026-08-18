/**
 * Global Funding Scrapers — Dedicated scrapers for global funding platforms
 * ═══════════════════════════════════════════════════════════════════════════
 * Scrapes Owler, CB Insights Unicorn Tracker, Wellfound (AngelList)
 * using Cheerio. Handles anti-bot measures with stealth user-agent rotation.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { parseAmount, normalizeRoundType } from '../SourceRegistry.js';

// Rotate user agents to avoid detection
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
];

const TIMEOUT = 25_000;

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchPage(url) {
  const { data } = await axios.get(url, {
    timeout: TIMEOUT,
    headers: {
      'User-Agent': getRandomUA(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
  });
  return cheerio.load(data);
}

function hash(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// ─── Owler — Recent Funding Rounds ─────────────────────────────────────

export async function scrapeOwler() {
  try {
    const $ = await fetchPage('https://www.owler.com/feed/recent-funding-rounds');
    const items = [];

    // Owler uses feed cards for funding rounds
    $('[class*="funding"], [class*="deal"], article, .card, .feed-item').each((i, el) => {
      if (i >= 80) return false;
      const $el = $(el);
      const title = $el.find('h2, h3, h4, a, .title').first().text().trim();
      const description = $el.find('p, .description, .summary').first().text().trim();
      const link = $el.find('a').first().attr('href');

      if (!title || title.length < 10) return;

      const fullText = `${title} ${description}`;
      const companyMatch = title.match(/^([A-Z][A-Za-z0-9.\s]{1,40}?)\s+(?:raises?|secures?|closes?|gets?|receives?)/i);
      const companyName = companyMatch ? companyMatch[1].trim() : null;

      items.push({
        sourceId: 'owler-funding',
        sourceName: 'Owler',
        sourceUrl: link?.startsWith('http') ? link : `https://www.owler.com${link || ''}`,
        title,
        description: description?.slice(0, 500) || '',
        publishedAt: new Date().toISOString(),
        category: 'funding',
        companyName,
        funding: extractFundingFromText(fullText),
        region: 'global',
        dedupeHash: hash(`owler:${title}`),
        rawData: {},
      });
    });

    console.log(`[GlobalScrapers] Owler: ${items.length} items`);
    return { source: 'owler-funding', success: true, count: items.length, items };
  } catch (err) {
    console.warn(`[GlobalScrapers] Owler failed: ${err.message}`);
    return { source: 'owler-funding', success: false, error: err.message, count: 0, items: [] };
  }
}

// ─── CB Insights Unicorn Tracker ───────────────────────────────────────

export async function scrapeCBInsightsUnicorns() {
  try {
    const $ = await fetchPage('https://www.cbinsights.com/research-unicorn-companies');
    const items = [];

    // Unicorn tracker is typically a large table
    $('table tbody tr, .unicorn-row, [class*="unicorn"]').each((i, el) => {
      if (i >= 200) return false;
      const $el = $(el);
      const cells = $el.find('td').map((_, c) => $(c).text().trim()).get();
      if (cells.length < 3) return;

      const companyName = cells[0];
      if (!companyName || companyName.length < 2 || /^(company|name|#|rank)/i.test(companyName)) return;

      const valuationText = cells.find(c => /\$[\d.,]+/i.test(c)) || '';
      const industry = cells.find(c => /tech|health|fin|ai|saas|e-?commerce/i.test(c)) || '';
      const country = cells.find(c => /india|us|uk|china|germany|france|brazil|israel/i.test(c)) || '';

      items.push({
        sourceId: 'cbinsights-unicorn',
        sourceName: 'CB Insights',
        sourceUrl: 'https://www.cbinsights.com/research-unicorn-companies',
        title: `${companyName} — Unicorn ($${valuationText})`,
        description: cells.join(' | ').slice(0, 300),
        publishedAt: new Date().toISOString(),
        category: 'funding',
        companyName,
        funding: valuationText ? {
          amount: parseAmount(valuationText),
          amountUsd: parseAmount(valuationText),
          currency: 'USD',
          round: 'late',
        } : null,
        region: country.toLowerCase().includes('india') ? 'india' : 'global',
        dedupeHash: hash(`cbinsights:${companyName}`),
        rawData: { industry, country, valuation: valuationText },
      });
    });

    console.log(`[GlobalScrapers] CB Insights Unicorns: ${items.length} items`);
    return { source: 'cbinsights-unicorn', success: true, count: items.length, items };
  } catch (err) {
    console.warn(`[GlobalScrapers] CB Insights failed: ${err.message}`);
    return { source: 'cbinsights-unicorn', success: false, error: err.message, count: 0, items: [] };
  }
}

// ─── Wellfound (AngelList) Trending Startups ───────────────────────────

export async function scrapeWellfound() {
  try {
    const $ = await fetchPage('https://wellfound.com/discover/startups');
    const items = [];

    // Wellfound startup cards
    $('[class*="startup"], .styles-module--card, [data-test="StartupResult"], a[href*="/company/"]').closest('[class*="card"], div, li').each((i, el) => {
      if (i >= 60) return false;
      const $el = $(el);
      const name = $el.find('h3, h4, [class*="name"], [class*="title"]').first().text().trim();
      const description = $el.find('p, [class*="description"], [class*="tagline"]').first().text().trim();
      const link = $el.find('a[href*="/company/"]').first().attr('href');

      if (!name || name.length < 2 || name.length > 60) return;

      items.push({
        sourceId: 'wellfound-trending',
        sourceName: 'Wellfound (AngelList)',
        sourceUrl: link?.startsWith('http') ? link : `https://wellfound.com${link || ''}`,
        title: name,
        description: description?.slice(0, 400) || '',
        publishedAt: new Date().toISOString(),
        category: 'other',
        companyName: name,
        funding: null,
        region: 'global',
        dedupeHash: hash(`wellfound:${name}`),
        rawData: { type: 'company-profile' },
      });
    });

    console.log(`[GlobalScrapers] Wellfound: ${items.length} items`);
    return { source: 'wellfound-trending', success: true, count: items.length, items };
  } catch (err) {
    console.warn(`[GlobalScrapers] Wellfound failed: ${err.message}`);
    return { source: 'wellfound-trending', success: false, error: err.message, count: 0, items: [] };
  }
}

// ─── Utility: Extract funding from text ────────────────────────────────

function extractFundingFromText(text) {
  if (!text) return null;
  const amountMatch = text.match(/\$\s*([\d,.]+)\s*(million|mn|m|billion|bn|b|thousand|k)/i);
  if (!amountMatch) return null;

  return {
    amount: parseAmount(`${amountMatch[1]} ${amountMatch[2]}`),
    amountUsd: parseAmount(`${amountMatch[1]} ${amountMatch[2]}`),
    currency: 'USD',
    round: normalizeRoundType(text),
  };
}

// ─── Master scraper — runs all global-specific scrapers ────────────────

export async function scrapeAllGlobalFunding() {
  const results = [];

  const scrapers = [
    { name: 'Owler', fn: scrapeOwler },
    { name: 'CB Insights Unicorns', fn: scrapeCBInsightsUnicorns },
    { name: 'Wellfound', fn: scrapeWellfound },
  ];

  for (const scraper of scrapers) {
    try {
      const result = await scraper.fn();
      results.push(result);
    } catch (err) {
      results.push({ source: scraper.name, success: false, error: err.message, count: 0, items: [] });
    }
    // Polite delay between scrapers
    await new Promise(r => setTimeout(r, 1500));
  }

  return results;
}
