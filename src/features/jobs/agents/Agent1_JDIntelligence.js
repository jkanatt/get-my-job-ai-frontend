import { callLLM } from '@/infrastructure/services/llmRouter';
import { parseLlmJson } from '@/shared/utils/llmJsonParser';
import {
  extractKeywords,
  buildSemanticKeywordMap,
  expandSynonyms,
  SYNONYM_CLUSTERS
} from '@/features/jobs/utils/nlpScorer';
import {
  cleanJDText,
  extractSections,
  extractDeterministicMetadata,
  buildCompactJDForLLM
} from '@/features/jobs/utils/jdPreProcessor';
import { mineRequirements } from '@/features/jobs/utils/jdRequirementMiner';
import { buildRequirementGraph } from '@/features/jobs/utils/jdRequirementGraph';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.resolve(process.cwd(), '.data', 'cache');

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║          AGENT 1: JD DECISION ENGINE v4 — World-Class                 ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                        ║
 * ║  Not a keyword extractor. A decision engine.                          ║
 * ║                                                                        ║
 * ║  LAYER 1: Structural Decomposition ($0, <20ms)                        ║
 * ║    Clean → Section → Deterministic Metadata                           ║
 * ║                                                                        ║
 * ║  LAYER 2: Requirement Mining ($0, <30ms)                              ║
 * ║    Language signals → Section weighting → Position scoring →          ║
 * ║    Frequency (diminishing returns) → Canonical normalization →        ║
 * ║    Category classification → Behavioral signals                       ║
 * ║                                                                        ║
 * ║  LAYER 3: LLM Semantic Analysis (~2s, 1 call)                        ║
 * ║    Hidden requirements → Hiring intent → Confidence adjustments →    ║
 * ║    Semantic clusters → Requirement relationships                      ║
 * ║                                                                        ║
 * ║  LAYER 4: Graph Builder ($0, <10ms)                                   ║
 * ║    8-tier priority → Cluster assignment → Validation →               ║
 * ║    Backward-compatible semantic_map                                   ║
 * ║                                                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
