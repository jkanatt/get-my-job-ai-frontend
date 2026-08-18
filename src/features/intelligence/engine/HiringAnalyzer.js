/**
 * Hiring Analyzer — Connects funding intelligence with existing jobs database
 * ═══════════════════════════════════════════════════════════════════════
 * Matches companies from funding events to the existing jobs table,
 * calculates hiring growth metrics, and generates job-seeker signals.
 */

import { normalizeCompanyName, similarity } from './EntityResolver.js';

/**
 * Match a company to existing jobs in the database.
 *
 * @param {string} companyName - Company name from intelligence data
 * @param {object[]} jobs - Array of jobs from the jobs table
 * @returns {object} Matching jobs and hiring metrics
 */
export function matchCompanyToJobs(companyName, jobs) {
  if (!companyName || !jobs?.length) {
    return { matchedJobs: [], metrics: getEmptyMetrics() };
  }

  const normalized = normalizeCompanyName(companyName);
  const matchedJobs = [];

  for (const job of jobs) {
    if (!job.company) continue;
    const jobCompanyNorm = normalizeCompanyName(job.company);

    // Exact match or high similarity
    if (jobCompanyNorm === normalized || similarity(companyName, job.company) >= 0.8) {
      matchedJobs.push(job);
    }
  }

  const metrics = calculateHiringMetrics(matchedJobs);

  return { matchedJobs, metrics };
}

/**
 * Calculate comprehensive hiring metrics for a set of matched jobs.
 */
export function calculateHiringMetrics(jobs) {
  if (!jobs?.length) return getEmptyMetrics();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Time-based job counts
  const recentJobs = jobs.filter(j => new Date(j.created_at) >= thirtyDaysAgo);
  const previousPeriodJobs = jobs.filter(j => {
    const d = new Date(j.created_at);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  });

  // Department breakdown
  const departments = {};
  const locations = {};
  const experienceLevels = {};

  for (const job of jobs) {
    const dept = classifyDepartment(job.title);
    departments[dept] = (departments[dept] || 0) + 1;

    if (job.location) {
      const loc = job.location.split(',')[0]?.trim() || job.location;
      locations[loc] = (locations[loc] || 0) + 1;
    }

    const level = classifyExperienceLevel(job.title);
    experienceLevels[level] = (experienceLevels[level] || 0) + 1;
  }

  // Department growth (compare recent vs previous period)
  const recentDeptBreakdown = {};
  for (const job of recentJobs) {
    const dept = classifyDepartment(job.title);
    recentDeptBreakdown[dept] = (recentDeptBreakdown[dept] || 0) + 1;
  }

  // Growth rate
  const growthRate = previousPeriodJobs.length > 0
    ? Math.round(((recentJobs.length - previousPeriodJobs.length) / previousPeriodJobs.length) * 100)
    : recentJobs.length > 0 ? 100 : 0;

  return {
    totalJobs: jobs.length,
    recentJobs: recentJobs.length,
    growthRate,
    departments,
    departmentGrowth: recentDeptBreakdown,
    locations,
    experienceLevels,
    isHiringAggressively: recentJobs.length >= 10 || growthRate >= 50,
    recentlyAdded: recentJobs.length,
    oldestJob: jobs.reduce((min, j) => j.created_at < min ? j.created_at : min, jobs[0].created_at),
    newestJob: jobs.reduce((max, j) => j.created_at > max ? j.created_at : max, jobs[0].created_at),
  };
}

/**
 * Generate job-seeker intelligence signals for a company.
 */
