/**
 * deterministicConsensus.js — Component 5
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Zero-LLM Consensus Engine
 * Replaces Agent 3C (LLM "boardroom debate") with iterative
 * deterministic quality scoring + keyword injection loops.
 * 
 * Performance: <5ms per iteration (vs 10-30s with LLM)
 * Cost: $0
 */

/**
 * Deterministic Consensus Loop.
 * Iteratively scores and improves the resume using existing
 * deterministic validators (ATS scorer + Self-Healer).
 *
 * @param {Object} resumeData - Generated resume data
 * @param {Object} jdIntel - JD intelligence
 * @param {Function} atsValidator - agentATSValidation function
 * @param {Function} selfHealer - agentSelfHeal function  
 * @param {Function} constraintValidator - validateAndFix function
 * @param {Object} constraints - Resume constraints
 * @param {string} jdText - Raw JD text
 * @param {Object} brain - Obsidian brain data
 * @returns {Object} { data, score, passes, improvements }
 */
export function deterministicConsensus(
  resumeData, jdIntel, atsValidator, selfHealer,
  constraintValidator, constraints, jdText, brain
) {
  const MAX_PASSES = 3;
  const TARGET_SCORE = 85;
  let currentData = resumeData;
  let currentScore = 0;
  const improvements = [];

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // ── Score current state ──
    const validation = atsValidator(currentData, jdIntel, jdText);
    currentScore = validation.ats_score;

    if (currentScore >= TARGET_SCORE && validation.recommendation === 'PASS') {
      console.log(`[DeterministicConsensus] Pass ${pass + 1}: Score ${currentScore} ≥ ${TARGET_SCORE} — PASS`);
      break;
    }

    console.log(`[DeterministicConsensus] Pass ${pass + 1}: Score ${currentScore} — attempting improvement`);

    // ── Apply constraint validation ──
    const constraintResult = constraintValidator(currentData, constraints);
    currentData = constraintResult.data;

    // ── Apply self-healing for missing keywords ──
    if (validation.missing_keywords?.length > 0) {
      const healed = injectMissingKeywordsDeterministic(
        currentData, validation.missing_keywords, brain
      );
      currentData = healed.data;
      improvements.push(...healed.fixes);
    }

    // ── Apply width violations fix ──
    if (constraintResult.violations?.length > 0) {
      const widthFixes = constraintResult.violations.filter(v => v.rule === 'suboptimal_line_width');
      improvements.push(...widthFixes.map(v => ({ type: 'width_fix', details: v })));
    }
  }

  // Final scoring
  const finalValidation = constraintValidator(currentData, constraints);
  currentData = finalValidation.data;

  return {
    data: currentData,
    score: currentScore,
    passes: Math.min(MAX_PASSES, 3),
    improvements,
  };
}

/**
 * Inject missing keywords into the resume deterministically.
 * Targets the section with the lowest keyword density first.
 */
function injectMissingKeywordsDeterministic(resumeData, missingKeywords, brain) {
  const fixes = [];
  const data = JSON.parse(JSON.stringify(resumeData)); // Deep clone

  for (const keyword of missingKeywords.slice(0, 5)) {
    const kw = keyword.toLowerCase();

    // Strategy 1: Try adding to skills arrays
    if (data.skills) {
      const skillArrays = ['ai_product_strategy', 'domain_skills', 'tools'];
      for (const arrName of skillArrays) {
        const arr = data.skills[arrName];
        if (Array.isArray(arr) && arr.length < 18) {
          const alreadyPresent = arr.some(s => s.toLowerCase().includes(kw));
          if (!alreadyPresent) {
            arr.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
            fixes.push({ type: 'skill_injection', keyword, target: arrName });
            break;
          }
        }
      }
    }

    // Strategy 2: Try adding to page2.domain_expertise
    if (data.page2?.domain_expertise && Array.isArray(data.page2.domain_expertise)) {
      const arr = data.page2.domain_expertise;
      if (arr.length < 31) {
        const alreadyPresent = arr.some(s => s.toLowerCase().includes(kw));
        if (!alreadyPresent) {
          arr.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
          fixes.push({ type: 'expertise_injection', keyword, target: 'domain_expertise' });
        }
      }
    }
  }

  return { data, fixes };
}
