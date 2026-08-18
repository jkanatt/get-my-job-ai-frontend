/**
 * Verification Engine — Multi-Source Cross-Verification
 * ═══════════════════════════════════════════════════════════════════════
 * Assigns verification status and confidence scores to events based on
 * source count, source reliability, and data consistency.
 *
 * Pipeline: Discover → Extract → Normalize → Deduplicate → Cross-check → Verify → Store
 */

// ─── Source Reliability Scores ─────────────────────────────────────────
// Reference architecture trust hierarchy:
//   Regulatory filings (SEC) → Company's own site → Tier-1 press → News aggregators
const SOURCE_RELIABILITY = {
  // ── Regulatory / Primary (highest trust) ──
  'sec-edgar': 98,           // Official SEC Form D filings — highest possible trust
  'company-website': 97,     // Company's own press/blog — primary source corroboration
  'startup-india-dpiit': 92, // Official DPIIT registry — government data

  // ── Tier-1 Tech Press ──
  'techcrunch-funding': 95,
  'crunchbase-news': 95,
  'et-startups': 90,
  'livemint-startups': 88,
  'moneycontrol-startups': 87,
  'yourstory-funding': 85,
  'inc42-funding': 85,
  'vccircle': 85,
  'sifted': 85,

  // ── Tier-2 / Aggregators ──
  'entrackr': 80,
  'techasia': 80,
  'dealstreetasia': 80,
  'eu-startups': 78,
  'gdelt': 75,              // GDELT aggregates from many publishers
  'newsapi': 75,             // NewsAPI aggregates too
  'tracxn-india': 75,
  'investor-portfolio': 75,
  'producthunt': 70,
  'company-careers': 70,

  // ── Low-Signal ──
  'failory-startups': 65,
  'hackernews': 60,
  'linkedin-public': 60,
  'github-trending': 50,
};

/**
 * Calculate verification status and confidence score for an event.
 * Reference-architecture scoring formula:
 *   0.25 * n_sources
 * + 0.35 if has_primary (company_site, sec-edgar, investor-site, dpiit)
 * + 0.15 if amount_known
 * + 0.10 if lead_investor_known
 *
 * @param {object} event - Deduplicated event with sources array
 * @returns {object} { verificationStatus, confidenceScore }
 */
export function verifyEvent(event) {
  const sources = event.sources || [];
  const uniqueUrls = new Set(sources.map(s => s.url || s.sourceUrl).filter(Boolean));
  const sourceCount = Math.max(uniqueUrls.size, sources.length);

  // Detect PRIMARY sources — highest trust level
  const PRIMARY_SOURCE_TYPES = ['company_site', 'company-website', 'regulatory', 'investor_site'];
  const PRIMARY_SOURCE_IDS = ['sec-edgar', 'company-website', 'startup-india-dpiit'];

  const hasPrimarySource = sources.some(s =>
    PRIMARY_SOURCE_TYPES.includes(s.sourceType)
    || PRIMARY_SOURCE_IDS.includes(s.id || s.sourceId)
    || (SOURCE_RELIABILITY[s.id || s.sourceId] || 0) >= 92
  );

  // Reference-architecture confidence formula
  let confidence = Math.min(100,
    (25 * Math.min(sourceCount, 4))  // 25 per source, max 4 sources = 100
    + (hasPrimarySource ? 35 : 0)     // Primary source bonus
    + (event.funding?.amount ? 15 : 0) // Amount known bonus
    + (event.funding?.leadInvestor ? 10 : 0) // Lead investor known bonus
  );

  // Additional boosts from source reliability
  const reliabilityScores = sources.map(s => SOURCE_RELIABILITY[s.id || s.sourceId] || 50);
  const maxReliability = Math.max(...reliabilityScores, 0);
  if (maxReliability >= 95) confidence = Math.min(100, confidence + 5);

  // Penalty for old single-source news
  if (sourceCount === 1 && event.publishedAt) {
    const age = Date.now() - new Date(event.publishedAt).getTime();
    const dayAge = age / (24 * 60 * 60 * 1000);
    if (dayAge > 30) confidence = Math.max(10, confidence - 10);
  }

  // Reference-architecture status determination
  let verificationStatus;
  if (sourceCount >= 2 && hasPrimarySource) {
    verificationStatus = 'confirmed';              // 2+ sources with primary = gold standard
  } else if (hasPrimarySource || sourceCount >= 2) {
    verificationStatus = 'high_confidence';         // Single primary OR 2+ secondary
  } else if (event.funding?.amount && !event.funding?.leadInvestor) {
    verificationStatus = 'estimated';               // Amount known but investor unclear
  } else if (sourceCount === 1 && maxReliability < 75) {
    verificationStatus = 'unverified';              // Single weak source
  } else {
    verificationStatus = 'inferred';                // Derived or partial data
  }

  return {
    verificationStatus,
    confidenceScore: Math.round(confidence),
  };
}

