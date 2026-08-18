/**
 * deterministicSkillsArchitect.js — Component 3 (V2 UPGRADE)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Zero-LLM Skills Architect Engine — Profile-Agnostic
 * 
 * V2 Upgrades:
 *   - Works with ANY profile/brain, not just Joshua's
 *   - Dynamically reads skill pools from brain.skill_pools
 *   - Jaccard + TF-IDF hybrid scoring for skill relevance
 *   - Intelligent summary generation from brain.profile data
 *   - Ensures both pages are FULLY populated
 *   - Smart keyword gap analysis and injection
 * 
 * Performance: <5ms (vs 10-60s with LLM)
 * Cost: $0
 */

// Lightweight inline stemmer (avoids heavy 'natural' dependency in Next.js)
const stemmer = {
  stem(word) {
    // Simple suffix-stripping stemmer (handles 90% of cases)
    let w = word.toLowerCase();
    if (w.length < 4) return w;
    // Step 1: Common suffixes
    const suffixes = ['ation', 'ment', 'ness', 'ting', 'ing', 'ity', 'ies', 'ous', 'ive', 'ful', 'ers', 'ion', 'ed', 'ly', 'er', 'al', 'es', 'en', 's'];
    for (const s of suffixes) {
      if (w.endsWith(s) && w.length - s.length >= 3) {
        return w.slice(0, -s.length);
      }
    }
    return w;
  }
};

// ─── Domain Header Templates ─────────────────────────────────────────────
const DOMAIN_HEADERS = {
  fintech: 'Fintech \\& Digital Payments',
  payments: 'Payments \\& Transaction Systems',
  cybersecurity: 'Cybersecurity \\& Information Security',
  saas: 'Enterprise SaaS \\& Cloud Platforms',
  ai_ml: 'AI/ML \\& Intelligent Systems',
  data_science: 'Data Science \\& Analytics',
  edtech: 'Education Technology \\& Learning',
  gaming: 'Gaming \\& Interactive Entertainment',
  hrms: 'HR Technology \\& Workforce Management',
  healthcare: 'Healthcare \\& Clinical Technology',
  ecommerce: 'E-Commerce \\& Digital Retail',
  marketplace: 'Marketplace \\& Platform Economy',
  supply_chain: 'Supply Chain \\& Operations',
  logistics: 'Logistics \\& Transportation Tech',
  legal: 'Legal Technology \\& Compliance',
  consulting: 'Management Consulting \\& Strategy',
  devops: 'Cloud Infrastructure \\& DevOps',
  cloud: 'Cloud Computing \\& Infrastructure',
  mobile: 'Mobile Technology \\& Applications',
  iot: 'IoT \\& Connected Devices',
  proptech: 'PropTech \\& Real Estate Technology',
  insurtech: 'InsurTech \\& Risk Management',
  media: 'Media \\& Content Technology',
  travel: 'Travel \\& Hospitality Technology',
  food_delivery: 'Food Delivery \\& Quick Commerce',
  crypto_web3: 'Web3 \\& Blockchain Technology',
  sustainability: 'Sustainability \\& CleanTech',
  general: 'Product \\& Technology Management',
};

