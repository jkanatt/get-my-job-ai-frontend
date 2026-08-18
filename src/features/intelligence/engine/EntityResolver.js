/**
 * Entity Resolver — Company & Entity Matching/Deduplication
 * ═══════════════════════════════════════════════════════════════════════
 * Resolves different names/references to the same canonical company.
 * Uses fuzzy matching, domain matching, and alias management.
 */

import crypto from 'crypto';

/**
 * Normalize a company name for comparison.
 */
export function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(pvt\.?|private|ltd\.?|limited|inc\.?|incorporated|llc|llp|corp\.?|corporation|co\.?|company)\b/gi, '')
    .replace(/\b(technologies?|tech|software|solutions?|digital|labs?|studio|ventures?|capital|group|holdings?)\b/gi, (m) => m.toLowerCase())
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract domain from a URL.
 */
export function extractDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity ratio (0 to 1) between two strings.
 */
export function similarity(a, b) {
  if (!a || !b) return 0;
  const normA = normalizeCompanyName(a);
  const normB = normalizeCompanyName(b);

  if (normA === normB) return 1;
  if (!normA || !normB) return 0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;

  const dist = levenshtein(normA, normB);
  return 1 - (dist / maxLen);
}

/**
 * Check if two company names likely refer to the same entity.
 */
export function isSameCompany(nameA, nameB, threshold = 0.75) {
  if (!nameA || !nameB) return false;

  // Exact normalized match
  if (normalizeCompanyName(nameA) === normalizeCompanyName(nameB)) return true;

  // Fuzzy match
  const sim = similarity(nameA, nameB);
  if (sim >= threshold) return true;

  // Check if one is a substring of the other (common with suffixes)
  const normA = normalizeCompanyName(nameA);
  const normB = normalizeCompanyName(nameB);
  if (normA.includes(normB) || normB.includes(normA)) {
    // Only if the shorter name is at least 4 chars to avoid false positives
    const shorter = normA.length < normB.length ? normA : normB;
    if (shorter.length >= 4) return true;
  }

  return false;
}

/**
 * Find matching company from a list of existing companies.
 */
