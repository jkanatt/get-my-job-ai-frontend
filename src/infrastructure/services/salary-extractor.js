/**
 * Salary Intelligence Extraction Service
 * =======================================
 * Extracts, normalizes, and benchmarks salary/compensation data from
 * job descriptions using multi-strategy pattern matching.
 *
 * Strategies:
 *   1. Explicit salary patterns ($120k, €85,000, $120,000-$160,000/yr)
 *   2. Per-hour rates converted to annual ($50/hr → ~$104,000/yr)
 *   3. Equity/stock mentions (flagged, not quantified)
 *   4. Normalization to annual USD for comparisons
 */

// ── Regex Patterns ──────────────────────────────────────────────────────────

// Matches: $120k, $120K, $120,000, €85,000, £90k, ₹15,00,000
const SALARY_PATTERN = /(?:[\$€£₹₱]|USD|EUR|GBP|INR)\s*(\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d+)?)\s*[kK]?/g;

// Matches: "$120k - $160k", "$120,000-$160,000", "120k to 160k"
const RANGE_PATTERN = /(?:[\$€£₹]|USD|EUR|GBP|INR)\s*(\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d+)?)\s*[kK]?\s*[-–—to]+\s*(?:[\$€£₹]|USD|EUR|GBP|INR)?\s*(\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d+)?)\s*[kK]?/gi;

// Per-hour rate: "$50/hr", "$45 per hour", "$60/hour"
const HOURLY_PATTERN = /(?:[\$€£])\s*(\d{2,4}(?:\.\d{1,2})?)\s*(?:\/\s*(?:hr|hour)|per\s+hour)/gi;

// Annual indicator: "/year", "/yr", "per annum", "annually", "per year"
const ANNUAL_INDICATOR = /(?:\/\s*(?:year|yr|annum)|per\s+(?:year|annum)|annually|annual\s+salary)/i;

// Currency symbols to codes
const CURRENCY_MAP = {
  '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '₱': 'PHP',
};

/**
 * Normalizes a raw number string (e.g., "120k", "120,000", "85.5K") to an integer.
 */
function normalizeAmount(raw) {
  if (!raw) return null;
  let cleaned = raw.replace(/[\s,]/g, '');
  const isK = /[kK]$/.test(cleaned);
  cleaned = cleaned.replace(/[kK]$/, '');
  let amount = parseFloat(cleaned);
  if (isNaN(amount)) return null;
  if (isK) amount *= 1000;
  // If the number is too small, it's probably in thousands (e.g., "120" meaning $120k)
  if (amount > 0 && amount < 500) amount *= 1000;
  return Math.round(amount);
}

/**
 * Extracts salary information from a job description string.
 *
 * @param {string} text - Raw job description text
 * @returns {Object} Extraction result
 * @returns {string|null} .salary_range - Human-readable salary range (e.g., "$120,000 - $160,000")
 * @returns {number|null} .min_salary - Minimum annual salary (normalized)
 * @returns {number|null} .max_salary - Maximum annual salary (normalized)
 * @returns {string} .currency - Detected currency code (USD, EUR, etc.)
 * @returns {string} .period - 'annual', 'hourly', or 'unknown'
 * @returns {boolean} .has_equity - Whether equity/stock is mentioned
 * @returns {number} .confidence - 0-100 confidence score
 */
