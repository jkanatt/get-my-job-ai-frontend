/**
 * SEC EDGAR Form D Connector
 * ═══════════════════════════════════════════════════════════════════════
 * Every US private company raising capital via Regulation D must file
 * Form D with the SEC within 15 days. This is free, official, structured
 * data — the single highest-quality source for US funding events.
 *
 * Endpoints:
 *   Full-text search: https://efts.sec.gov/LATEST/search-index?q=...&forms=D
 *   EDGAR XBRL:       https://data.sec.gov/submissions/CIK{cik}.json
 *
 * No API key required. Rate limit: 10 req/sec (respect SEC fair access).
 */

import axios from 'axios';
import crypto from 'crypto';
import { parseAmount, normalizeRoundType } from '../SourceRegistry.js';

const SEC_BASE = 'https://efts.sec.gov/LATEST/search-index';
const SEC_FILING_BASE = 'https://www.sec.gov/Archives/edgar/data';
const USER_AGENT = 'Get My Job-Intelligence/1.0 (contact@getmyjob.com)'; // SEC requires identifying UA
const REQUEST_TIMEOUT = 15_000;
const MAX_RESULTS = 50;

// SEC fair-access: max 10 req/sec, we'll be conservative
const RATE_LIMIT_MS = 200;
let _lastRequestTime = 0;

async function rateLimitedGet(url, config = {}) {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - _lastRequestTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastRequestTime = Date.now();

  return axios.get(url, {
    timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    ...config,
  });
}

/**
 * Discover recent Form D filings from SEC EDGAR full-text search.
 *
 * @param {string} query - Search query (e.g., "startup", company name)
 * @param {number} maxResults - Max results to return
 * @param {string} startDate - YYYY-MM-DD start date filter
 * @param {string} endDate - YYYY-MM-DD end date filter
 * @returns {Promise<object[]>} Array of extracted funding items
 */
export async function discoverSECFilings(query = 'startup', maxResults = MAX_RESULTS, startDate, endDate) {
  const items = [];

  try {
    const params = new URLSearchParams({
      q: query,
      forms: 'D,D/A', // Form D and amendments
      dateRange: 'custom',
    });

    if (startDate) params.set('startdt', startDate);
    if (endDate) params.set('enddt', endDate);

    // Default to last 30 days if no dates specified
    if (!startDate && !endDate) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      params.set('startdt', thirtyDaysAgo.toISOString().split('T')[0]);
      params.set('enddt', new Date().toISOString().split('T')[0]);
    }

    const { data } = await rateLimitedGet(`${SEC_BASE}?${params.toString()}`);

    const filings = data?.hits?.hits || data?.filings || [];
    console.log(`[SEC EDGAR] Found ${filings.length} Form D filings for "${query}"`);

    for (const filing of filings.slice(0, maxResults)) {
      try {
        const item = parseEdgarFiling(filing);
        if (item) items.push(item);
      } catch (err) {
        console.warn(`[SEC EDGAR] Failed to parse filing:`, err.message);
      }
    }
  } catch (err) {
    console.error(`[SEC EDGAR] Discovery failed for "${query}":`, err.message);
  }

  return items;
}

/**
 * Parse a single EDGAR filing result into our standard item format.
 */