export function generateSignals(company, fundingRounds, newsEvents, hiringMetrics) {
  const signals = [];

  // Funding signals
  if (fundingRounds?.length > 0) {
    const latestRound = fundingRounds.sort((a, b) => new Date(b.funding_date) - new Date(a.funding_date))[0];
    const daysSinceRound = latestRound.funding_date
      ? Math.floor((Date.now() - new Date(latestRound.funding_date).getTime()) / (24 * 60 * 60 * 1000))
      : null;

    if (daysSinceRound && daysSinceRound <= 90) {
      signals.push({
        type: 'recently_funded',
        label: 'Recently Funded',
        detail: `${latestRound.round_type?.replace('-', ' ')} — $${formatAmount(latestRound.amount_usd)}`,
        priority: 'high',
        icon: '💰',
      });
    }

    if (latestRound.amount_usd && latestRound.amount_usd >= 50_000_000) {
      signals.push({
        type: 'mega_round',
        label: 'Mega Round',
        detail: `$${formatAmount(latestRound.amount_usd)} raised`,
        priority: 'high',
        icon: '🚀',
      });
    }
  }

  // Hiring signals
  if (hiringMetrics) {
    if (hiringMetrics.isHiringAggressively) {
      signals.push({
        type: 'hiring_aggressively',
        label: 'Hiring Aggressively',
        detail: `${hiringMetrics.recentJobs} new jobs in 30 days`,
        priority: 'high',
        icon: '📈',
      });
    }

    if (hiringMetrics.growthRate > 0) {
      signals.push({
        type: 'hiring_growth',
        label: `+${hiringMetrics.growthRate}% Hiring Growth`,
        detail: `${hiringMetrics.totalJobs} total open positions`,
        priority: 'medium',
        icon: '📊',
      });
    }

    // Department-specific signals
    const topDepts = Object.entries(hiringMetrics.departmentGrowth || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [dept, count] of topDepts) {
      if (count >= 3) {
        signals.push({
          type: 'dept_hiring',
          label: `Hiring ${dept}`,
          detail: `${count} new ${dept} roles`,
          priority: 'medium',
          icon: '🏗️',
        });
      }
    }

    // Geographic expansion
    const locationCount = Object.keys(hiringMetrics.locations || {}).length;
    if (locationCount >= 3) {
      signals.push({
        type: 'geographic_expansion',
        label: 'Multi-Location Hiring',
        detail: `Hiring across ${locationCount} locations`,
        priority: 'medium',
        icon: '🌍',
      });
    }
  }

  // News signals
  if (newsEvents?.length > 0) {
    const recentNews = newsEvents.filter(e => {
      const age = Date.now() - new Date(e.event_date || e.publication_date || e.created_at).getTime();
      return age <= 90 * 24 * 60 * 60 * 1000; // 90 days
    });

    const hasLayoffs = recentNews.some(e => e.category === 'workforce');
    const hasExpansion = recentNews.some(e => e.category === 'growth');
    const hasNewProduct = recentNews.some(e => e.category === 'product');
    const hasPartnership = recentNews.some(e => e.category === 'partnership');
    const hasAcquisition = recentNews.some(e => e.category === 'ma');
    const hasLeadershipChange = recentNews.some(e => e.category === 'leadership');

    if (hasExpansion) signals.push({ type: 'expanding', label: 'Expanding', detail: 'Recent expansion news', priority: 'medium', icon: '🌱' });
    if (hasNewProduct) signals.push({ type: 'new_product', label: 'New Product', detail: 'Recent product launch', priority: 'medium', icon: '🆕' });
    if (hasPartnership) signals.push({ type: 'partnership', label: 'New Partnership', detail: 'Strategic partnership announced', priority: 'low', icon: '🤝' });
    if (hasAcquisition) signals.push({ type: 'acquisition', label: 'Acquisition', detail: 'Recent M&A activity', priority: 'medium', icon: '🏢' });
    if (hasLeadershipChange) signals.push({ type: 'leadership_change', label: 'Leadership Change', detail: 'Executive change reported', priority: 'low', icon: '👔' });

    // Warning signals
    if (hasLayoffs) {
      signals.push({ type: 'layoffs', label: 'Recent Layoffs', detail: 'Workforce reduction reported', priority: 'warning', icon: '⚠️' });
    }
  }

  // Strong investor backing
  if (fundingRounds?.length >= 3) {
    signals.push({
      type: 'strong_backing',
      label: 'Strong Investor Backing',
      detail: `${fundingRounds.length} funding rounds`,
      priority: 'medium',
      icon: '🏦',
    });
  }

  return signals.sort((a, b) => {
    const priorityOrder = { high: 0, warning: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
  });
}

/**
 * Generate a hiring summary string.
 * e.g., "Raised $50M → 37 new jobs → Engineering +15 → Sales +9"
 */
export function generateHiringSummary(latestFunding, hiringMetrics) {
  const parts = [];

  if (latestFunding?.amount_usd) {
    parts.push(`Raised $${formatAmount(latestFunding.amount_usd)}`);
  }

  if (hiringMetrics?.recentJobs > 0) {
    parts.push(`${hiringMetrics.recentJobs} new jobs`);
  }

  const topDepts = Object.entries(hiringMetrics?.departmentGrowth || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [dept, count] of topDepts) {
    parts.push(`${dept} +${count}`);
  }

  return parts.join(' → ');
}

// ─── Department Classification ─────────────────────────────────────────

function classifyDepartment(title) {
  if (!title) return 'Other';
  const t = title.toLowerCase();

  if (/\b(engineer|developer|frontend|backend|fullstack|full-stack|devops|sre|software|platform|infra|cloud|data\s*engineer|ml\s*engineer|ai\s*engineer)\b/.test(t)) return 'Engineering';
  if (/\b(product\s*manager|pm|product\s*lead|product\s*owner|product\s*director)\b/.test(t)) return 'Product';
  if (/\b(design|ux|ui|graphic|visual|creative|brand)\b/.test(t)) return 'Design';
  if (/\b(data\s*scien|data\s*analy|analytics|bi\s|business\s*intelligence|ml|machine\s*learning|ai\b|artificial)\b/.test(t)) return 'Data & AI';
  if (/\b(sales|account\s*exec|business\s*develop|bdr|sdr|revenue|partnerships?\b)\b/.test(t)) return 'Sales';
  if (/\b(market|growth|seo|content|social\s*media|communications|pr\b|public\s*relation)\b/.test(t)) return 'Marketing';
  if (/\b(operations|ops|supply\s*chain|logistics|procurement|admin)\b/.test(t)) return 'Operations';
  if (/\b(financ|account|cfo|controller|tax|audit|treasury)\b/.test(t)) return 'Finance';
  if (/\b(human\s*resource|hr\b|people|talent|recruit|hiring)\b/.test(t)) return 'HR';
  if (/\b(legal|compliance|regulatory|counsel|attorney)\b/.test(t)) return 'Legal';
  if (/\b(customer|support|success|service|help\s*desk)\b/.test(t)) return 'Customer Success';
  if (/\b(ceo|cto|coo|cfo|cpo|cmo|vp|vice\s*president|director|head\s+of|chief|founder|co-?founder)\b/.test(t)) return 'Leadership';
  if (/\b(qa|quality|test|automation\s*test)\b/.test(t)) return 'QA';
  if (/\b(security|cyber|infosec|soc)\b/.test(t)) return 'Security';

  return 'Other';
}

function classifyExperienceLevel(title) {
  if (!title) return 'mid';
  const t = title.toLowerCase();

  if (/\b(intern|trainee|fresher|entry|junior|jr|associate)\b/.test(t)) return 'entry';
  if (/\b(senior|sr|lead|principal|staff|architect|distinguished)\b/.test(t)) return 'senior';
  if (/\b(manager|director|head|vp|vice|chief|c-level|founder|co-founder)\b/.test(t)) return 'leadership';
  return 'mid';
}

function formatAmount(amount) {
  if (!amount) return '0';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}

function getEmptyMetrics() {
  return {
    totalJobs: 0,
    recentJobs: 0,
    growthRate: 0,
    departments: {},
    departmentGrowth: {},
    locations: {},
    experienceLevels: {},
    isHiringAggressively: false,
    recentlyAdded: 0,
    oldestJob: null,
    newestJob: null,
  };
}
