/**
 * NGramTokenizer.js — Structural N-Gram Tokenization Engine
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Phase 2, Step 2 of the Get My Job Retrieval Engine v4 Blueprint.
 *
 * Extracts structural unigrams, bigrams, and trigrams while preserving
 * compound concepts like "machine_learning", "go_to_market", "product_manager".
 *
 * Also handles:
 *   - Acronym resolution (bidirectional: UPI ↔ unified payments interface)
 *   - Domain-aware stop word filtering
 *   - Porter stemming (configurable)
 *   - Phrase detection for known collocations
 */

import natural from 'natural';

const WordTokenizer = natural.WordTokenizer;
const PorterStemmer = natural.PorterStemmer;
const NGrams = natural.NGrams;
const tokenizer = new WordTokenizer();

// ─── Acronym Map (Bidirectional) ──────────────────────────────────────────
const ACRONYM_MAP = {
  'UPI': 'unified payments interface',
  'KYC': 'know your customer',
  'AML': 'anti money laundering',
  'GTM': 'go to market',
  'PLG': 'product led growth',
  'SLG': 'sales led growth',
  'PRD': 'product requirements document',
  'BRD': 'business requirements document',
  'OKR': 'objectives and key results',
  'KPI': 'key performance indicator',
  'EASM': 'external attack surface management',
  'RBAC': 'role based access control',
  'CIBIL': 'credit information bureau india limited',
  'NPS': 'net promoter score',
  'CSAT': 'customer satisfaction score',
  'MRR': 'monthly recurring revenue',
  'ARR': 'annual recurring revenue',
  'CAC': 'customer acquisition cost',
  'LTV': 'lifetime value',
  'CLV': 'customer lifetime value',
  'PMF': 'product market fit',
  'MVP': 'minimum viable product',
  'POC': 'proof of concept',
  'API': 'application programming interface',
  'SDK': 'software development kit',
  'CI/CD': 'continuous integration continuous deployment',
  'SRE': 'site reliability engineering',
  'IAM': 'identity and access management',
  'SSO': 'single sign on',
  'SAML': 'security assertion markup language',
  'JWT': 'json web token',
  'REST': 'representational state transfer',
  'CRUD': 'create read update delete',
  'ORM': 'object relational mapping',
  'ETL': 'extract transform load',
  'ELT': 'extract load transform',
  'SIEM': 'security information event management',
  'SOAR': 'security orchestration automation response',
  'SOC': 'security operations center',
  'WAF': 'web application firewall',
  'CDN': 'content delivery network',
  'DNS': 'domain name system',
  'VPC': 'virtual private cloud',
  'EHR': 'electronic health records',
  'EMR': 'electronic medical records',
  'HIPAA': 'health insurance portability accountability act',
  'GDPR': 'general data protection regulation',
  'PCI': 'payment card industry',
  'DSS': 'data security standard',
  'LMS': 'learning management system',
  'CRM': 'customer relationship management',
  'ERP': 'enterprise resource planning',
  'HRIS': 'human resource information system',
  'ATS': 'applicant tracking system',
  'LOS': 'loan origination system',
  'EMI': 'equated monthly installment',
  'NFC': 'near field communication',
  'IoT': 'internet of things',
  'AI': 'artificial intelligence',
  'ML': 'machine learning',
  'NLP': 'natural language processing',
  'LLM': 'large language model',
  'RAG': 'retrieval augmented generation',
  'CNN': 'convolutional neural network',
  'RNN': 'recurrent neural network',
  'GAN': 'generative adversarial network',
  'RL': 'reinforcement learning',
  'RLHF': 'reinforcement learning human feedback',
  'SEO': 'search engine optimization',
  'SEM': 'search engine marketing',
  'PPC': 'pay per click',
  'CRO': 'conversion rate optimization',
  'ABM': 'account based marketing',
  'DTC': 'direct to consumer',
  'D2C': 'direct to consumer',
  'B2B': 'business to business',
  'B2C': 'business to consumer',
  'B2B2C': 'business to business to consumer',
  'SaaS': 'software as a service',
  'PaaS': 'platform as a service',
  'IaaS': 'infrastructure as a service',
  'DaaS': 'data as a service',
  'RICE': 'reach impact confidence effort',
  'SAFE': 'scaled agile framework',
  'TDD': 'test driven development',
  'BDD': 'behavior driven development',
  'DDD': 'domain driven design',
  'CQRS': 'command query responsibility segregation',
  'RPA': 'robotic process automation',
  'BI': 'business intelligence',
  'DAU': 'daily active users',
  'MAU': 'monthly active users',
  'WAU': 'weekly active users',
  'GMV': 'gross merchandise value',
  'AOV': 'average order value',
  'ARPU': 'average revenue per user',
  'ROAS': 'return on ad spend',
  'ROI': 'return on investment',
  'TAM': 'total addressable market',
  'SAM': 'serviceable addressable market',
  'SOM': 'serviceable obtainable market',
  'P&L': 'profit and loss',
  'EBITDA': 'earnings before interest taxes depreciation amortization',
};