export async function agentJDIntelligence(jdText) {
  const t0 = Date.now();

  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 1: Structural Decomposition ($0)
  // ═══════════════════════════════════════════════════════════════════════
  const cleanedJD = cleanJDText(jdText);
  const jdHash = crypto.createHash('sha256').update(cleanedJD.substring(0, 8000)).digest('hex');
  const cacheFile = path.join(CACHE_DIR, `jd_v4_${jdHash}.json`);

  // ── Cache Check ──
  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached.all_keywords && Array.isArray(cached.all_keywords) && cached.requirement_graph) {
        console.log(`[Agent 1] ⚡ Cache HIT (v4, Hash: ${jdHash.substring(0, 8)}, ${cached.requirement_graph?.stats?.total_requirements || '?'} requirements)`);
        return cached;
      }
    } catch (e) {
      console.warn('[Agent 1] Cache read failed, proceeding fresh...', e.message);
    }
  }

  const sections = extractSections(cleanedJD);
  const deterministicMeta = extractDeterministicMetadata(cleanedJD);
  let localKeywords = extractKeywords(cleanedJD, 40);

  const isBadKw = (k) => {
    if (!k || typeof k !== 'string') return true;
    const kw = k.toLowerCase().trim();
    if (kw.length <= 2 && !['ai', 'ml', 'ux', 'ui', 'qa', 'bi'].includes(kw)) return true;
    const blocklist = ['quickly', 'ruthlessly', 'someone', 'translate', 'what you’ll own', 'what you\'ll own', 'required qualifications', 'role', 'impact', 'without', 'early', 'high', 'teams', 'uagenius', 'not ', 'fast ', 'working', 'founder', 'features'];
    if (blocklist.some(bad => kw.includes(bad) || kw === bad.trim())) return true;
    if (['not', 'fast', 'ads', 'arr', 'end', 'ship', 'kpi', 'define', 'business', 'structured'].includes(kw)) return true;
    return false;
  };
  localKeywords = localKeywords.filter(k => !isBadKw(k.term));

  const sectionsFound = Object.entries(sections).filter(([,v]) => v.length > 0).map(([k]) => k);
  console.log(`[Agent 1] 🔬 Layer 1 complete: ${cleanedJD.split(/\s+/).length} words, sections: [${sectionsFound.join(', ')}]`);

  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 2: Requirement Mining ($0)
  // ═══════════════════════════════════════════════════════════════════════
  const minerOutput = mineRequirements(sections, cleanedJD, localKeywords, SYNONYM_CLUSTERS);
  const t2 = Date.now();
  console.log(`[Agent 1] ⛏️  Layer 2 complete: ${minerOutput.requirements.length} requirements mined (${t2 - t0}ms)`);

  // Build compact JD for LLM (include top-scored requirements as context)
  const compactJD = buildCompactJDForLLM(cleanedJD, sections, deterministicMeta);
  const topMined = minerOutput.requirements
    .slice(0, 15)
    .map(r => `${r.canonical} [${r.category}, score:${r.priority_score.toFixed(2)}, section:${r.evidence.section}${r.evidence.mandatory_language ? ', MANDATORY' : ''}]`)
    .join('\n');

  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 3: LLM Semantic Analysis (1 call)
  // ═══════════════════════════════════════════════════════════════════════
  const completion = await callLLM('jd_analysis', {
    messages: [
      {
        role: 'system',
        content: `You are a JD Decision Engine. The input has been pre-cleaned, pre-sectioned, and pre-scored by a deterministic requirement miner. Your job is to provide the SEMANTIC intelligence that deterministic analysis cannot capture.

You will receive:
1. Pre-sectioned JD text with [PRE-EXTRACTED] metadata
2. TOP MINED REQUIREMENTS with their deterministic scores

Your tasks:
A. Extract skills/technologies the miner may have missed
B. Identify HIDDEN requirements (implied but not written)
C. Determine role metadata (domain, seniority, business model, etc.)
D. Identify what the recruiter is ACTUALLY screening for (hiring intent)
E. Flag any miner scores that seem semantically wrong

Output ONLY valid JSON:
{
  "required_skills": ["skills the JD explicitly requires"],
  "preferred_skills": ["skills marked as preferred/nice-to-have"],
  "technologies": ["specific technologies/tools mentioned"],
  "hidden_keywords": ["skills clearly needed but NOT explicitly written"],
  "industry": "primary industry",
  "seniority": "Junior|Mid|Senior|Lead|Director",
  "company_name": "extracted company name or null",
  "identification_confidence": 0-100,
  "role_type": "Product Manager|Software Engineer|Data Scientist|Designer|DevOps|Marketing|Sales|Operations|Other",
  "domain": "fintech|payments|cybersecurity|saas|ai_ml|data_science|edtech|gaming|hrms|healthcare|ecommerce|marketplace|supply_chain|logistics|consulting|devops|cloud|mobile|iot|proptech|insurtech|media|travel|crypto_web3|general",
  "key_metrics_expected": ["metrics this role likely tracks"],
  "leadership_scope": "individual contributor|team lead|department head|executive",
  "business_model": "B2C|B2B|B2B2C|Enterprise|Marketplace|Platform|SaaS|Hybrid",
  "product_type": "Mobile App|Web Platform|SaaS|API|Infrastructure|Data Product|Developer Tools|Internal Tools",
  "growth_stage": "Startup|Scale-up|Enterprise|Mature",
  "technical_depth_required": "Low|Medium|High|Expert",
  "hiring_intent": {
    "actual_screening_priorities": ["what recruiter REALLY screens for, in order"],
    "role_is_replacement": false,
    "role_is_new_headcount": false,
    "urgency_signals": "low|medium|high"
  },
  "jd_intent_signals": {
    "needs_growth_hacker": false,
    "needs_technical_pm": false,
    "needs_0_to_1_builder": false,
    "needs_scale_operator": false
  },
  "score_overrides": [
    {"keyword": "example_skill", "reason": "JD buries it but it's actually critical", "suggested_tier": 1}
  ]
}

RULES:
1. "hidden_keywords" = skills/concepts clearly needed but NOT written (e.g., fintech JD implies "PCI-DSS").
2. "hiring_intent.actual_screening_priorities" = ordered list of what the recruiter screens for FIRST.
3. "score_overrides" = ONLY use when the miner clearly got something wrong. Empty array if scores look right.
4. Translate non-English content into English.
5. Output raw JSON immediately. No reasoning.`
      },
      {
        role: 'user',
        content: `${compactJD}\n\n=== TOP MINED REQUIREMENTS (pre-scored) ===\n${topMined}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 3000
  });

  let llmResult = parseLlmJson(completion.choices[0]?.message?.content || '{}') || {};
  
  const sanitizeArray = (arr) => Array.isArray(arr) ? arr.filter(k => !isBadKw(k)) : [];
  llmResult.required_skills = sanitizeArray(llmResult.required_skills);
  llmResult.preferred_skills = sanitizeArray(llmResult.preferred_skills);
  llmResult.technologies = sanitizeArray(llmResult.technologies);
  llmResult.hidden_keywords = sanitizeArray(llmResult.hidden_keywords);
  const t3 = Date.now();
  console.log(`[Agent 1] 🧠 Layer 3 complete: LLM analysis (${t3 - t2}ms), ${(llmResult.hidden_keywords || []).length} hidden reqs, ${(llmResult.score_overrides || []).length} overrides`);

  // Apply LLM score overrides before graph building
  if (llmResult.score_overrides && Array.isArray(llmResult.score_overrides)) {
    for (const override of llmResult.score_overrides) {
      const req = minerOutput.requirements.find(r =>
        r.canonical.toLowerCase() === (override.keyword || '').toLowerCase()
      );
      if (req && override.suggested_tier >= 1 && override.suggested_tier <= 8) {
        const tierScores = { 1: 0.90, 2: 0.75, 3: 0.60, 4: 0.48, 5: 0.35, 6: 0.25, 7: 0.15, 8: 0.05 };
        req.priority_score = tierScores[override.suggested_tier] || req.priority_score;
        req.evidence.llm_override = override.reason;
        req.confidence = Math.min(1.0, req.confidence + 0.15);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 4: Graph Builder ($0)
  // ═══════════════════════════════════════════════════════════════════════
  // Sanitize miner requirements so they don't leak into graph
  minerOutput.requirements = minerOutput.requirements.filter(r => !isBadKw(r.canonical));
  const graphResult = buildRequirementGraph(minerOutput, llmResult);
  const t4 = Date.now();

  console.log(`[Agent 1] 📊 Layer 4 complete: ${graphResult.stats.total_requirements} requirements → ${graphResult.stats.tier_1_count} critical, ${graphResult.stats.tier_2_count} high-impact, ${Object.keys(graphResult.clusters).length} clusters (${t4 - t3}ms)`);
  if (graphResult.warnings.length > 0) {
    console.warn(`[Agent 1] ⚠️  Validation warnings: ${graphResult.warnings.join('; ')}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ASSEMBLE FINAL OUTPUT (backward-compatible + new graph)
  // ═══════════════════════════════════════════════════════════════════════
  const result = {
    // ── LLM extraction (backward-compatible) ──
    required_skills: llmResult.required_skills || [],
    preferred_skills: llmResult.preferred_skills || [],
    technologies: llmResult.technologies || [],
    hidden_keywords: llmResult.hidden_keywords || [],
    industry: llmResult.industry || null,
    seniority: llmResult.seniority || 'Mid',
    responsibilities: llmResult.responsibilities || [],
    company_name: llmResult.company_name || null,
    identification_confidence: llmResult.identification_confidence || 0,
    role_type: llmResult.role_type || 'Other',
    domain: llmResult.domain || 'general',
    key_metrics_expected: llmResult.key_metrics_expected || [],
    leadership_scope: llmResult.leadership_scope || 'individual contributor',
    business_model: llmResult.business_model || 'Hybrid',
    product_type: llmResult.product_type || 'Web Platform',
    growth_stage: llmResult.growth_stage || 'Scale-up',
    technical_depth_required: llmResult.technical_depth_required || 'Medium',
    jd_intent_signals: llmResult.jd_intent_signals || {},

    // ── Local NLP (backward-compatible) ──
    local_tfidf_keywords: localKeywords.map(k => k.term),
    semantic_map: graphResult.semantic_map, // Built from the graph — backward-compatible

    // ── Deterministic metadata ──
    min_experience_years: deterministicMeta.min_experience_years || null,
    max_experience_years: deterministicMeta.max_experience_years || null,
    locations: deterministicMeta.locations || [],
    work_mode: deterministicMeta.work_mode || null,
    salary_range: deterministicMeta.salary_range || null,
    education_degrees: deterministicMeta.education_degrees || [],
    education_fields: deterministicMeta.education_fields || [],
    language: deterministicMeta.language || 'English',
    word_count: deterministicMeta.word_count || 0,

    // ── NEW: Weighted Requirement Graph ──
    requirement_graph: {
      graph: graphResult.graph,
      clusters: graphResult.clusters,
      stats: graphResult.stats,
      warnings: graphResult.warnings,
    },

    // ── NEW: Hiring Intent ──
    hiring_intent: llmResult.hiring_intent || null,

    // ── Section awareness for downstream agents ──
    sections: {
      has_requirements: sections.requirements.length > 0,
      has_preferred: sections.preferred.length > 0,
      has_responsibilities: sections.responsibilities.length > 0,
      has_about_company: sections.about_company.length > 0,
    },
    _raw_sections: {
      requirements: sections.requirements.substring(0, 2000),
      responsibilities: sections.responsibilities.substring(0, 1500),
      preferred: sections.preferred.substring(0, 1000),
    },
  };

  // ── Build all_keywords (backward-compatible) ──
  const rawKeywords = [
    ...(result.required_skills || []),
    ...(result.preferred_skills || []),
    ...(result.technologies || []),
    ...(result.hidden_keywords || []),
    ...result.local_tfidf_keywords
  ];
  result.all_keywords = [...new Set(expandSynonyms(rawKeywords))];

  // ── Normalize business_model fallback ──
  if (!result.business_model || result.business_model === 'Hybrid') {
    const kwStr = result.all_keywords.join(' ').toLowerCase();
    if (kwStr.includes('b2c') || kwStr.includes('consumer') || kwStr.includes('retail')) result.business_model = 'B2C';
    else if (kwStr.includes('b2b') || kwStr.includes('enterprise')) result.business_model = 'B2B';
    else if (kwStr.includes('saas')) result.business_model = 'SaaS';
    else if (kwStr.includes('marketplace')) result.business_model = 'Marketplace';
  }

  // ── Seniority enrichment from experience years ──
  if (!result.seniority || result.seniority === 'Mid') {
    const minYears = result.min_experience_years || 0;
    if (minYears >= 10) result.seniority = 'Director';
    else if (minYears >= 7) result.seniority = 'Lead';
    else if (minYears >= 4) result.seniority = 'Senior';
    else if (minYears >= 2) result.seniority = 'Mid';
  }

  // ── Keyword density ──
  result.keyword_density = Math.min(1.0, result.all_keywords.length / 40);

  // ── Cache Write ──
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf8');
    const totalMs = Date.now() - t0;
    console.log(`[Agent 1] ✅ JD Decision Engine v4 complete (${totalMs}ms total, ${result.requirement_graph.stats.total_requirements} requirements, domain: ${result.domain}, seniority: ${result.seniority})`);
  } catch (e) {
    console.warn('[Agent 1] Failed to write cache', e.message);
  }

  return result;
}