function parseEdgarFiling(filing) {
  const source = filing._source || filing;

  const companyName = source.display_names?.[0]
    || source.entity_name
    || source.company_name
    || '';

  if (!companyName) return null;

  const filingDate = source.file_date || source.period_of_report || source.date_filed || '';
  const cik = source.entity_id || source.cik || '';
  const fileNumber = source.file_num || '';

  // Extract amount from the filing description or related data
  const description = source.display_description || source.description || '';
  const fullText = `${companyName} ${description}`;

  // Form D filings often include the total offering amount
  const totalOffering = source.total_offering_amount
    || extractFormDAmount(description);

  // Extract related persons (often includes investors)
  const relatedPersons = source.related_persons || [];
  const investors = relatedPersons
    .filter(p => p.relationship?.toLowerCase()?.includes('promoter') || p.relationship?.toLowerCase()?.includes('director'))
    .map(p => p.name)
    .filter(Boolean);

  const filingUrl = cik
    ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=D&dateb=&owner=include&count=10`
    : '';

  const dedupeHash = crypto
    .createHash('sha256')
    .update(`sec-edgar:${cik || companyName}:${filingDate}:${totalOffering || ''}`)
    .digest('hex')
    .slice(0, 32);

  return {
    sourceId: 'sec-edgar',
    sourceName: 'SEC EDGAR Form D',
    sourceUrl: filingUrl,
    title: `${companyName} filed Form D — ${totalOffering ? `$${formatAmount(totalOffering)} offering` : 'Regulation D filing'}`,
    description: description || `SEC Form D filing by ${companyName}`,
    publishedAt: filingDate ? new Date(filingDate).toISOString() : null,
    category: 'funding',
    companyName: cleanCompanyName(companyName),
    funding: totalOffering ? {
      amount: totalOffering,
      currency: 'USD',
      amountUsd: totalOffering,
      round: guessRoundFromAmount(totalOffering),
      leadInvestor: investors[0] || null,
      otherInvestors: investors.slice(1),
    } : null,
    region: 'global', // SEC = US-focused but global companies file here
    sourceType: 'regulatory', // Highest trust level
    dedupeHash,
    rawData: {
      cik,
      fileNumber,
      formType: 'D',
      sicCode: source.sic || source.assigned_sic,
      stateOfIncorporation: source.state_of_inc,
      totalOfferingAmount: totalOffering,
      relatedPersons: relatedPersons.slice(0, 10),
    },
  };
}

/**
 * Batch discovery — run multiple queries for broader coverage.
 */
export async function scrapeAllSECEdgar() {
  const queries = [
    'startup',
    'technology',
    'software',
    'artificial intelligence',
    'fintech',
    'SaaS',
  ];

  const allItems = [];

  for (const query of queries) {
    try {
      const items = await discoverSECFilings(query, 20);
      allItems.push(...items);
      // Respect rate limiting between queries
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.warn(`[SEC EDGAR] Query "${query}" failed:`, err.message);
    }
  }

  // Dedupe by hash within batch
  const seen = new Set();
  const deduped = allItems.filter(item => {
    if (seen.has(item.dedupeHash)) return false;
    seen.add(item.dedupeHash);
    return true;
  });

  console.log(`[SEC EDGAR] Total: ${allItems.length} → ${deduped.length} after dedup`);

  return [{
    source: 'sec-edgar',
    success: true,
    items: deduped,
    count: deduped.length,
  }];
}

// ─── Helpers ───────────────────────────────────────────────────────────

function extractFormDAmount(text) {
  if (!text) return null;
  // Form D often states "Total offering amount: $X"
  const match = text.match(
    /(?:total\s+(?:offering|amount)|aggregate|raised|amount\s+sold)\s*:?\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(million|billion|m|b)?/i
  );
  if (!match) return null;
  let amount = parseFloat(match[1].replace(/,/g, ''));
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'million' || unit === 'm') amount *= 1e6;
  if (unit === 'billion' || unit === 'b') amount *= 1e9;
  return amount;
}

function guessRoundFromAmount(amountUsd) {
  if (!amountUsd) return 'undisclosed';
  if (amountUsd < 500_000) return 'pre-seed';
  if (amountUsd < 3_000_000) return 'seed';
  if (amountUsd < 20_000_000) return 'series-a';
  if (amountUsd < 60_000_000) return 'series-b';
  if (amountUsd < 150_000_000) return 'series-c';
  return 'series-d';
}

function cleanCompanyName(name) {
  return name
    .replace(/\b(LLC|Inc\.?|Corp\.?|Ltd\.?|LP|LLP|PLC)\b/gi, '')
    .replace(/,\s*$/, '')
    .trim();
}

function formatAmount(amount) {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(0)}K`;
  return String(amount);
}