// Build reverse map for expansion lookup
const _acronymLookup = new Map();
const _expansionLookup = new Map();
for (const [acronym, expansion] of Object.entries(ACRONYM_MAP)) {
  _acronymLookup.set(acronym.toLowerCase(), expansion);
  _expansionLookup.set(expansion, acronym.toLowerCase());
}

// ─── Domain-Aware Stop Words ──────────────────────────────────────────────
const GLOBAL_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'that', 'this',
  'these', 'those', 'it', 'its', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'all', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
  'only', 'same', 'so', 'than', 'too', 'very', 'just', 'about', 'up',
  'down', 'also', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
  'she', 'they', 'them', 'their', 'who', 'whom', 'which', 'what', 'when',
  'where', 'how', 'why', 'if', 'while', 'because', 'although', 'since',
  'until', 'unless', 'however', 'therefore', 'thus', 'hence', 'yet',
  'still', 'already', 'even', 'much', 'many', 'several', 'well', 'here',
  'there', 'now', 'then', 'often', 'never', 'always', 'sometimes',
]);

const DOMAIN_STOPWORDS = {
  engineering: new Set(['built', 'developed', 'created', 'system', 'platform', 'application', 'app', 'using', 'based', 'across', 'including']),
  product: new Set(['product', 'feature', 'user', 'experience', 'management', 'platform', 'solution', 'tool']),
  general: new Set(['designed', 'implemented', 'developed', 'built', 'created', 'managed', 'worked', 'used']),
};

// ─── Known Collocations (Phrases That Must Stay Together) ─────────────────
const KNOWN_PHRASES = new Set([
  'machine_learning', 'deep_learning', 'natural_language', 'computer_vision',
  'go_to_market', 'product_manager', 'product_management', 'project_management',
  'data_science', 'data_engineering', 'data_analytics', 'data_visualization',
  'user_experience', 'user_interface', 'user_research', 'user_story',
  'a_b_testing', 'cross_functional', 'full_stack', 'front_end', 'back_end',
  'real_time', 'open_source', 'cloud_computing', 'supply_chain',
  'due_diligence', 'digital_transformation', 'customer_success',
  'revenue_growth', 'market_research', 'competitive_analysis',
  'product_led', 'sales_led', 'product_market_fit', 'total_addressable_market',
  'net_promoter_score', 'customer_acquisition', 'customer_retention',
  'artificial_intelligence', 'large_language', 'language_model',
  'neural_network', 'reinforcement_learning', 'transfer_learning',
  'attention_mechanism', 'prompt_engineering', 'retrieval_augmented',
  'generative_ai', 'edge_computing', 'internet_of_things',
  'zero_trust', 'penetration_testing', 'threat_intelligence',
  'incident_response', 'security_operations', 'attack_surface',
  'payment_gateway', 'payment_processing', 'payment_infrastructure',
  'loan_origination', 'credit_scoring', 'risk_management',
  'fraud_detection', 'identity_verification', 'anti_money',
  'money_laundering', 'know_your_customer', 'regulatory_compliance',
  'sprint_planning', 'sprint_review', 'release_management',
  'stakeholder_management', 'change_management', 'performance_management',
  'talent_acquisition', 'employer_branding', 'employee_engagement',
  'unit_testing', 'integration_testing', 'test_automation',
  'continuous_integration', 'continuous_deployment', 'infrastructure_as_code',
  'site_reliability', 'load_balancing', 'auto_scaling', 'high_availability',
  'design_system', 'design_thinking', 'interaction_design', 'motion_design',
  'information_architecture', 'content_strategy', 'usability_testing',
]);

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full tokenization pipeline: text → structured tokens ready for indexing.
 *
 * @param {string} text - Raw text to tokenize
 * @param {Object} [options]
 * @param {boolean} [options.stem=true] - Apply Porter stemming
 * @param {string} [options.domain='general'] - Domain for stopword filtering
 * @param {boolean} [options.expandAcronyms=true] - Expand acronyms inline
 * @param {boolean} [options.includeNGrams=true] - Generate bigrams and trigrams
 * @returns {string[]} Array of processed tokens
 */
