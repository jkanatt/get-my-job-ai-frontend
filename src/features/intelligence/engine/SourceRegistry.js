/**
 * Source Registry — Central Configuration for All Intelligence Data Sources
 * ═══════════════════════════════════════════════════════════════════════════
 * Defines every RSS feed, API endpoint, and web scraping target used by
 * the intelligence pipeline. Each source has its own scraping interval,
 * region targeting, and parser configuration.
 */

// ─── RSS Feed Sources ──────────────────────────────────────────────────
export const RSS_SOURCES = [
  // ── India ──
  {
    id: 'yourstory-funding',
    name: 'YourStory Funding',
    url: 'https://yourstory.com/category/funding/rss',
    region: 'india',
    category: 'funding',
    intervalMinutes: 30,
    parser: 'generic-rss',
  },
  {
    id: 'inc42-funding',
    name: 'Inc42 Funding',
    url: 'https://inc42.com/category/buzz/funding-buzz/feed/',
    region: 'india',
    category: 'funding',
    intervalMinutes: 30,
    parser: 'generic-rss',
  },
  {
    id: 'entrackr',
    name: 'Entrackr',
    url: 'https://entrackr.com/feed/',
    region: 'india',
    category: 'funding',
    intervalMinutes: 45,
    parser: 'generic-rss',
  },
  {
    id: 'vccircle',
    name: 'VCCircle',
    url: 'https://www.vccircle.com/feed',
    region: 'india',
    category: 'funding',
    intervalMinutes: 45,
    parser: 'generic-rss',
  },
  {
    id: 'et-startups',
    name: 'ET Tech Startups',
    url: 'https://economictimes.indiatimes.com/rssfeeds/5575607.cms',
    region: 'india',
    category: 'mixed',
    intervalMinutes: 30,
    parser: 'generic-rss',
  },
  {
    id: 'livemint-startups',
    name: 'LiveMint Startups',
    url: 'https://www.livemint.com/rss/companies/start-ups',
    region: 'india',
    category: 'mixed',
    intervalMinutes: 60,
    parser: 'generic-rss',
  },
  {
    id: 'moneycontrol-startups',
    name: 'Moneycontrol Startups',
    url: 'https://www.moneycontrol.com/rss/startups.xml',
    region: 'india',
    category: 'mixed',
    intervalMinutes: 60,
    parser: 'generic-rss',
  },
  // ── Global ──
  {
    id: 'techcrunch-funding',
    name: 'TechCrunch Funding',
    url: 'https://techcrunch.com/category/venture/feed/',
    region: 'global',
    category: 'funding',
    intervalMinutes: 30,
    parser: 'generic-rss',
  },
  {
    id: 'crunchbase-news',
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com/feed/',
    region: 'global',
    category: 'funding',
    intervalMinutes: 45,
    parser: 'generic-rss',
  },
  {
    id: 'sifted',
    name: 'Sifted (Europe)',
    url: 'https://sifted.eu/feed',
    region: 'global',
    category: 'funding',
    intervalMinutes: 60,
    parser: 'generic-rss',
  },
  {
    id: 'techasia',
    name: 'Tech in Asia',
    url: 'https://www.techinasia.com/feed',
    region: 'global',
    category: 'mixed',
    intervalMinutes: 60,
    parser: 'generic-rss',
  },
  {
    id: 'eu-startups',
    name: 'EU-Startups',
    url: 'https://www.eu-startups.com/feed/',
    region: 'global',
    category: 'funding',
    intervalMinutes: 120,
    parser: 'generic-rss',
  },
  // ── India (new) ──
  {
    id: 'startuptalky',
    name: 'StartupTalky',
    url: 'https://startuptalky.com/feed/',
    region: 'india',
    category: 'funding',
    intervalMinutes: 60,
    parser: 'generic-rss',
  },
  {
    id: 'inc42-main',
    name: 'Inc42 Main',
    url: 'https://inc42.com/feed/',
    region: 'india',
    category: 'mixed',
    intervalMinutes: 45,
    parser: 'generic-rss',
  },
  {
    id: 'business-standard-startups',
    name: 'Business Standard Startups',
    url: 'https://www.business-standard.com/rss/companies/start-ups-107050800.rss',
    region: 'india',
    category: 'funding',
    intervalMinutes: 60,
    parser: 'generic-rss',
  },
  {
    id: 'mint-companies',
    name: 'LiveMint Companies',
    url: 'https://www.livemint.com/rss/companies',
    region: 'india',
    category: 'mixed',
    intervalMinutes: 60,
    parser: 'generic-rss',
  },
  {
    id: 'trak-in',
    name: 'trak.in',
    url: 'https://trak.in/feed/',
    region: 'india',
    category: 'mixed',
    intervalMinutes: 120,
    parser: 'generic-rss',
  },
  {
    id: 'medianama',
    name: 'MediaNama',
    url: 'https://www.medianama.com/feed/',
    region: 'india',
    category: 'mixed',
    intervalMinutes: 120,
    parser: 'generic-rss',
  },
  // ── Global (new) ──
  {
    id: 'venturebeat',
    name: 'VentureBeat',
    url: 'https://venturebeat.com/feed/',
    region: 'global',
    category: 'mixed',
    intervalMinutes: 45,
    parser: 'generic-rss',
  },
  {
    id: 'pitchbook-news',
    name: 'PitchBook News',
    url: 'https://pitchbook.com/rss/news',
    region: 'global',
    category: 'funding',
    intervalMinutes: 60,
    parser: 'generic-rss',
  },
  {
    id: 'fortune-termsheet',
    name: 'Fortune Term Sheet',
    url: 'https://fortune.com/section/term-sheet/feed/',
    region: 'global',
    category: 'funding',
    intervalMinutes: 120,
    parser: 'generic-rss',
  },
  {
    id: 'bloomberg-tech',
    name: 'Bloomberg Technology',
    url: 'https://feeds.bloomberg.com/technology/news.rss',
    region: 'global',
    category: 'mixed',
    intervalMinutes: 60,
    parser: 'generic-rss',
  },
  {
    id: 'cbinsights-blog',
    name: 'CB Insights Blog',
    url: 'https://www.cbinsights.com/research/feed/',
    region: 'global',
    category: 'funding',
    intervalMinutes: 240,
    parser: 'generic-rss',
  },
  {
    id: 'the-ken',
    name: 'The Ken',
    url: 'https://the-ken.com/feed/',
    region: 'both',
    category: 'mixed',
    intervalMinutes: 120,
    parser: 'generic-rss',
  },
  {
    id: 'techfundingnews',
    name: 'Tech Funding News',
    url: 'https://techfundingnews.com/feed/',
    region: 'global',
    category: 'funding',
    intervalMinutes: 120,
    parser: 'generic-rss',
  },
];