/**
 * Cross-verify funding data across multiple sources.
 * Checks consistency of amount, round, investors.
 *
 * @param {object[]} fundingReports - Multiple reports of the same funding event
 * @returns {object} Verified funding data
 */
export function crossVerifyFunding(fundingReports) {
  if (!fundingReports || fundingReports.length === 0) return null;

  const amounts = fundingReports
    .map(r => r.funding?.amountUsd)
    .filter(a => a && a > 0);

  const rounds = fundingReports
    .map(r => r.funding?.round)
    .filter(r => r && r !== 'undisclosed');

  const leadInvestors = fundingReports
    .map(r => r.funding?.leadInvestor)
    .filter(Boolean);

  const allInvestors = new Set();
  for (const report of fundingReports) {
    if (report.funding?.leadInvestor) allInvestors.add(report.funding.leadInvestor);
    if (report.funding?.otherInvestors) {
      for (const inv of report.funding.otherInvestors) allInvestors.add(inv);
    }
  }

  // Verify amount consistency
  let verifiedAmount = null;
  let amountConsistency = 'unknown';

  if (amounts.length > 0) {
    const median = amounts.sort((a, b) => a - b)[Math.floor(amounts.length / 2)];

    // Check if amounts are within 10% of each other
    const withinRange = amounts.every(a => Math.abs(a - median) / median <= 0.1);
    if (withinRange) {
      verifiedAmount = median;
      amountConsistency = 'consistent';
    } else {
      verifiedAmount = median;
      amountConsistency = 'inconsistent';
    }
  }

  // Verify round consistency
  let verifiedRound = 'undisclosed';
  if (rounds.length > 0) {
    const roundCounts = {};
    for (const r of rounds) roundCounts[r] = (roundCounts[r] || 0) + 1;
    verifiedRound = Object.entries(roundCounts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // Verify lead investor
  let verifiedLeadInvestor = null;
  if (leadInvestors.length > 0) {
    const investorCounts = {};
    for (const inv of leadInvestors) investorCounts[inv] = (investorCounts[inv] || 0) + 1;
    verifiedLeadInvestor = Object.entries(investorCounts).sort((a, b) => b[1] - a[1])[0][0];
  }

  return {
    amount: verifiedAmount,
    amountUsd: verifiedAmount,
    currency: 'USD',
    round: verifiedRound,
    leadInvestor: verifiedLeadInvestor,
    otherInvestors: [...allInvestors].filter(i => i !== verifiedLeadInvestor),
    amountConsistency,
    sourceCount: fundingReports.length,
  };
}

/**
 * Verify and score a batch of events.
 *
 * @param {object[]} events - Deduplicated events
 * @returns {object[]} Events with verification status and confidence scores
 */
export function verifyBatch(events) {
  return events.map(event => {
    const { verificationStatus, confidenceScore } = verifyEvent(event);
    return {
      ...event,
      verification_status: verificationStatus,
      confidence_score: confidenceScore,
    };
  });
}