export function findMatchingCompany(name, existingCompanies, options = {}) {
  const { threshold = 0.75, matchByDomain = false, domain = null } = options;

  if (!name && !domain) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const company of existingCompanies) {
    // Exact name match
    if (normalizeCompanyName(name) === normalizeCompanyName(company.canonical_name)) {
      return { company, score: 1.0, matchType: 'exact' };
    }

    // Alias match
    if (company.aliases?.length) {
      for (const alias of company.aliases) {
        if (normalizeCompanyName(alias) === normalizeCompanyName(name)) {
          return { company, score: 0.95, matchType: 'alias' };
        }
      }
    }

    // Domain match (highest confidence)
    if (matchByDomain && domain && company.website) {
      const companyDomain = extractDomain(company.website);
      if (companyDomain && companyDomain === domain) {
        return { company, score: 1.0, matchType: 'domain' };
      }
    }

    // Fuzzy match
    const score = similarity(name, company.canonical_name);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = { company, score, matchType: 'fuzzy' };
    }

    // Also check aliases for fuzzy match
    if (company.aliases?.length) {
      for (const alias of company.aliases) {
        const aliasScore = similarity(name, alias);
        if (aliasScore > bestScore && aliasScore >= threshold) {
          bestScore = aliasScore;
          bestMatch = { company, score: aliasScore, matchType: 'fuzzy-alias' };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Validate whether a string looks like a real company name.
 * Rejects headline fragments, generic words, and obvious noise.
 */
export function isValidCompanyName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;

  // Reject pure numbers or single characters
  if (/^\d+$/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 8) return false;

  // Reject known noise patterns from headlines
  const NOISE_PATTERNS = [
    /^(exclusive|breaking|update|report|alert|watch|opinion|editorial)[:\s]/i,
    /^(no|the|a|an|this|that|these|those|how|why|what|when|where|which)\s/i,
    /^(daily|weekly|monthly|annual|fresh|latest|top|best|biggest|most)\s/i,
    /^(charting|tracking|inside|behind|show|ask|tell|launch)\s/i,
    /^(london|glasgow|munich|cyprus|finland|berlin|paris|new york)[\s'-]/i,
    /^[\w]+-based\s/i,
    /^(edtech|fintech|legaltech|healthtech|agritech|proptech|insurtech)\s+(platform|startup|company|firm)/i,
    /^(repeat|serial|first-time)\s+(founder|entrepreneur)/i,
    /^(here|there|it|they|we|you|he|she)\s/i,
    /^(funding|startup|venture|angel|investor|vc|pe)\s+(round|news|alert|update|watch|report)/i,
    /^(week'?s?\s+|summer|winter|spring|fall|autumn)\s/i,
  ];

  if (NOISE_PATTERNS.some(p => p.test(trimmed))) return false;

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) return false;

  // Single word under 3 chars is likely noise
  if (trimmed.split(/\s+/).length === 1 && trimmed.length < 3) return false;

  return true;
}

/**
 * Resolve a scraped company name to a canonical company record.
 * Returns existing company or a new company object to insert.
 */
export function resolveCompany(scrapedName, scrapedData = {}, existingCompanies = []) {
  if (!scrapedName || !isValidCompanyName(scrapedName)) return null;

  const match = findMatchingCompany(scrapedName, existingCompanies, {
    threshold: 0.75,
    matchByDomain: !!scrapedData.website,
    domain: extractDomain(scrapedData.website),
  });

  if (match) {
    // Update aliases if the scraped name is different
    const normScraped = normalizeCompanyName(scrapedName);
    const normCanonical = normalizeCompanyName(match.company.canonical_name);
    const existingAliases = (match.company.aliases || []).map(normalizeCompanyName);

    const needsAliasUpdate = normScraped !== normCanonical && !existingAliases.includes(normScraped);

    return {
      isExisting: true,
      company: match.company,
      matchScore: match.score,
      matchType: match.matchType,
      newAlias: needsAliasUpdate ? scrapedName : null,
    };
  }

  // No match found — create new company record
  const slug = generateSlug(scrapedName);

  return {
    isExisting: false,
    company: {
      canonical_name: scrapedName,
      aliases: [],
      slug,
      website: scrapedData.website || null,
      logo_url: scrapedData.logo || null,
      description: scrapedData.description || null,
      industry: scrapedData.industry || null,
      location: scrapedData.location || null,
      country: detectCountry(scrapedData.location),
      founded_year: scrapedData.founded_year || null,
      stage: scrapedData.stage || null,
      is_indian: isIndianCompany(scrapedData),
      metadata: {},
    },
    matchScore: 0,
    matchType: 'new',
  };
}

/**
 * Normalize an investor name.
 */
export function normalizeInvestorName(name) {
  if (!name) return '';
  return name
    .replace(/\b(capital|ventures?|partners?|investments?|fund|management|advisors?|holdings?|group)\b/gi, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a person name.
 */
export function normalizePersonName(name) {
  if (!name) return '';
  return name
    .replace(/\b(mr|mrs|ms|dr|prof)\.?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ─── Helpers ───────────────────────────────────────────────────────────

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function detectCountry(location) {
  if (!location) return null;
  const india = /\b(india|bangalore|bengaluru|mumbai|delhi|ncr|hyderabad|chennai|pune|noida|gurgaon|gurugram|kolkata|ahmedabad|jaipur|kochi|chandigarh|indore)\b/i;
  if (india.test(location)) return 'India';

  const countryPatterns = {
    'United States': /\b(usa|united states|san francisco|new york|silicon valley|palo alto|seattle|austin|boston|chicago|los angeles|miami)\b/i,
    'United Kingdom': /\b(uk|united kingdom|london|manchester|edinburgh|cambridge)\b/i,
    'Singapore': /\b(singapore)\b/i,
    'Germany': /\b(germany|berlin|munich|hamburg)\b/i,
    'Israel': /\b(israel|tel aviv)\b/i,
  };

  for (const [country, pattern] of Object.entries(countryPatterns)) {
    if (pattern.test(location)) return country;
  }

  return null;
}

function isIndianCompany(data) {
  if (!data) return false;
  const location = (data.location || '').toLowerCase();
  const country = (data.country || '').toLowerCase();
  return country === 'india' || /\b(india|bangalore|bengaluru|mumbai|delhi|hyderabad|chennai|pune|noida|gurgaon|gurugram)\b/i.test(location);
}