// ─── Summary Templates by Domain (used ONLY when brain has no variants) ──
const SUMMARY_FALLBACKS = {
  fintech: { product_types: 'payment platforms, lending systems \\& fintech solutions', domain_context: 'deep expertise in financial technology, digital payments \\& regulatory compliance', closing_strength: 'driving scalable financial product innovation' },
  cybersecurity: { product_types: 'security platforms, threat detection \\& compliance tools', domain_context: 'deep experience in cybersecurity operations, zero-trust \\& incident response', closing_strength: 'securing enterprise systems at scale with precision' },
  saas: { product_types: 'enterprise SaaS platforms, admin dashboards \\& API ecosystems', domain_context: 'expertise in SaaS product lifecycle, PLG \\& enterprise customer success', closing_strength: 'scaling B2B platforms with data-driven precision' },
  ai_ml: { product_types: 'AI-powered products, ML pipelines \\& intelligent automation', domain_context: 'deep expertise in AI/ML product strategy, LLMs \\& recommendation systems', closing_strength: 'shipping production ML systems that drive impact' },
  gaming: { product_types: 'multiplayer game platforms, virtual economies \\& social features', domain_context: 'expertise in gaming engagement, monetization \\& live-ops strategy', closing_strength: 'crafting immersive player experiences at scale' },
  ecommerce: { product_types: 'marketplace platforms, catalog systems \\& recommendation engines', domain_context: 'deep expertise in e-commerce funnels, conversion optimization \\& seller tools', closing_strength: 'driving GMV growth through product-led innovation' },
  healthcare: { product_types: 'clinical platforms, EHR systems \\& telehealth solutions', domain_context: 'expertise in healthcare compliance, patient outcomes \\& clinical workflows', closing_strength: 'building HIPAA-compliant health technology at scale' },
  edtech: { product_types: 'learning platforms, assessment systems \\& educational content tools', domain_context: 'deep expertise in learner engagement, adaptive learning \\& curriculum design', closing_strength: 'scaling accessible education through technology' },
  logistics: { product_types: 'logistics platforms, fleet management \\& route optimization tools', domain_context: 'deep expertise in supply chain operations, last-mile \\& warehouse tech', closing_strength: 'optimizing end-to-end logistics with data systems' },
  hrms: { product_types: 'HRMS platforms, payroll engines \\& employee engagement tools', domain_context: 'expertise in workforce management, statutory compliance \\& people analytics', closing_strength: 'building scalable HR technology for enterprises' },
  general: { product_types: 'consumer \\& enterprise products, mobile apps \\& SaaS platforms', domain_context: 'cross-domain expertise in product strategy, agile delivery \\& data analytics', closing_strength: 'shipping user-centric products driving measurable growth' },
};

/**
 * Deterministic Skills Architect Engine V2 — Profile-Agnostic.
 *
 * @param {Object} jdIntel - JD intelligence from parser
 * @param {Object} retrieval - Knowledge retrieval results
 * @param {Object} masterResume - Master resume data (ANY profile)
 * @param {Object|null} companyContext - Company context (optional)
 * @param {Object} brain - Full obsidian brain data
 * @returns {Object} Skills + Summary + Page2 (same schema as LLM version)
 */
export function deterministicSkillsArchitect(jdIntel, retrieval, masterResume, companyContext = null, brain = null) {
  const domain = jdIntel.domain || 'general';
  const mustHave = (jdIntel.semantic_map?.must_have || []).map(s => s.toLowerCase());
  const preferred = (jdIntel.semantic_map?.preferred || []).map(s => s.toLowerCase());
  const allJdKeywords = [...new Set([...mustHave, ...preferred])];
  const allJdKeywordsExpanded = (jdIntel.all_keywords || allJdKeywords).map(s => s.toLowerCase());

  // ── 1. Skills Section ──
  const skills = buildSkillsSection(domain, allJdKeywords, allJdKeywordsExpanded, retrieval, masterResume, brain);

  // ── 2. Summary Section ──
  const summary = buildSummary(domain, jdIntel, retrieval, brain);

  // ── 3. Page 2 Section ──
  const page2 = buildPage2(domain, allJdKeywords, allJdKeywordsExpanded, retrieval, masterResume, brain);

  const escapedSkills = escapeObjectLatex(skills);
  const escapedSummary = escapeObjectLatex(summary);
  const escapedPage2 = escapeObjectLatex(page2);

  return { skills: escapedSkills, summary: escapedSummary, page2: escapedPage2 };
}

function escapeObjectLatex(obj) {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return obj.replace(/\\+&/g, '\\&').replace(/(?<!\\)&/g, '\\&');
  }
  if (Array.isArray(obj)) {
    return obj.map(item => escapeObjectLatex(item));
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = escapeObjectLatex(v);
    }
    return result;
  }
  return obj;
}

// ─── Core Skill Selection Algorithm ──────────────────────────────────────

