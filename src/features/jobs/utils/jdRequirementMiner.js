/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║       JD REQUIREMENT MINER — Deterministic Scoring Engine             ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Mines every requirement from a pre-sectioned JD and scores it        ║
 * ║  using 6 deterministic dimensions — zero LLM cost, <50ms.            ║
 * ║                                                                        ║
 * ║  Dimensions:                                                           ║
 * ║    1. Language Signal (mandatory/preference/noise detection)           ║
 * ║    2. Section Weight (requirements > responsibilities > preferred)     ║
 * ║    3. Position Score (earlier in JD = more important)                  ║
 * ║    4. Frequency (with diminishing returns — 3rd mention ≠ 3×)         ║
 * ║    5. Category Classification (tech/skill/behavioral/tool/metric)     ║
 * ║    6. Canonical Normalization (ReactJS → React via synonym clusters)  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import natural from 'natural';

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE SIGNAL PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

const MANDATORY_SIGNALS = [
  /\b(must[\s-]?have|required|essential|mandatory|minimum|critical|non[\s-]?negotiable)\b/i,
  /\b(must|shall|need to|required to|expected to)\b/i,
  /\b(proven (experience|track record|ability))\b/i,
  /\b(strong (background|experience|knowledge|proficiency|understanding))\b/i,
  /\b(deep (expertise|understanding|knowledge|experience))\b/i,
  /\b(expert(ise)?[\s-]?(in|with|of))\b/i,
  /\b(hands[\s-]?on experience)\b/i,
  /\b(proficien(t|cy) (in|with))\b/i,
];

const STRONG_SIGNALS = [
  /\b(experience (with|in|of|building|developing|leading|managing|designing))\b/i,
  /\b(knowledge of|familiar(ity)? with|understanding of|background in)\b/i,
  /\b(ability to|capable of|skilled (in|at))\b/i,
  /\b(responsible for|accountable for|own(ing|ership of)?)\b/i,
  /\b(track record|demonstrated|established)\b/i,
];

const PREFERENCE_SIGNALS = [
  /\b(prefer(red|ably)?|nice[\s-]?to[\s-]?have|bonus|plus|ideal(ly)?|desired|advantageous)\b/i,
  /\b(good[\s-]?to[\s-]?have|would be (a |an )?(great |big )?plus|not required but)\b/i,
  /\b(familiarity|exposure|awareness|some experience)\b/i,
];

const NOISE_SIGNALS = [
  /\b(competitive (salary|compensation|benefits|package))\b/i,
  /\b(equal opportunity|eeo|diversity|we are (an? )?equal)\b/i,
  /\b(health (insurance|benefits)|dental|vision|401k|pto|paid time off|vacation)\b/i,
  /\b(apply now|submit (your )?resume|click (here|below))\b/i,
  /\b(about (our|the) (company|team|culture|mission|vision))\b/i,
  /\b(we offer|we provide|what we offer|why join|perks)\b/i,
  /\b(disclaimer|privacy policy|terms|copyright)\b/i,
];