// ─── API Sources ───────────────────────────────────────────────────────
export const API_SOURCES = [
  {
    id: 'hackernews',
    name: 'Hacker News',
    baseUrl: 'https://hacker-news.firebaseio.com/v0',
    region: 'global',
    category: 'mixed',
    intervalMinutes: 60,
    endpoints: {
      topStories: '/topstories.json',
      newStories: '/newstories.json',
      item: '/item/{id}.json',
    },
    searchTerms: ['funding', 'series a', 'series b', 'raised', 'startup', 'venture'],
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    baseUrl: 'https://api.producthunt.com/v2/api/graphql',
    region: 'global',
    category: 'product',
    intervalMinutes: 360,
    requiresAuth: false,
  },
  {
    id: 'github-trending',
    name: 'GitHub Trending',
    baseUrl: 'https://api.github.com',
    region: 'global',
    category: 'product',
    intervalMinutes: 720,
  },
];

// ─── Web Scraping Targets ──────────────────────────────────────────────
export const WEB_SOURCES = [
  {
    id: 'tracxn-india',
    name: 'Tracxn India Startups',
    url: 'https://tracxn.com/d/trending-companies/Startups-in-India',
    region: 'india',
    category: 'funding',
    intervalMinutes: 360,
    method: 'cheerio',
    selectors: {
      companyList: '.company-card',
      name: '.company-name',
      funding: '.funding-amount',
      round: '.funding-round',
    },
  },
  {
    id: 'dealstreetasia',
    name: 'DealStreetAsia',
    url: 'https://www.dealstreetasia.com/stories/tag/funding/',
    region: 'global',
    category: 'funding',
    intervalMinutes: 240,
    method: 'cheerio',
  },
  {
    id: 'failory-startups',
    name: 'Failory Indian Startups',
    url: 'https://www.failory.com/startups/india',
    region: 'india',
    category: 'company-data',
    intervalMinutes: 1440,
    method: 'cheerio',
  },
  // ── India Web (new) ──
  {
    id: 'paper-vc',
    name: 'paper.vc India Funding Tracker',
    url: 'https://paper.vc/',
    region: 'india',
    category: 'funding',
    intervalMinutes: 720,
    method: 'cheerio',
    scraper: 'india-funding',
  },
  {
    id: 'eqmint',
    name: 'eqmint India Monthly Tracker',
    url: 'https://eqmint.com/',
    region: 'india',
    category: 'funding',
    intervalMinutes: 1440,
    method: 'cheerio',
    scraper: 'india-funding',
  },
  {
    id: 'ipo-platform',
    name: 'IPO Platform',
    url: 'https://ipoplatform.com/',
    region: 'india',
    category: 'ipo',
    intervalMinutes: 720,
    method: 'cheerio',
    scraper: 'india-funding',
  },
  {
    id: 'startup-grants-india',
    name: 'Startup Grants India',
    url: 'https://startupgrantsindia.com/',
    region: 'india',
    category: 'funding',
    intervalMinutes: 1440,
    method: 'cheerio',
    scraper: 'india-funding',
  },
  // ── Global Web (new) ──
  {
    id: 'owler-funding',
    name: 'Owler Funding',
    url: 'https://www.owler.com/feed/recent-funding-rounds',
    region: 'global',
    category: 'funding',
    intervalMinutes: 360,
    method: 'cheerio',
    scraper: 'global-funding',
  },
  {
    id: 'cbinsights-unicorn',
    name: 'CB Insights Unicorn Tracker',
    url: 'https://www.cbinsights.com/research-unicorn-companies',
    region: 'global',
    category: 'funding',
    intervalMinutes: 1440,
    method: 'cheerio',
    scraper: 'global-funding',
  },
  {
    id: 'wellfound-trending',
    name: 'Wellfound (AngelList) Trending',
    url: 'https://wellfound.com/discover/startups',
    region: 'global',
    category: 'company-data',
    intervalMinutes: 720,
    method: 'cheerio',
    scraper: 'global-funding',
  },
];