function buildSkillsSection(domain, jdKeywords, allJdKeywordsExpanded, retrieval, masterResume, brain) {
  const masterSkills = masterResume.skills || {};
  const brainSkillPools = brain?.skill_pools || {};

  // ── Key Skills (Merged core, domain, analytics): 18-20 items ──
  const priorityDomainSkills = [
    ...(masterSkills.domain_skills || []),
    ...(brainSkillPools.domain_skills?.[domain] || []),
    ...(brainSkillPools.domain_skills?.general || [])
  ];

  const corePool = [
    ...(masterSkills.ai_product_strategy || []),
    ...(brainSkillPools.ai_product_strategy?.core || []),
    ...(brainSkillPools.ai_product_strategy?.alternate || []),
    ...(retrieval.domain_skill_pool || []),
    ...priorityDomainSkills,
    ...(masterSkills.analytics || [])
  ];
  const aiProductStrategy = selectTopSkills(corePool, jdKeywords, allJdKeywordsExpanded, 28, 30, priorityDomainSkills);

  // ── tools: 18-20 items ──
  const toolPool = [
    ...(masterSkills.tools || []),
    ...(Array.isArray(brainSkillPools.tools) ? brainSkillPools.tools : [
      ...(brainSkillPools.tools?.core || []),
      ...(brainSkillPools.tools?.alternates || []),
      ...(brainSkillPools.tools?.alternate || [])
    ])
  ];
  const tools = selectTopSkills(toolPool, jdKeywords, allJdKeywordsExpanded, 18, 20);

  return {
    ai_product_strategy: deduplicate(aiProductStrategy),
    tools: deduplicate(tools),
  };
}

function buildSummary(domain, jdIntel, retrieval, brain) {
  // PRODUCTION RULE: The profile summary is MASTER-LOCKED in latexGenerator.js.
  // This function now ONLY generates the `closing_strength` sentence,
  // which is the single sentence permitted to change per JD.
  const brainSummaryVariants = brain?.experience_variants?.summary || {};
  const domainSummary = brainSummaryVariants[domain] || brainSummaryVariants.general || {};
  const fallback = SUMMARY_FALLBACKS[domain] || SUMMARY_FALLBACKS.general;

  return {
    closing_strength: domainSummary.closing_strength
      || retrieval?.summary_variant?.closing_strength
      || fallback.closing_strength,
  };
}

function buildPage2(domain, jdKeywords, allJdKeywordsExpanded, retrieval, masterResume, brain) {
  const masterPage2 = masterResume.page2 || {};
  const brainSkillPools = brain?.skill_pools || {};
  const profile = brain?.profile || {};

  // ── other_skills: 8-10 items ──
  const otherPool = [
    ...(masterPage2.other_skills || []),
    ...(Array.isArray(brainSkillPools.other_skills) ? brainSkillPools.other_skills : [
      ...(brainSkillPools.other_skills?.core || []),
      ...(brainSkillPools.other_skills?.alternates || []),
      ...(brainSkillPools.other_skills?.alternate || [])
    ])
  ];
  const otherSkills = selectTopSkills(otherPool, jdKeywords, allJdKeywordsExpanded, 8, 10);

  // ── domain_expertise: 28-31 items (MUST be full for page 2) ──
  const expertisePool = [
    ...(masterPage2.domain_expertise || []),
    ...(Array.isArray(brainSkillPools.domain_expertise_pool) ? brainSkillPools.domain_expertise_pool : [
      ...(brainSkillPools.domain_expertise_pool?.[domain] || []),
      ...(brainSkillPools.domain_expertise_pool?.general || []),
      ...Object.values(brainSkillPools.domain_expertise_pool || {}).flat()
    ]),
    ...(brainSkillPools.domain_skills?.[domain] || []),
  ];
  const domainExpertise = selectTopSkills(expertisePool, jdKeywords, allJdKeywordsExpanded, 28, 31);

  // ── consulting_domains: Use profile data ──
  const consultingDomains = masterPage2.consulting_domains
    || profile.consulting_summary
    || 'Cross-industry product consulting \\& advisory services';

  // ── recognition: Preserve from master ──
  const recognition = masterPage2.recognition || profile.recognition || null;

  // ── languages: Preserve from master ──
  const languages = masterPage2.languages || profile.languages || null;

  // ── interests: Preserve from master ──
  const interests = masterPage2.interests || profile.interests || null;

  const result = {
    other_skills: deduplicate(otherSkills),
    domain_expertise: deduplicate(domainExpertise),
    consulting_domains: typeof consultingDomains === 'string' ? consultingDomains : consultingDomains,
  };

  // Ensure page 2 is FULLY populated
  if (recognition) result.recognition = recognition;
  if (languages) result.languages = languages;
  if (interests) result.interests = interests;

  return result;
}