export function extractSalary(text) {
  if (!text || typeof text !== 'string') {
    return { salary_range: null, min_salary: null, max_salary: null, currency: 'USD', period: 'unknown', has_equity: false, confidence: 0 };
  }

  const result = {
    salary_range: null,
    min_salary: null,
    max_salary: null,
    currency: 'USD',
    period: 'unknown',
    has_equity: false,
    confidence: 0,
  };

  // Check for equity mentions
  const equityPatterns = /\b(equity|stock\s+options?|rsu|restricted\s+stock|vesting|shares|esop)\b/i;
  result.has_equity = equityPatterns.test(text);

  // Strategy 1: Try to extract a salary range first
  const rangeMatch = RANGE_PATTERN.exec(text);
  if (rangeMatch) {
    const [fullMatch, lowRaw, highRaw] = rangeMatch;

    // Detect currency from the match
    for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
      if (fullMatch.includes(symbol)) { result.currency = code; break; }
    }

    result.min_salary = normalizeAmount(lowRaw);
    result.max_salary = normalizeAmount(highRaw);

    if (result.min_salary && result.max_salary) {
      result.salary_range = `${result.currency === 'USD' ? '$' : result.currency + ' '}${result.min_salary.toLocaleString()} - ${result.currency === 'USD' ? '$' : ''}${result.max_salary.toLocaleString()}`;
      result.period = ANNUAL_INDICATOR.test(text) || result.min_salary > 20000 ? 'annual' : 'unknown';
      result.confidence = 85;
      return result;
    }
  }

  // Strategy 2: Try hourly rate and convert to annual
  HOURLY_PATTERN.lastIndex = 0;
  const hourlyMatch = HOURLY_PATTERN.exec(text);
  if (hourlyMatch) {
    const hourlyRate = parseFloat(hourlyMatch[1]);
    if (hourlyRate > 10 && hourlyRate < 500) {
      const annualEstimate = Math.round(hourlyRate * 2080); // 40hrs * 52 weeks
      result.min_salary = annualEstimate;
      result.max_salary = annualEstimate;
      result.salary_range = `~$${annualEstimate.toLocaleString()}/yr (from $${hourlyRate}/hr)`;
      result.period = 'hourly';
      result.confidence = 70;
      return result;
    }
  }

  // Strategy 3: Try single salary amounts
  SALARY_PATTERN.lastIndex = 0;
  const singleMatches = [];
  let match;
  while ((match = SALARY_PATTERN.exec(text)) !== null) {
    const amount = normalizeAmount(match[1] + (match[0].match(/[kK]/) ? 'k' : ''));
    if (amount && amount > 15000 && amount < 2000000) {
      singleMatches.push(amount);
      // Detect currency
      for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
        if (match[0].includes(symbol)) { result.currency = code; break; }
      }
    }
  }

  if (singleMatches.length >= 2) {
    result.min_salary = Math.min(...singleMatches);
    result.max_salary = Math.max(...singleMatches);
    const sym = result.currency === 'USD' ? '$' : result.currency + ' ';
    result.salary_range = `${sym}${result.min_salary.toLocaleString()} - ${sym}${result.max_salary.toLocaleString()}`;
    result.period = 'annual';
    result.confidence = 75;
  } else if (singleMatches.length === 1) {
    result.min_salary = singleMatches[0];
    result.max_salary = singleMatches[0];
    const sym = result.currency === 'USD' ? '$' : result.currency + ' ';
    result.salary_range = `${sym}${singleMatches[0].toLocaleString()}`;
    result.period = 'annual';
    result.confidence = 50;
  }

  return result;
}

/**
 * Compares a salary range against market benchmarks.
 *
 * @param {number} minSalary - Minimum salary
 * @param {number} maxSalary - Maximum salary
 * @param {string} role - Job title for context
 * @returns {Object} Benchmark comparison
 */
export function benchmarkSalary(minSalary, maxSalary, role = '') {
  const midpoint = (minSalary + maxSalary) / 2;
  const roleLower = role.toLowerCase();

  // Simplified tier benchmarks (US market, 2024-2025)
  let expectedRange = { low: 80000, mid: 120000, high: 180000 };

  if (roleLower.includes('senior') || roleLower.includes('staff')) {
    expectedRange = { low: 140000, mid: 190000, high: 280000 };
  } else if (roleLower.includes('lead') || roleLower.includes('principal')) {
    expectedRange = { low: 160000, mid: 220000, high: 320000 };
  } else if (roleLower.includes('director') || roleLower.includes('vp')) {
    expectedRange = { low: 200000, mid: 280000, high: 400000 };
  } else if (roleLower.includes('intern')) {
    expectedRange = { low: 40000, mid: 65000, high: 100000 };
  } else if (roleLower.includes('junior') || roleLower.includes('entry')) {
    expectedRange = { low: 55000, mid: 80000, high: 110000 };
  }

  let assessment;
  if (midpoint < expectedRange.low) assessment = 'below_market';
  else if (midpoint <= expectedRange.mid) assessment = 'competitive';
  else if (midpoint <= expectedRange.high) assessment = 'above_market';
  else assessment = 'premium';

  return {
    assessment,
    expected_range: expectedRange,
    midpoint,
    percentile: Math.min(100, Math.round((midpoint / expectedRange.high) * 100)),
  };
}

export default { extractSalary, benchmarkSalary };