// ─── AI Scraping Targets (ScrapeGraphAI / Scrapling) ───────────────────
export const AI_SOURCES = [
  {
    id: 'company-careers',
    name: 'Company Careers Pages',
    description: 'Scrape individual company career pages for job counts',
    method: 'scrapegraph',
    intervalMinutes: 720,
    extractionSchema: {
      job_count: 'number of open positions',
      departments: 'list of hiring departments',
      locations: 'list of office locations',
    },
  },
  {
    id: 'linkedin-public',
    name: 'LinkedIn Public Profiles',
    description: 'Extract public company data from LinkedIn',
    method: 'scrapling',
    intervalMinutes: 1440,
    extractionSchema: {
      employee_count: 'number of employees',
      industry: 'company industry',
      headquarters: 'headquarters location',
      specialties: 'list of specialties',
    },
  },
  {
    id: 'investor-portfolio',
    name: 'Investor Portfolio Pages',
    description: 'Scrape VC/investor portfolio pages',
    method: 'scrapegraph',
    intervalMinutes: 1440,
    extractionSchema: {
      portfolio_companies: 'list of portfolio companies with funding details',
      focus_areas: 'investment focus areas',
    },
  },
];

// ─── Funding Round Extraction Patterns ─────────────────────────────────
export const FUNDING_PATTERNS = {
  amounts: [
    /\$\s*([\d,.]+)\s*(million|mn|m|billion|bn|b|thousand|k|cr|crore|lakh|lk)/gi,
    /(?:raised|secured|closes?|gets?|bags?|receives?)\s*\$\s*([\d,.]+)\s*(million|mn|m|billion|bn|b)/gi,
    /(?:rs|inr|₹)\s*([\d,.]+)\s*(crore|cr|lakh|lk|million|mn|billion|bn)/gi,
  ],
  rounds: [
    /(?:series|round)\s+([a-h])/i,
    /\b(pre-?seed|seed|angel|bridge|ipo|pre-?ipo)\b/i,
    /\b(series\s+[a-h]\d?)\b/i,
    /\b(debt\s+(?:financing|round))\b/i,
    /\b(convertible\s+note)\b/i,
  ],
  investors: [
    /(?:led|backed)\s+by\s+([^,.]+)/i,
    /(?:investors?\s+include)\s+([^.]+)/i,
    /(?:participation\s+from)\s+([^.]+)/i,
  ],
};