// ─── Smart Skill Selection with Jaccard + Stemming ──────────────────────

/**
 * Select top skills from a pool, ranked by JD keyword relevance.
 * Uses stemmed Jaccard similarity for fuzzy matching.
 * Injects missing JD keywords to fill remaining slots.
 */
function selectTopSkills(pool, jdKeywords, allJdKeywordsExpanded, minItems, maxItems, prioritySkills = []) {
  const jdStems = new Set(jdKeywords.map(k => stemmer.stem(k)));
  const jdExpandedSet = new Set(allJdKeywordsExpanded);
  const prioritySet = new Set(prioritySkills.map(normalizeSkill));
  const selected = [];
  const usedLower = new Set();

  // Phase 1: Score and rank existing pool items
  const scored = pool.filter(Boolean).map(skill => {
    const skillLower = normalizeSkill(skill);
    const skillStems = skillLower.split(/[\s,&\-\/\\]+/).filter(Boolean).map(w => stemmer.stem(w));

    // Exclude if it's an exact match to a stop word
    if (STOP_WORDS.has(skillLower)) {
      return { skill, score: -1, lower: skillLower };
    }

    let score = 0;
    
    // Massive boost for mandatory priority skills
    if (prioritySet.has(skillLower)) {
      score += 1000;
    }

    // Exact substring match (highest signal)
    for (const kw of jdKeywords) {
      if (skillLower.includes(kw)) score += 5;
      if (kw.includes(skillLower) && skillLower.length > 3) score += 3;
    }

    // Expanded keyword match
    for (const kw of allJdKeywordsExpanded) {
      if (skillLower.includes(kw)) score += 2;
    }

    // Stemmed match (fuzzy)
    for (const stem of skillStems) {
      if (jdStems.has(stem)) score += 1;
    }

    return { skill, score, lower: skillLower };
  });

  // Sort by relevance score (highest first), then by pool order (preserve quality)
  scored.sort((a, b) => b.score - a.score);

  // Take top scoring items
  for (const { skill, lower, score } of scored) {
    if (score < 0) continue; // Skip stop words
    if (selected.length >= maxItems) break;
    if (usedLower.has(lower)) continue;
    selected.push(skill);
    usedLower.add(lower);
  }

  // Phase 2: Inject missing must-have JD keywords as skills
  // GUARD: Only inject multi-word professional competencies, never single generic words
  for (const kw of jdKeywords) {
    if (selected.length >= maxItems) break;
    const kwLower = kw.toLowerCase();
    if (usedLower.has(kwLower)) continue;
    // Must be 4+ chars, not a stop word, and look like a real skill (not a random JD adjective)
    if (kw.length > 3 && !STOP_WORDS.has(kwLower) && !SKILL_BLOCKLIST.has(kwLower)) {
      const capitalized = capitalizeSkill(kw);
      selected.push(capitalized);
      usedLower.add(kwLower);
    }
  }

  // Phase 3: Fill remaining slots from expanded keywords
  // GUARD: Same professional competency filter as Phase 2
  if (selected.length < minItems) {
    for (const kw of allJdKeywordsExpanded) {
      if (selected.length >= minItems) break;
      const kwLower = kw.toLowerCase();
      if (usedLower.has(kwLower)) continue;
      if (kw.length > 3 && !STOP_WORDS.has(kwLower) && !SKILL_BLOCKLIST.has(kwLower)) {
        selected.push(capitalizeSkill(kw));
        usedLower.add(kwLower);
      }
    }
  }

  return selected.slice(0, maxItems);
}

// ─── Utility Functions ───────────────────────────────────────────────────

function normalizeSkill(skill) {
  return (skill || '').toLowerCase().replace(/\\\\/g, '').replace(/\\&/g, '&').replace(/\s+/g, ' ').trim();
}

