/**
 * India Funding Scrapers — Dedicated scrapers for India-specific funding data
 * ═══════════════════════════════════════════════════════════════════════════
 * Scrapes paper.vc, eqmint.com, IPO Platform, StartupGrantsIndia
 * using Cheerio for HTML parsing. These sites have unique page structures
 * that the generic WebScraper can't handle.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { parseAmount, normalizeRoundType } from '../SourceRegistry.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT = 20_000;

async function fetchPage(url) {
  const { data } = await axios.get(url, {
    timeout: TIMEOUT,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
    },
  });
  return cheerio.load(data);
}

function hash(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// ─── paper.vc — India Funding Tracker ──────────────────────────────────

export async function scrapePaperVC() {
  try {
    const $ = await fetchPage('https://paper.vc/');
    const items = [];

    // paper.vc uses tables/cards with funding round data
    $('table tr, .funding-row, .deal-row, [class*="fund"], [class*="deal"]').each((i, el) => {
      if (i >= 100) return false;
      const $el = $(el);
      const text = $el.text().trim();

      // Try to extract structured data from table rows
      const cells = $el.find('td, .cell, span').map((_, c) => $(c).text().trim()).get();
      if (cells.length < 2) return;

      const companyName = cells[0] || null;
      const amountText = cells.find(c => /[\$₹]|crore|million|mn/i.test(c)) || '';
      const roundText = cells.find(c => /seed|series|pre-|angel|bridge/i.test(c)) || '';

      if (!companyName || companyName.length < 2) return;

      items.push({
        sourceId: 'paper-vc',
        sourceName: 'paper.vc',
        sourceUrl: 'https://paper.vc/',
        title: `${companyName} funding round`,
        description: text.slice(0, 300),
        publishedAt: new Date().toISOString(),
        category: 'funding',
        companyName,
        funding: amountText ? {
          amount: parseAmount(amountText, 'inr'),
          amountUsd: parseAmount(amountText, 'inr'),
          currency: 'INR',
          round: normalizeRoundType(roundText),
        } : null,
        region: 'india',
        dedupeHash: hash(`paper-vc:${companyName}:${amountText}`),
        rawData: { cells },
      });
    });

    // Fallback: scrape all links that look like company/funding entries
    if (items.length === 0) {
      $('a[href]').each((i, el) => {
        if (i >= 80) return false;
        const $el = $(el);
        const text = $el.text().trim();
        const href = $el.attr('href');
        if (text.length < 5 || text.length > 100) return;
        if (/funding|raised|round|series|crore|million/i.test(text)) {
          items.push({
            sourceId: 'paper-vc',
            sourceName: 'paper.vc',
            sourceUrl: href?.startsWith('http') ? href : `https://paper.vc${href}`,
            title: text,
            description: '',
            publishedAt: new Date().toISOString(),
            category: 'funding',
            companyName: null, // Will be extracted by LLM
            funding: null,
            region: 'india',
            dedupeHash: hash(`paper-vc:${text}`),
            rawData: { url: href },
          });
        }
      });
    }

    console.log(`[IndiaScrapers] paper.vc: ${items.length} items`);
    return { source: 'paper-vc', success: true, count: items.length, items };
  } catch (err) {
    console.warn(`[IndiaScrapers] paper.vc failed: ${err.message}`);
    return { source: 'paper-vc', success: false, error: err.message, count: 0, items: [] };
  }
}

// ─── eqmint.com — Monthly India Funding Tracker ────────────────────────

export async function scrapeEqmint() {
  try {
    const $ = await fetchPage('https://eqmint.com/');
    const items = [];

    // Look for funding tables, cards, and data grids
    $('table tr, .company-card, .startup-card, .deal-card, [class*="startup"], [class*="company"]').each((i, el) => {
      if (i >= 80) return false;
      const $el = $(el);
      const text = $el.text().trim();
      if (text.length < 10) return;

      const titleEl = $el.find('h2, h3, h4, a, .name, .title, td:first-child').first();
      const companyName = titleEl.text().trim();
      if (!companyName || companyName.length < 2 || companyName.length > 60) return;

      items.push({
        sourceId: 'eqmint',
        sourceName: 'eqmint',
        sourceUrl: 'https://eqmint.com/',
        title: `${companyName} — India funding`,
        description: text.slice(0, 300),
        publishedAt: new Date().toISOString(),
        category: 'funding',
        companyName,
        funding: null, // Extracted from text in pipeline
        region: 'india',
        dedupeHash: hash(`eqmint:${companyName}`),
        rawData: {},
      });
    });

    console.log(`[IndiaScrapers] eqmint: ${items.length} items`);
    return { source: 'eqmint', success: true, count: items.length, items };
  } catch (err) {
    console.warn(`[IndiaScrapers] eqmint failed: ${err.message}`);
    return { source: 'eqmint', success: false, error: err.message, count: 0, items: [] };
  }
}

// ─── IPO Platform — SME/Mainboard IPO Tracker ──────────────────────────

export async function scrapeIPOPlatform() {
  try {
    const $ = await fetchPage('https://ipoplatform.com/');
    const items = [];

    // IPO listings typically in tables
    $('table tr, .ipo-card, .ipo-listing, [class*="ipo"]').each((i, el) => {
      if (i >= 60) return false;
      const $el = $(el);
      const cells = $el.find('td').map((_, c) => $(c).text().trim()).get();
      if (cells.length < 2) return;

      const companyName = cells[0];
      if (!companyName || companyName.length < 3 || /^(sr|no|#|company)/i.test(companyName)) return;

      const ipoSize = cells.find(c => /[\$₹]|crore|cr|million/i.test(c)) || '';

      items.push({
        sourceId: 'ipo-platform',
        sourceName: 'IPO Platform',
        sourceUrl: 'https://ipoplatform.com/',
        title: `${companyName} IPO`,
        description: cells.join(' | '),
        publishedAt: new Date().toISOString(),
        category: 'ipo',
        companyName,
        funding: ipoSize ? {
          amount: parseAmount(ipoSize, 'inr'),
          amountUsd: parseAmount(ipoSize, 'inr'),
          currency: 'INR',
          round: 'ipo',
        } : null,
        region: 'india',
        dedupeHash: hash(`ipo-platform:${companyName}`),
        rawData: { cells },
      });
    });

    console.log(`[IndiaScrapers] IPO Platform: ${items.length} items`);
    return { source: 'ipo-platform', success: true, count: items.length, items };
  } catch (err) {
    console.warn(`[IndiaScrapers] IPO Platform failed: ${err.message}`);
    return { source: 'ipo-platform', success: false, error: err.message, count: 0, items: [] };
  }
}

// ─── StartupGrantsIndia — Government Grants Directory ──────────────────

export async function scrapeStartupGrantsIndia() {
  try {
    const $ = await fetchPage('https://startupgrantsindia.com/');
    const items = [];

    // Grants typically listed in cards or lists
    $('.grant-card, .program-card, article, .entry, [class*="grant"], [class*="scheme"]').each((i, el) => {
      if (i >= 80) return false;
      const $el = $(el);
      const title = $el.find('h2, h3, h4, a').first().text().trim();
      const description = $el.find('p, .description, .summary').first().text().trim();
      const link = $el.find('a').first().attr('href');

      if (!title || title.length < 5) return;

      items.push({
        sourceId: 'startup-grants-india',
        sourceName: 'Startup Grants India',
        sourceUrl: link?.startsWith('http') ? link : `https://startupgrantsindia.com${link || ''}`,
        title,
        description: description?.slice(0, 500) || '',
        publishedAt: new Date().toISOString(),
        category: 'funding',
        companyName: null, // Grants are programs, not companies
        funding: null,
        region: 'india',
        dedupeHash: hash(`grants-india:${title}`),
        rawData: { type: 'government-grant' },
      });
    });

    console.log(`[IndiaScrapers] StartupGrantsIndia: ${items.length} items`);
    return { source: 'startup-grants-india', success: true, count: items.length, items };
  } catch (err) {
    console.warn(`[IndiaScrapers] StartupGrantsIndia failed: ${err.message}`);
    return { source: 'startup-grants-india', success: false, error: err.message, count: 0, items: [] };
  }
}

// ─── Master scraper — runs all India-specific scrapers ─────────────────

export async function scrapeAllIndiaFunding() {
  const results = [];

  const scrapers = [
    { name: 'paper.vc', fn: scrapePaperVC },
    { name: 'eqmint', fn: scrapeEqmint },
    { name: 'IPO Platform', fn: scrapeIPOPlatform },
    { name: 'Startup Grants India', fn: scrapeStartupGrantsIndia },
  ];

  for (const scraper of scrapers) {
    try {
      const result = await scraper.fn();
      results.push(result);
    } catch (err) {
      results.push({ source: scraper.name, success: false, error: err.message, count: 0, items: [] });
    }
    // Polite delay between scrapers
    await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}
