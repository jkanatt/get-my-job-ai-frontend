import {
  resumeToPlainText,
  calculateKeywordCoverage,
  calculateTfIdfSimilarity,
  scoreBusinessImpact,
  scoreSeniorityAlignment,
  scoreActionVerbs,
  scoreQuantification,
  scoreReadability
} from '@/features/jobs/utils/nlpScorer';

/**
 * AGENT 4: ATS Validation v4 (8-tier graph-aware scoring + tier-weighted penalties)
 */
export function agentATSValidation(tailoredResume, jdIntel, jdText) {
  const resumeText = resumeToPlainText(tailoredResume);
  const allKeywords = jdIntel.all_keywords || [];
  const semanticMap = jdIntel.semantic_map || null;
  const graphNodes = jdIntel.requirement_graph?.graph || null;

  // v4: Graph-aware weighted keyword coverage (8-tier precision)
  const coverage = calculateKeywordCoverage(resumeText, allKeywords, semanticMap, graphNodes);

  // TF-IDF similarity
  const similarity = calculateTfIdfSimilarity(resumeText, jdText);

  // Business impact scoring
  const businessImpact = scoreBusinessImpact(resumeText);

  // Seniority alignment
  const seniorityAlign = scoreSeniorityAlignment(resumeText, jdIntel.seniority);

  // Action verbs quality
  const actionVerbs = scoreActionVerbs(resumeText);

  // Quantification density
  const quantification = scoreQuantification(resumeText);

  // Readability
  const readability = scoreReadability(resumeText);

  // ── Composite score ──
  const weightedCoverage = coverage.weighted_score !== null
    ? coverage.weighted_score
    : Math.round(coverage.coverage * 100);

  let atsScore = Math.round(
    weightedCoverage * 0.50 +
    businessImpact.score * 0.15 +
    seniorityAlign.score * 0.10 +
    actionVerbs.score * 0.10 +
    quantification.score * 0.10 +
    readability.score * 0.05
  );

  // ── v4: Tier-Weighted Penalties ──
  const missingMustHaves = coverage.missing_must_haves || [];
  const missingByTier = coverage.missing_by_tier || {};

  // OPT-5: Tier-1 missing = 5 pts, Tier-2 = 3 pts, Tier-3/4 = 1 pt
  let tierPenalty = 0;
  tierPenalty += (missingByTier[1]?.length || 0) * 5; // Critical Must-Have
  tierPenalty += (missingByTier[2]?.length || 0) * 3; // High-Impact
  tierPenalty += (missingByTier[3]?.length || 0) * 1; // Core Responsibility
  tierPenalty += (missingByTier[4]?.length || 0) * 1; // Strong Preference

  // Keyword Stuffing Penalty
  let keywordStuffingPenalty = 0;
  if (coverage.matched_frequencies) {
    let overlyRepeated = 0;
    for (const [kw, count] of Object.entries(coverage.matched_frequencies)) {
      if (count > 5) overlyRepeated++;
    }
    keywordStuffingPenalty = overlyRepeated * 5;
  }

  // Fallback for when graph isn't available (use legacy penalty)
  if (!graphNodes) {
    tierPenalty = missingMustHaves.length * 3;
  }

  const penalties = {
    missing_tier_1: (missingByTier[1]?.length || 0) * 5,
    missing_tier_2: (missingByTier[2]?.length || 0) * 3,
    missing_tier_3_4: ((missingByTier[3]?.length || 0) + (missingByTier[4]?.length || 0)) * 1,
    weak_verbs: actionVerbs.weak_verbs * 1,
    weak_bullets: businessImpact.weak_bullets?.length || 0,
    keyword_stuffing: keywordStuffingPenalty
  };
  
  // OPT-5: Raised penalty cap from 25 to 35
  const totalPenalty = Math.min(35, tierPenalty + penalties.weak_verbs + penalties.weak_bullets + keywordStuffingPenalty);
  atsScore = Math.max(0, Math.min(100, atsScore - totalPenalty));

  return {
    ats_score: atsScore,
    keyword_coverage: weightedCoverage,
    semantic_similarity: Math.round(similarity * 100),
    matched_keywords: coverage.matched,
    missing_keywords: coverage.missing,
    missing_must_haves: missingMustHaves,
    missing_by_tier: missingByTier,
    business_impact_score: businessImpact.score,
    seniority_alignment: seniorityAlign.score,
    quantification_score: quantification.score,
    action_verb_score: actionVerbs.score,
    readability_score: readability.score,
    penalties,
    total_penalty: totalPenalty,
    weak_bullets: businessImpact.weak_bullets,
    pass: atsScore >= 80,
    recommendation: atsScore >= 85 ? 'PASS' : atsScore >= 70 ? 'NEEDS_FIXES' : 'REGENERATE'
  };
}