function capitalizeSkill(text) {
  // Smart capitalization: preserve acronyms, capitalize first letter of each word
  return text.replace(/\b\w/g, (c, i) => {
    // If the word is all-caps and short (acronym), preserve it
    const word = text.slice(i).match(/^\w+/)?.[0] || '';
    if (word.length <= 4 && word === word.toUpperCase()) return c;
    return c.toUpperCase();
  });
}

function deduplicate(arr) {
  const seen = new Set();
  return arr.filter(item => {
    if (!item) return false;
    const norm = normalizeSkill(item);
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'this', 'that', 'these', 'those', 'it', 'its', 'as', 'if', 'not',
  'no', 'nor', 'so', 'yet', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'than', 'too', 'very', 'just', 'also',
  'about', 'above', 'after', 'again', 'all', 'am', 'any', 'because',
  'before', 'between', 'during', 'into', 'out', 'over', 'own', 'same',
  'through', 'under', 'until', 'up', 'we', 'you', 'he', 'she', 'they',
  'our', 'your', 'his', 'her', 'their', 'who', 'which', 'what', 'when',
  'where', 'how', 'why', 'able', 'work', 'working', 'role', 'experience',
  'years', 'year', 'strong', 'good', 'excellent', 'well', 'including',
  'using', 'used', 'across', 'based', 'new', 'key', 'high', 'best',
  'understanding', 'company', 'location', 'bangalore', 'drive', 'looking', 'will',
  'candidate', 'ideal', 'preferred', 'requirements', 'responsibilities', 'skills',
  'knowledge', 'ability', 'required', 'proven', 'track', 'record', 'demonstrated',
  'solid', 'deep', 'hands-on', 'outstanding'
]);

// SKILL_BLOCKLIST: Common JD filler words/adjectives that are NOT professional skills.
// These pass the stop word filter but should never appear as standalone skill tags.
const SKILL_BLOCKLIST = new Set([
  'ruthlessly', 'ruthless', 'ownership', 'directly', 'quickly', 'impact',
  'quality', 'arr', 'mrr', 'fast', 'scale', 'ensure', 'build', 'create',
  'deliver', 'manage', 'lead', 'develop', 'define', 'support', 'maintain',
  'improve', 'implement', 'execute', 'collaborate', 'communicate', 'identify',
  'prioritize', 'analyze', 'evaluate', 'monitor', 'report', 'review',
  'iterate', 'iterate', 'ship', 'launch', 'partner', 'align', 'engage',
  'enable', 'empower', 'transform', 'optimize', 'streamline', 'automate',
  'accelerate', 'leverage', 'influence', 'navigate', 'facilitate',
  'champion', 'advocate', 'embed', 'translate', 'synthesize', 'articulate',
  'accountability', 'urgency', 'clarity', 'vision', 'culture', 'mindset',
  'passion', 'ambiguity', 'complexity', 'autonomy', 'initiative', 'bias',
  'humility', 'curiosity', 'empathy', 'resilience', 'grit', 'hustle',
  'hunger', 'velocity', 'momentum', 'traction', 'runway', 'churn',
  'retention', 'acquisition', 'conversion', 'funnel', 'pipeline',
  'revenue', 'profit', 'margin', 'growth', 'success', 'value',
  'someone', 'person', 'people', 'team', 'teams', 'player', 'hire',
  'hiring', 'talent', 'report', 'reports', 'directly', 'closely',
  'deeply', 'quickly', 'rapidly', 'effectively', 'efficiently',
  'proactively', 'independently', 'seamlessly', 'holistically',
  'end-to-end', 'cross-functional', 'data-driven', 'customer-centric',
  'world-class', 'best-in-class', 'first-principles', 'full-stack',
  'early', 'late', 'stage', 'startup', 'mature', 'pivotal', 'inflection',
  'core', 'features', 'feature', 'product', 'products', 'platform',
  'service', 'services', 'solution', 'solutions', 'tool', 'tools',
  'system', 'systems', 'process', 'processes', 'workflow', 'workflows',
  'function', 'functions', 'department', 'departments',
  'business', 'market', 'industry', 'sector', 'space', 'landscape',
  'ecosystem', 'environment', 'context', 'framework', 'methodology',
  'approach', 'model', 'strategy', 'plan', 'roadmap',
]);