const BEHAVIORAL_SIGNALS = [
  /\b(leadership|mentor(ing|ship)?|coach(ing)?|team[\s-]?build(ing)?)\b/i,
  /\b(communicat(ion|e)|collaborat(ion|e|ive)|stakeholder)\b/i,
  /\b(problem[\s-]?solv(ing|er)|critical thinking|analytical)\b/i,
  /\b(self[\s-]?start(er|ing)|proactive|initiative|autonomous)\b/i,
  /\b(fast[\s-]?paced|dynamic|ambigui(ty|ous)|uncertainty)\b/i,
  /\b(detail[\s-]?oriented|meticulous|thorough|precision)\b/i,
  /\b(ownership|accountab(le|ility)|driv(en|e)|passion(ate)?)\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION WEIGHTS
// ═══════════════════════════════════════════════════════════════════════════

const SECTION_WEIGHTS = {
  requirements: 1.0,
  responsibilities: 0.8,
  unclassified: 0.65,
  preferred: 0.45,
  about_company: 0.2,
  benefits: 0.05,
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_PATTERNS = {
  technology: /\b(react|angular|vue|node|python|java|typescript|javascript|golang|rust|swift|kotlin|c\+\+|c#|\.net|ruby|php|scala|elixir|sql|nosql|mongodb|postgresql|mysql|redis|kafka|docker|kubernetes|aws|gcp|azure|terraform|graphql|rest|grpc|elasticsearch|spark|hadoop|tensorflow|pytorch|flutter|django|spring|express|fastapi|next\.?js|html|css)\b/i,
  tool: /\b(jira|confluence|figma|sketch|notion|miro|asana|trello|linear|slack|github|gitlab|bitbucket|datadog|grafana|jenkins|circleci|vercel|firebase|tableau|power\s?bi|mixpanel|amplitude|segment|hubspot|salesforce|intercom|zendesk)\b/i,
  metric: /\b(dau|mau|arpu|ltv|cac|nps|csat|roi|kpi|okr|conversion rate|retention|churn|revenue|arpdau|session length|engagement rate|gmv|arr|mrr|burn rate|runway)\b/i,
  domain_knowledge: /\b(fintech|payments|upi|kyc|aml|bfsi|healthcare|hipaa|edtech|gaming|esports|ecommerce|marketplace|supply chain|logistics|real estate|proptech|insurtech|agritech|adtech|saas|cybersecurity|blockchain|web3|defi|crypto)\b/i,
  methodology: /\b(agile|scrum|kanban|lean|six sigma|waterfall|safe|design thinking|tdd|bdd|ci\/cd|devops|sre|mlops|dataops)\b/i,
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE MINING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract individual requirement bullets/lines from a section of text.
 */
function extractBullets(sectionText) {
  if (!sectionText || sectionText.trim().length === 0) return [];
  
  // Split on bullet points, numbered lists, or newlines
  const lines = sectionText
    .split(/(?:\n|^)\s*(?:•|[\-\*\+]|(?:\d+[\.\)])\s+|[a-z][\.\)])\s*/i)
    .map(l => l.trim())
    .filter(l => l.length > 5); // Skip tiny fragments

  // If no bullets found, split on newlines
  if (lines.length <= 1) {
    return sectionText
      .split(/\n+/)
      .map(l => l.trim())
      .filter(l => l.length > 10);
  }

  return lines;
}

/**
 * Score a single bullet for language signals.
 * Returns { signal_type, signal_score, signals_found }
 */
function scoreLanguageSignal(bullet) {
  const signals = [];
  let score = 0;

  // Check noise first (early exit)
  for (const pattern of NOISE_SIGNALS) {
    if (pattern.test(bullet)) {
      return { signal_type: 'noise', signal_score: -0.5, signals_found: ['noise'] };
    }
  }

  // Mandatory signals
  for (const pattern of MANDATORY_SIGNALS) {
    const match = bullet.match(pattern);
    if (match) {
      signals.push(match[0].toLowerCase());
      score += 0.3;
    }
  }

  // Strong signals
  for (const pattern of STRONG_SIGNALS) {
    const match = bullet.match(pattern);
    if (match) {
      signals.push(match[0].toLowerCase());
      score += 0.2;
    }
  }

  // Preference signals (negative)
  for (const pattern of PREFERENCE_SIGNALS) {
    const match = bullet.match(pattern);
    if (match) {
      signals.push(match[0].toLowerCase());
      score -= 0.15;
    }
  }

  const type = score >= 0.3 ? 'mandatory' : score >= 0.1 ? 'strong' : score < 0 ? 'preference' : 'neutral';
  return { signal_type: type, signal_score: Math.max(-0.3, Math.min(0.5, score)), signals_found: signals };
}

/**
 * Detect behavioral signals in a bullet.
 */
function detectBehavioralSignals(bullet) {
  const found = [];
  for (const pattern of BEHAVIORAL_SIGNALS) {
    const match = bullet.match(pattern);
    if (match) found.push(match[0].toLowerCase());
  }
  return found;
}

/**
 * Classify a keyword into a category.
 */
function classifyCategory(keyword) {
  const lower = keyword.toLowerCase();
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(lower)) return category;
  }
  // Check behavioral
  for (const pattern of BEHAVIORAL_SIGNALS) {
    if (pattern.test(lower)) return 'behavioral';
  }
  return 'skill'; // default
}