// ─── News Event Category Patterns ──────────────────────────────────────
export const NEWS_CATEGORY_PATTERNS = {
  funding: [
    /\b(?:raised?|secures?|closes?|bags?|funding|funded|round|series|valuation|investment|investor|venture|vc)\b/i,
  ],
  hiring: [
    /\b(?:hir(?:es?|ing)|recruit|appoint|onboard|CTO|CXO|CPO|VP|head\s+of|talent|workforce\s+expan)/i,
  ],
  growth: [
    /\b(?:expand|launch(?:es|ed)?|opens?\s+office|new\s+(?:office|location|market|country)|enter(?:s|ed)?|go(?:es|ing)\s+global)\b/i,
  ],
  product: [
    /\b(?:launch|release|product|feature|update|platform|app|tool|service|ai\s+(?:powered|driven))\b/i,
  ],
  partnership: [
    /\b(?:partner|collaborat|alliance|team(?:s|ed)\s+up|join(?:s|ed)\s+(?:forces|hands))\b/i,
  ],
  ma: [
    /\b(?:acquir|merger|bought|takeover|acquisition|merge[ds]?)\b/i,
  ],
  workforce: [
    /\b(?:layoff|laid\s+off|fire[ds]?|restructur|downsize|cut(?:s|ting)\s+(?:jobs|staff|workforce)|rif\b)\b/i,
  ],
  leadership: [
    /\b(?:CEO|CTO|CFO|COO|CPO|CMO|founder|co-?founder|board|director|executive)\b/i,
  ],
  ipo: [
    /\b(?:ipo|initial\s+public|listing|drhp|public\s+offering|stock\s+market\s+debut)\b/i,
  ],
};

// ─── Currency Conversion Approximations ────────────────────────────────
export const CURRENCY_MULTIPLIERS = {
  usd: 1,
  inr: 0.012,
  eur: 1.08,
  gbp: 1.27,
  sgd: 0.74,
  aed: 0.27,
  jpy: 0.0067,
  cny: 0.14,
  krw: 0.00074,
};

export const AMOUNT_MULTIPLIERS = {
  k: 1_000,
  thousand: 1_000,
  lakh: 100_000,
  lk: 100_000,
  million: 1_000_000,
  mn: 1_000_000,
  m: 1_000_000,
  crore: 10_000_000,
  cr: 10_000_000,
  billion: 1_000_000_000,
  bn: 1_000_000_000,
  b: 1_000_000_000,
};

/**
 * Get all sources, optionally filtered by region and type.
 */
export function getAllSources({ region, type } = {}) {
  let sources = [
    ...RSS_SOURCES.map(s => ({ ...s, sourceType: 'rss' })),
    ...API_SOURCES.map(s => ({ ...s, sourceType: 'api' })),
    ...WEB_SOURCES.map(s => ({ ...s, sourceType: 'web' })),
    ...AI_SOURCES.map(s => ({ ...s, sourceType: 'ai' })),
  ];

  if (region) {
    sources = sources.filter(s => s.region === region || s.region === 'both');
  }
  if (type) {
    sources = sources.filter(s => s.sourceType === type);
  }

  return sources;
}

/**
 * Parse a funding amount string into a normalized USD value.
 */
export function parseAmount(amountStr, currency = 'usd') {
  if (!amountStr) return null;

  const cleaned = String(amountStr).replace(/[,\s]/g, '');
  const match = cleaned.match(/([\d.]+)\s*(million|mn|m|billion|bn|b|thousand|k|crore|cr|lakh|lk)?/i);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase();
  const multiplier = AMOUNT_MULTIPLIERS[unit] || 1;
  const currencyMultiplier = CURRENCY_MULTIPLIERS[currency.toLowerCase()] || 1;

  return Math.round(num * multiplier * currencyMultiplier);
}

/**
 * Normalize a round type string to our canonical enum.
 */
export function normalizeRoundType(roundStr) {
  if (!roundStr) return 'undisclosed';
  const cleaned = roundStr.toLowerCase().replace(/\s+/g, '-').trim();

  const mapping = {
    'pre-seed': 'pre-seed',
    'preseed': 'pre-seed',
    'seed': 'seed',
    'angel': 'angel',
    'series-a': 'series-a',
    'series-b': 'series-b',
    'series-c': 'series-c',
    'series-d': 'series-d',
    'series-e': 'series-e',
    'series-f': 'series-f',
    'series-g': 'series-g',
    'series-h': 'series-h',
    'bridge': 'bridge',
    'debt': 'debt',
    'debt-financing': 'debt',
    'convertible-note': 'convertible-note',
    'ipo': 'ipo',
    'pre-ipo': 'pre-ipo',
    'post-ipo': 'post-ipo',
    'strategic': 'strategic',
    'equity-crowdfunding': 'equity-crowdfunding',
    'secondary': 'secondary',
    'grant': 'grant',
  };

  for (const [key, value] of Object.entries(mapping)) {
    if (cleaned.includes(key)) return value;
  }
  return 'undisclosed';
}