export function tokenize(text, options = {}) {
  const {
    stem = true,
    domain = 'general',
    expandAcronyms = true,
    includeNGrams = true,
  } = options;

  if (!text || typeof text !== 'string') return [];

  let processed = text.toLowerCase();

  // Normalize hyphens and special chars to spaces (but keep acronyms)
  processed = processed.replace(/[-_/]/g, ' ');

  // Expand acronyms inline (so "UPI" becomes "UPI unified payments interface")
  if (expandAcronyms) {
    processed = _expandAcronymsInText(processed);
  }

  // Tokenize
  let tokens = tokenizer.tokenize(processed);
  if (!tokens || tokens.length === 0) return [];

  // Generate N-Grams BEFORE stopword removal to preserve compounds like
  // "go_to_market", "internet_of_things", "know_your_customer"
  let ngrams = [];
  if (includeNGrams) {
    // Use raw tokens (with stopwords intact) for ngram generation
    const rawForNgrams = tokens.filter((t) => t.length > 1);
    const bigrams = NGrams.bigrams(rawForNgrams).map((b) => b.join('_'));
    const trigrams = NGrams.trigrams(rawForNgrams).map((t) => t.join('_'));

    ngrams = [...bigrams, ...trigrams].filter((ng) => {
      if (KNOWN_PHRASES.has(ng)) return true;
      const parts = ng.split('_');
      const significantParts = parts.filter((p) => p.length > 3 && !GLOBAL_STOPWORDS.has(p));
      return significantParts.length >= 2;
    });
  }

  // NOW filter stop words from unigrams (after ngrams are generated)
  const stopwords = _getStopwords(domain);
  tokens = tokens.filter((t) => t.length > 1 && !stopwords.has(t));

  // Stem unigrams
  if (stem) {
    tokens = tokens.map((t) => PorterStemmer.stem(t));
  }

  // Combine unigrams + filtered ngrams
  return [...tokens, ...ngrams];
}

/**
 * Tokenize a document with field-level separation.
 * Returns an object mapping field names to their token arrays.
 *
 * @param {Object} doc - Document with fields (title, subtitle, bullets, tags, etc.)
 * @param {Object} [options] - Same options as tokenize()
 * @returns {Object<string, string[]>}
 */
export function tokenizeDocument(doc, options = {}) {
  const fields = {};

  if (doc.name || doc.title) {
    fields.title = tokenize(doc.name || doc.title, { ...options, stem: false });
  }
  if (doc.subtitle || doc.one_liner) {
    fields.subtitle = tokenize(doc.subtitle || doc.one_liner, options);
  }
  if (doc.bullets && Array.isArray(doc.bullets)) {
    fields.bullets = tokenize(doc.bullets.join(' '), options);
  }
  if (doc.tags && Array.isArray(doc.tags)) {
    // Tags are exact-match; no stemming, no ngrams
    fields.tags = doc.tags.map((t) => t.toLowerCase().replace(/^#/, ''));
  }
  if (doc.domains && Array.isArray(doc.domains)) {
    fields.domains = doc.domains.map((d) => d.toLowerCase());
  }
  if (doc.technologies && Array.isArray(doc.technologies)) {
    fields.technologies = doc.technologies.map((t) => t.toLowerCase());
  }
  if (doc.kpis && Array.isArray(doc.kpis)) {
    fields.kpis = tokenize(doc.kpis.join(' '), options);
  }
  if (doc.pitch) {
    fields.full_text = tokenize(doc.pitch + ' ' + (doc.usp || '') + ' ' + (doc.features || ''), options);
  }

  return fields;
}

/**
 * Tokenize a query (JD text or search query).
 * Queries get acronym expansion but lighter stopword filtering.
 *
 * @param {string} queryText
 * @param {Object} [options]
 * @returns {string[]}
 */
export function tokenizeQuery(queryText, options = {}) {
  return tokenize(queryText, {
    stem: true,
    domain: 'general',
    expandAcronyms: true,
    includeNGrams: true,
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════

function _expandAcronymsInText(text) {
  // Find standalone acronyms (2-6 uppercase letters) and append their expansion
  return text.replace(/\b([a-z]{2,8})\b/g, (match) => {
    const expansion = _acronymLookup.get(match);
    if (expansion) {
      return `${match} ${expansion}`;
    }
    return match;
  });
}

function _getStopwords(domain) {
  const combined = new Set(GLOBAL_STOPWORDS);
  const domainStops = DOMAIN_STOPWORDS[domain] || DOMAIN_STOPWORDS.general;
  if (domainStops) {
    for (const word of domainStops) {
      combined.add(word);
    }
  }
  return combined;
}

// ─── Exports ──────────────────────────────────────────────────────────────
export { ACRONYM_MAP, KNOWN_PHRASES, GLOBAL_STOPWORDS, DOMAIN_STOPWORDS };