/**
 * Normalize a keyword to its canonical form using synonym clusters.
 * Uses the existing _synonymLookup from nlpScorer.
 */
function canonicalize(keyword, synonymClusters) {
  const lower = keyword.toLowerCase().trim();
  for (const cluster of synonymClusters) {
    if (cluster.some(term => term.toLowerCase() === lower)) {
      // Return the FIRST term in the cluster as canonical
      return cluster[0];
    }
  }
  return lower;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT: mineRequirements()
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mine all requirements from a pre-sectioned JD and score them deterministically.
 * 
 * @param {Object} sections - Output from jdPreProcessor.extractSections()
 * @param {string} cleanedJD - Full cleaned JD text (for position scoring)
 * @param {Array} tfidfKeywords - Output from nlpScorer.extractKeywords()
 * @param {Array} synonymClusters - The SYNONYM_CLUSTERS array from nlpScorer
 * @returns {Object} { requirements: RequirementNode[], frequency_map, canonical_map }
 */
export function mineRequirements(sections, cleanedJD, tfidfKeywords, synonymClusters = []) {
  const totalLength = cleanedJD.length;
  const requirements = [];
  const frequencyMap = new Map();  // canonical → count
  const canonicalMap = new Map();  // raw → canonical
  const rawMentionsMap = new Map(); // canonical → Set of raw mentions
  let reqId = 0;

  // ── Process each section ──
  for (const [sectionName, sectionText] of Object.entries(sections)) {
    if (!sectionText || sectionText.length === 0) continue;
    
    const sectionWeight = SECTION_WEIGHTS[sectionName] || 0.5;
    const bullets = extractBullets(sectionText);

    for (const bullet of bullets) {
      // 1. Language signal scoring
      const langSignal = scoreLanguageSignal(bullet);
      
      // Skip noise bullets entirely
      if (langSignal.signal_type === 'noise') continue;

      // 2. Position scoring (where in the full JD does this bullet appear?)
      const bulletPosition = cleanedJD.indexOf(bullet);
      const positionPercentile = bulletPosition >= 0 ? bulletPosition / totalLength : 0.5;
      const positionScore = positionPercentile <= 0.25 ? 1.0 :
                            positionPercentile <= 0.50 ? 0.85 :
                            positionPercentile <= 0.75 ? 0.65 :
                            0.45;

      // 3. Behavioral signal detection
      const behavioralSignals = detectBehavioralSignals(bullet);

      // 4. Extract entities from this bullet (both TF-IDF terms and pattern matches)
      const bulletLower = bullet.toLowerCase();
      const entitiesInBullet = [];

      // Check TF-IDF keywords that appear in this bullet
      for (const kw of tfidfKeywords) {
        if (bulletLower.includes(kw.term.toLowerCase())) {
          entitiesInBullet.push(kw.term);
        }
      }

      // Check category patterns for additional entities
      for (const [, pattern] of Object.entries(CATEGORY_PATTERNS)) {
        let match;
        const regex = new RegExp(pattern.source, 'gi');
        while ((match = regex.exec(bullet)) !== null) {
          entitiesInBullet.push(match[0]);
        }
      }

      // Deduplicate entities
      const uniqueEntities = [...new Set(entitiesInBullet.map(e => e.toLowerCase()))];

      // 5. Score and track each entity
      for (const entity of uniqueEntities) {
        const canonical = canonicalize(entity, synonymClusters);
        canonicalMap.set(entity, canonical);

        // Track raw mentions
        if (!rawMentionsMap.has(canonical)) rawMentionsMap.set(canonical, new Set());
        rawMentionsMap.get(canonical).add(entity);

        // Frequency with diminishing returns
        const currentCount = (frequencyMap.get(canonical) || 0) + 1;
        frequencyMap.set(canonical, currentCount);
        const frequencyBoost = currentCount === 1 ? 0.0 :
                               currentCount === 2 ? 0.15 :
                               currentCount === 3 ? 0.05 :
                               0.0; // 4th+ mention adds nothing

        // Category
        const category = classifyCategory(entity);

        // Composite score
        const compositeScore = (
          sectionWeight * 0.35 +
          positionScore * 0.20 +
          Math.max(0, langSignal.signal_score) * 0.25 +
          frequencyBoost * 0.10 +
          (category === 'technology' ? 0.05 : 0) +
          (category === 'domain_knowledge' ? 0.05 : 0)
        );

        // Check if we already have this canonical entity
        const existing = requirements.find(r => r.canonical === canonical);
        if (existing) {
          // Update with higher score if this mention is stronger
          if (compositeScore > existing.priority_score) {
            existing.priority_score = compositeScore;
            existing.evidence.section = sectionName;
            existing.evidence.language_signals = [...new Set([...existing.evidence.language_signals, ...langSignal.signals_found])];
          }
          existing.evidence.mention_count = currentCount;
          existing.evidence.mandatory_language = existing.evidence.mandatory_language || langSignal.signal_type === 'mandatory';
          if (behavioralSignals.length > 0) {
            existing.behavioral_signals = [...new Set([...(existing.behavioral_signals || []), ...behavioralSignals])];
          }
        } else {
          reqId++;
          requirements.push({
            id: `req_${String(reqId).padStart(3, '0')}`,
            canonical,
            raw_mentions: [entity],
            priority_score: compositeScore,
            priority_tier: 0, // Will be assigned by graph builder
            category,
            evidence: {
              section: sectionName,
              mandatory_language: langSignal.signal_type === 'mandatory',
              position_percentile: Math.round(positionPercentile * 100) / 100,
              mention_count: 1,
              language_signals: langSignal.signals_found,
            },
            behavioral_signals: behavioralSignals,
            confidence: langSignal.signal_type === 'mandatory' ? 0.95 :
                        langSignal.signal_type === 'strong' ? 0.85 :
                        langSignal.signal_type === 'preference' ? 0.70 :
                        0.60,
          });
        }
      }

      // 6. If a bullet had no recognized entities but has strong signals, store as responsibility
      if (uniqueEntities.length === 0 && (langSignal.signal_type === 'mandatory' || langSignal.signal_type === 'strong')) {
        reqId++;
        requirements.push({
          id: `req_${String(reqId).padStart(3, '0')}`,
          canonical: bullet.substring(0, 80).trim(),
          raw_mentions: [bullet],
          priority_score: sectionWeight * 0.35 + positionScore * 0.20 + Math.max(0, langSignal.signal_score) * 0.25,
          priority_tier: 0,
          category: behavioralSignals.length > 0 ? 'behavioral' : 'responsibility',
          evidence: {
            section: sectionName,
            mandatory_language: langSignal.signal_type === 'mandatory',
            position_percentile: Math.round(positionPercentile * 100) / 100,
            mention_count: 1,
            language_signals: langSignal.signals_found,
          },
          behavioral_signals: behavioralSignals,
          confidence: 0.55,
        });
      }
    }
  }

  // ── Update raw_mentions from the tracking map ──
  for (const req of requirements) {
    if (rawMentionsMap.has(req.canonical)) {
      req.raw_mentions = [...rawMentionsMap.get(req.canonical)];
    }
  }

  // ── Sort by score descending ──
  requirements.sort((a, b) => b.priority_score - a.priority_score);

  return {
    requirements,
    frequency_map: Object.fromEntries(frequencyMap),
    canonical_map: Object.fromEntries(canonicalMap),
  };
}
