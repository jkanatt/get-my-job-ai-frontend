/**
 * Startup India / DPIIT Registry Connector
 * ═══════════════════════════════════════════════════════════════════════
 * Scrapes India's official DPIIT Recognized Startup database for company
 * metadata: name, sector, registration date, recognition status, location.
 *
 * Source: https://www.startupindia.gov.in
 * Method: Web scrape (no clean API exists)
 * Purpose: Enrich Indian companies with official government data
 * Frequency: Weekly (data changes infrequently)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

const STARTUP_INDIA_SEARCH = 'https://www.startupindia.gov.in/content/sih/en/search.html';
const STARTUP_INDIA_API = 'https://api.startupindia.gov.in/sih/api/noauth/search/dpiit';
const USER_AGENT = 'Get My Job-Intelligence/1.0 (+https://getmyjob.com/bot)';
const REQUEST_TIMEOUT = 15_000;

/**
 * Search the DPIIT recognized startup database.
 *
 * @param {string} query - Company name or sector to search
 * @param {number} page - Page number (0-indexed)
 * @param {number} size - Results per page
 * @returns {Promise<object[]>} Array of startup records
 */
export async function searchDPIITStartups(query = '', page = 0, size = 20) {
  const items = [];

  try {
    // Try the API endpoint first (faster, structured)
    const apiResult = await searchViaAPI(query, page, size);
    if (apiResult.length > 0) return apiResult;
  } catch (err) {
    console.debug('[StartupIndia] API failed, falling back to web scrape:', err.message);
  }

  // Fallback: web scrape
  try {
    const webResult = await searchViaWebScrape(query);
    return webResult;
  } catch (err) {
    console.error('[StartupIndia] Web scrape also failed:', err.message);
  }

  return items;
}

/**
 * Search via StartupIndia's internal API (if available).
 */
async function searchViaAPI(query, page, size) {
  const { data } = await axios.post(
    STARTUP_INDIA_API,
    {
      keyword: query,
      page,
      size,
      sort: { orders: [{ property: 'name', direction: 'ASC' }] },
    },
    {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    }
  );

  const startups = data?.content || data?.startups || data?.data || [];

  return startups.map(s => parseStartupRecord(s));
}

/**
 * Fallback: scrape the search results page.
 */
async function searchViaWebScrape(query) {
  const { data: html } = await axios.get(STARTUP_INDIA_SEARCH, {
    timeout: REQUEST_TIMEOUT,
    params: { q: query },
    headers: { 'User-Agent': USER_AGENT },
  });

  const $ = cheerio.load(html);
  const items = [];

  // Parse search result cards
  $('.search-result-item, .startup-card, [class*="result"]').each((_, el) => {
    const $el = $(el);

    const name = $el.find('h3, h4, .title, .name').first().text().trim();
    const sector = $el.find('.sector, .industry, .category').first().text().trim();
    const location = $el.find('.location, .city, .state').first().text().trim();
    const date = $el.find('.date, .registered, time').first().text().trim();
    const description = $el.find('.description, .about, p').first().text().trim();
    const link = $el.find('a').first().attr('href') || '';

    if (!name || name.length < 2) return;

    items.push({
      name: name,
      sector: sector || null,
      location: location || null,
      registrationDate: parseDate(date),
      description: description?.slice(0, 300) || null,
      profileUrl: link.startsWith('http') ? link : `https://www.startupindia.gov.in${link}`,
      source: 'dpiit-web',
    });
  });

  return items.map(s => parseStartupRecord(s));
}

/**
 * Parse a raw startup record into enrichment data.
 */
function parseStartupRecord(raw) {
  const name = raw.name || raw.entityName || raw.companyName || '';
  const sector = raw.sector || raw.industry || raw.natureOfEntity || '';
  const city = raw.city || raw.location || '';
  const state = raw.state || '';
  const location = [city, state].filter(Boolean).join(', ') || null;

  const registrationDate = raw.registrationDate || raw.dateOfIncorporation
    || raw.incorporationDate || raw.date || null;

  const dpiitNumber = raw.dpiitNumber || raw.recognitionNumber || raw.certificateNumber || null;
  const isRecognized = raw.isRecognized ?? raw.recognized ?? (!!dpiitNumber);

  return {
    companyName: name,
    sector: sector || null,
    location: location,
    foundedYear: registrationDate ? new Date(registrationDate).getFullYear() : null,
    registrationDate,
    dpiitNumber,
    isRecognized,
    description: raw.description || raw.about || null,
    profileUrl: raw.profileUrl || raw.url || null,
    website: raw.website || null,
    enrichmentSource: 'startup-india-dpiit',
    dedupeHash: crypto
      .createHash('sha256')
      .update(`dpiit:${name.toLowerCase().trim()}`)
      .digest('hex')
      .slice(0, 32),
  };
}

/**
 * Batch enrichment — enrich a list of Indian companies with DPIIT data.
 *
 * @param {object[]} companies - Companies to enrich (must have canonical_name)
 * @returns {Promise<object[]>} Enrichment results
 */
export async function enrichWithDPIIT(companies) {
  const indianCompanies = companies.filter(c =>
    c.is_indian || c.location?.toLowerCase()?.includes('india')
    || c.location?.toLowerCase()?.includes('bangalore')
    || c.location?.toLowerCase()?.includes('mumbai')
    || c.location?.toLowerCase()?.includes('delhi')
    || c.location?.toLowerCase()?.includes('bengaluru')
  );

  if (indianCompanies.length === 0) {
    console.log('[StartupIndia] No Indian companies to enrich');
    return [];
  }

  const results = [];
  console.log(`[StartupIndia] Enriching ${indianCompanies.length} Indian companies`);

  for (const company of indianCompanies.slice(0, 20)) { // Limit per cycle
    try {
      const dpiitData = await searchDPIITStartups(company.canonical_name);
      if (dpiitData.length > 0) {
        results.push({
          companyId: company.id,
          companyName: company.canonical_name,
          enrichment: dpiitData[0],
        });
      }
      // Respectful delay
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.debug(`[StartupIndia] Enrichment failed for ${company.canonical_name}:`, err.message);
    }
  }

  console.log(`[StartupIndia] Enriched ${results.length}/${indianCompanies.length} companies`);

  return results;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}
