/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║       JD REQUIREMENT GRAPH — Priority Classification & Clustering     ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Takes deterministic mining output + LLM semantic analysis and        ║
 * ║  produces the final weighted requirement graph with:                  ║
 * ║    • 8-tier priority classification                                    ║
 * ║    • Semantic clusters (frontend_stack, backend_infra, etc.)          ║
 * ║    • Validation (no dupes, no hallucinations, completeness check)     ║
 * ║    • Backward-compatible semantic_map for existing consumers          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIER DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TIER_DEFINITIONS = [
  { tier: 1, label: 'Critical Must-Have',   min: 0.82, max: 1.00 },
  { tier: 2, label: 'High-Impact Skill',    min: 0.68, max: 0.81 },
  { tier: 3, label: 'Core Responsibility',  min: 0.55, max: 0.67 },
  { tier: 4, label: 'Strong Preference',    min: 0.42, max: 0.54 },
  { tier: 5, label: 'Supporting Skill',     min: 0.30, max: 0.41 },
  { tier: 6, label: 'Nice-to-Have',         min: 0.20, max: 0.29 },
  { tier: 7, label: 'Contextual/Low-Impact',min: 0.10, max: 0.19 },
  { tier: 8, label: 'Ignore/Noise',         min: 0.00, max: 0.09 },
];

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC CLUSTER DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const CLUSTER_RULES = [
  { id: 'frontend_stack', keywords: ['react', 'angular', 'vue', 'javascript', 'typescript', 'html', 'css', 'next.js', 'nextjs', 'frontend', 'front-end', 'ui', 'tailwind', 'webpack', 'vite'] },
  { id: 'backend_stack', keywords: ['node', 'nodejs', 'python', 'java', 'golang', 'ruby', 'php', 'django', 'spring', 'express', 'fastapi', 'backend', 'back-end', 'rest', 'graphql', 'grpc', 'api'] },
  { id: 'data_engineering', keywords: ['sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'kafka', 'elasticsearch', 'spark', 'hadoop', 'snowflake', 'bigquery', 'databricks', 'dbt', 'etl', 'data pipeline', 'data warehouse'] },
  { id: 'cloud_infra', keywords: ['aws', 'gcp', 'azure', 'docker', 'kubernetes', 'k8s', 'terraform', 'serverless', 'lambda', 'ci/cd', 'devops', 'sre', 'monitoring', 'datadog', 'grafana'] },
  { id: 'ai_ml', keywords: ['machine learning', 'ml', 'deep learning', 'tensorflow', 'pytorch', 'nlp', 'computer vision', 'llm', 'generative ai', 'rag', 'mlops', 'ai'] },
  { id: 'product_management', keywords: ['roadmap', 'prd', 'user stories', 'backlog', 'stakeholder', 'product strategy', 'product vision', 'okr', 'kpi', 'gtm', 'product discovery', 'sprint', 'agile', 'scrum'] },
  { id: 'analytics', keywords: ['analytics', 'data analysis', 'tableau', 'power bi', 'mixpanel', 'amplitude', 'google analytics', 'cohort analysis', 'a/b testing', 'sql', 'data-driven', 'metrics'] },
  { id: 'leadership', keywords: ['leadership', 'mentoring', 'coaching', 'team building', 'hiring', 'cross-functional', 'stakeholder management', 'people management', 'executive'] },
  { id: 'security', keywords: ['cybersecurity', 'security', 'encryption', 'compliance', 'gdpr', 'hipaa', 'soc', 'penetration testing', 'owasp', 'zero trust', 'iam'] },
  { id: 'mobile', keywords: ['ios', 'android', 'swift', 'kotlin', 'react native', 'flutter', 'mobile development', 'mobile app'] },
  { id: 'design_ux', keywords: ['figma', 'sketch', 'wireframe', 'ux', 'ui', 'user experience', 'user interface', 'design system', 'accessibility', 'usability'] },
  { id: 'fintech', keywords: ['fintech', 'payments', 'upi', 'kyc', 'aml', 'banking', 'lending', 'credit', 'insurance', 'blockchain', 'defi', 'crypto', 'web3'] },
  { id: 'growth_marketing', keywords: ['growth', 'marketing', 'seo', 'sem', 'conversion', 'retention', 'cac', 'ltv', 'nps', 'a/b testing', 'content marketing', 'plg', 'demand generation'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assign priority tiers based on score ranges.
 */
function assignTiers(requirements) {
  for (const req of requirements) {
    const score = req.priority_score;
    const tierDef = TIER_DEFINITIONS.find(t => score >= t.min && score <= t.max);
    req.priority_tier = tierDef ? tierDef.tier : 7;
    req.priority_label = tierDef ? tierDef.label : 'Contextual/Low-Impact';
  }
  return requirements;
}

/**
 * Assign semantic clusters to requirements.
 */
function assignClusters(requirements) {
  for (const req of requirements) {
    const canonical = req.canonical.toLowerCase();
    const allMentions = (req.raw_mentions || []).join(' ').toLowerCase();
    const searchText = `${canonical} ${allMentions}`;

    for (const cluster of CLUSTER_RULES) {
      if (cluster.keywords.some(kw => searchText.includes(kw))) {
        req.cluster_id = cluster.id;
        break;
      }
    }
    if (!req.cluster_id) {
      req.cluster_id = req.category === 'behavioral' ? 'soft_skills' :
                        req.category === 'methodology' ? 'processes' :
                        'unclustered';
    }
  }
  return requirements;
}

/**
 * Detect relationships between requirements (co-occurrence, dependency).
 */
function detectRelationships(requirements) {
  for (let i = 0; i < requirements.length; i++) {
    const related = [];
    for (let j = 0; j < requirements.length; j++) {
      if (i === j) continue;
      // Same cluster = related
      if (requirements[i].cluster_id === requirements[j].cluster_id && 
          requirements[i].cluster_id !== 'unclustered') {
        related.push(requirements[j].id);
      }
    }
    requirements[i].related_to = related.slice(0, 5); // Cap at 5 relations
  }
  return requirements;
}

/**
 * Merge LLM-discovered hidden requirements into the graph.
 */
function mergeHiddenRequirements(requirements, llmHiddenKeywords, llmConfidence = 0.75) {
  if (!llmHiddenKeywords || !Array.isArray(llmHiddenKeywords)) return requirements;

  let maxId = requirements.length;

  for (const hidden of llmHiddenKeywords) {
    const lower = hidden.toLowerCase();
    // Check if already in graph
    const exists = requirements.some(r => 
      r.canonical === lower || r.raw_mentions.some(m => m.toLowerCase() === lower)
    );
    if (exists) continue;

    maxId++;
    requirements.push({
      id: `req_${String(maxId).padStart(3, '0')}`,
      canonical: lower,
      raw_mentions: [hidden],
      priority_score: 0.35, // Hidden requirements are Strong Preference by default
      priority_tier: 4,
      priority_label: 'Strong Preference',
      category: 'skill',
      evidence: {
        section: 'llm_inferred',
        mandatory_language: false,
        position_percentile: null,
        mention_count: 0,
        language_signals: ['implied'],
      },
      behavioral_signals: [],
      cluster_id: 'unclustered',
      related_to: [],
      confidence: llmConfidence * 0.8, // Discount LLM confidence slightly for hidden reqs
      source: 'llm_hidden',
    });
  }

  return requirements;
}

/**
 * Apply LLM confidence adjustments to override deterministic scores when semantically wrong.
 */
function applyLLMOverrides(requirements, llmResult) {
  if (!llmResult) return requirements;

  // If LLM explicitly marks something as required_skills, boost it
  const llmRequired = (llmResult.required_skills || []).map(s => s.toLowerCase());
  const llmPreferred = (llmResult.preferred_skills || []).map(s => s.toLowerCase());

  for (const req of requirements) {
    const canonical = req.canonical.toLowerCase();
    
    // LLM says required but deterministic scored low → boost
    if (llmRequired.includes(canonical) && req.priority_score < 0.68) {
      req.priority_score = Math.max(req.priority_score, 0.70);
      req.confidence = Math.min(1.0, req.confidence + 0.1);
      req.evidence.llm_override = 'boosted_to_required';
    }
    
    // LLM says preferred but deterministic scored high → adjust down slightly
    if (llmPreferred.includes(canonical) && req.priority_score > 0.75) {
      req.priority_score = Math.min(req.priority_score, 0.55);
      req.evidence.llm_override = 'adjusted_to_preferred';
    }
  }

  // Re-assign tiers after overrides
  return assignTiers(requirements);
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate the requirement graph for completeness and consistency.
 */
function validateGraph(requirements, llmResult) {
  const warnings = [];

  // 1. Check no tier 1 requirements exist (suspicious — most JDs have at least one critical skill)
  const tier1Count = requirements.filter(r => r.priority_tier === 1).length;
  if (tier1Count === 0 && requirements.length > 5) {
    // Promote the highest-scored requirement to tier 1
    const top = requirements[0];
    if (top && top.priority_score >= 0.65) {
      top.priority_score = 0.85;
      top.priority_tier = 1;
      top.priority_label = 'Critical Must-Have';
      warnings.push(`Promoted "${top.canonical}" to Critical Must-Have (no tier-1 requirements detected)`);
    }
  }

  // 2. Check for duplicate canonicals
  const seen = new Set();
  for (const req of requirements) {
    if (seen.has(req.canonical)) {
      warnings.push(`Duplicate canonical: "${req.canonical}"`);
    }
    seen.add(req.canonical);
  }

  // 3. Verify LLM required_skills are in the graph
  if (llmResult?.required_skills) {
    for (const skill of llmResult.required_skills) {
      const found = requirements.some(r => 
        r.canonical === skill.toLowerCase() || 
        r.raw_mentions.some(m => m.toLowerCase() === skill.toLowerCase())
      );
      if (!found) {
        warnings.push(`LLM-identified required skill "${skill}" not found in graph`);
      }
    }
  }

  return warnings;
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE OUTPUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate backward-compatible semantic_map from the requirement graph.
 * This allows ALL existing downstream consumers to work unchanged.
 */
function buildBackwardCompatibleMap(requirements) {
  const must_have = [];
  const preferred = [];
  const implied = [];
  const must_have_expanded = [];
  const preferred_expanded = [];
  const implied_expanded = [];

  for (const req of requirements) {
    if (req.priority_tier <= 2) {
      must_have.push(req.canonical);
      must_have_expanded.push(req.canonical, ...req.raw_mentions);
    } else if (req.priority_tier <= 5) {
      preferred.push(req.canonical);
      preferred_expanded.push(req.canonical, ...req.raw_mentions);
    } else if (req.priority_tier <= 7) {
      implied.push(req.canonical);
      implied_expanded.push(req.canonical, ...req.raw_mentions);
    }
    // Tier 8 (noise) is excluded entirely
  }

  return {
    must_have: [...new Set(must_have)],
    preferred: [...new Set(preferred)],
    implied: [...new Set(implied)],
    must_have_expanded: [...new Set(must_have_expanded)],
    preferred_expanded: [...new Set(preferred_expanded)],
    implied_expanded: [...new Set(implied_expanded)],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// NOISE FILTER — Removes common English words from requirement graph
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Common English words that TF-IDF extraction produces but are NOT real
 * professional skills or competencies. These should never appear as
 * "missing keywords" in ATS validation.
 */
const REQUIREMENT_STOP_WORDS = new Set([
  // Common English verbs/words that appear in any JD
  'work', 'working', 'will', 'build', 'building', 'create', 'creating',
  'make', 'making', 'help', 'helping', 'need', 'needs', 'join', 'joining',
  'means', 'mean', 'right', 'com', 'key', 'high', 'level', 'using',
  'looking', 'seeking', 'required', 'including', 'across', 'within',
  'ensure', 'drive', 'support', 'implement', 'develop', 'deliver',
  'manage', 'maintain', 'enable', 'provide', 'understand', 'focus',
  'define', 'identify', 'lead', 'own', 'ship', 'fast', 'translate',
  // Common English nouns/adjectives that aren't professional skills
  'overview', 'one', 'points', 'role', 'impact', 'teams', 'team',
  'company', 'culture', 'brand', 'success', 'opportunity', 'environment',
  'interaction', 'experience', 'strong', 'early', 'new', 'best', 'top',
  'world', 'global', 'information', 'knowledge', 'ability', 'skills',
  'years', 'year', 'degree', 'equivalent', 'preferred', 'minimum',
  'qualifications', 'requirements', 'responsibilities', 'benefits',
  // Company-specific words that commonly leak through
  'target', 'shopping', 'store', 'guest', 'guests',
  // Misc noise
  'quickly', 'ruthlessly', 'someone', 'without', 'features', 'founder',
  'end', 'ads', 'arr', 'kpi', 'india', 'usa', 'remote', 'hybrid',
  'onsite', 'office', 'location', 'salary', 'compensation', 'bonus',
]);

/**
 * Filter noise keywords from requirements list.
 * - Removes single-word requirements that are stop words
 * - Removes very short keywords (≤2 chars) that aren't known acronyms
 * - Demotes low-tier single-word common terms to Tier 8 (Noise)
 */
function filterNoiseRequirements(requirements) {
  const KNOWN_SHORT_ACRONYMS = new Set(['ai', 'ml', 'ux', 'ui', 'qa', 'bi', 'pm', 'ci', 'cd', 'db', 'os', 'iot']);

  return requirements.filter(req => {
    const canonical = req.canonical.toLowerCase().trim();

    // Remove very short terms that aren't known acronyms
    if (canonical.length <= 2 && !KNOWN_SHORT_ACRONYMS.has(canonical)) {
      return false;
    }

    // Remove single-word stop words
    const words = canonical.split(/\s+/);
    if (words.length === 1 && REQUIREMENT_STOP_WORDS.has(canonical)) {
      return false;
    }

    return true;
  });
}

/**
 * Post-tier cleanup: Demote surviving low-value single-word terms in Tier 5+
 * down to Tier 8 (Noise). This catches terms the stop-word list missed.
 */
function demoteWeakTier5Plus(requirements) {
  for (const req of requirements) {
    if (req.priority_tier < 5) continue; // Only target Tier 5-7
    const canonical = req.canonical.toLowerCase().trim();
    const words = canonical.split(/\s+/);

    // Single-word terms in Tier 5+ that aren't clearly technical are noise
    if (words.length === 1 && canonical.length <= 8) {
      // Check if it could be a real tech term (contains numbers, camelCase, etc.)
      const looksLikeTech = /[0-9]/.test(canonical) || /[A-Z]/.test(req.canonical.slice(1));
      if (!looksLikeTech) {
        req.priority_tier = 8;
        req.priority_label = 'Ignore/Noise';
      }
    }
  }
  return requirements;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT: buildRequirementGraph()
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the final weighted requirement graph.
 * 
 * @param {Object} minerOutput - Output from jdRequirementMiner.mineRequirements()
 * @param {Object} llmResult - Raw LLM extraction result
 * @returns {Object} { graph, semantic_map, clusters, stats, warnings }
 */
export function buildRequirementGraph(minerOutput, llmResult = null) {
  let { requirements } = minerOutput;

  // 1. Merge LLM hidden requirements
  requirements = mergeHiddenRequirements(requirements, llmResult?.hidden_keywords);

  // 1.5 Filter noise keywords (stop words, junk, common English)
  requirements = filterNoiseRequirements(requirements);


  // 2. Apply LLM overrides
  requirements = applyLLMOverrides(requirements, llmResult);

  // 3. Assign tiers
  requirements = assignTiers(requirements);

  // 3.5 Demote surviving junk in Tier 5+ to Noise (Tier 8)
  requirements = demoteWeakTier5Plus(requirements);

  // 4. Assign clusters
  requirements = assignClusters(requirements);

  // 5. Detect relationships
  requirements = detectRelationships(requirements);

  // 6. Re-sort by priority score
  requirements.sort((a, b) => b.priority_score - a.priority_score);

  // 7. Validate
  const warnings = validateGraph(requirements, llmResult);

  // 8. Build backward-compatible semantic_map
  const semantic_map = buildBackwardCompatibleMap(requirements);

  // 9. Build cluster summary
  const clusterSummary = {};
  for (const req of requirements) {
    if (!clusterSummary[req.cluster_id]) {
      clusterSummary[req.cluster_id] = { count: 0, avg_score: 0, top_requirements: [] };
    }
    clusterSummary[req.cluster_id].count++;
    clusterSummary[req.cluster_id].avg_score += req.priority_score;
    if (clusterSummary[req.cluster_id].top_requirements.length < 3) {
      clusterSummary[req.cluster_id].top_requirements.push(req.canonical);
    }
  }
  for (const c of Object.values(clusterSummary)) {
    c.avg_score = Math.round((c.avg_score / c.count) * 100) / 100;
  }

  // 10. Stats
  const stats = {
    total_requirements: requirements.length,
    by_tier: {},
    by_category: {},
    by_cluster: Object.keys(clusterSummary).length,
    tier_1_count: requirements.filter(r => r.priority_tier === 1).length,
    tier_2_count: requirements.filter(r => r.priority_tier === 2).length,
    llm_hidden_count: requirements.filter(r => r.source === 'llm_hidden').length,
    validation_warnings: warnings.length,
  };

  for (const req of requirements) {
    stats.by_tier[req.priority_tier] = (stats.by_tier[req.priority_tier] || 0) + 1;
    stats.by_category[req.category] = (stats.by_category[req.category] || 0) + 1;
  }

  return {
    graph: requirements,
    semantic_map,
    clusters: clusterSummary,
    stats,
    warnings,
  };
}
