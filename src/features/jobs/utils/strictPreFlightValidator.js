/**
 * strictPreFlightValidator.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Non-AI validator that runs BEFORE any LLM call.
 * BLOCKS the pipeline if input data quality is insufficient.
 * Zero API calls. Deterministic. <1ms.
 */

/**
 * Validates that brain data has sufficient quality for LLM tailoring.
 * @param {Object} brain - The obsidian brain object
 * @param {Array} selectedProjects - Projects selected by vectorBrain
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateBrainDataQuality(brain, selectedProjects) {
  const errors = [];
  const warnings = [];

  if (!brain) {
    errors.push('FATAL: Brain object is null/undefined.');
    return { valid: false, errors, warnings };
  }

  if (!brain.projects || brain.projects.length === 0) {
    errors.push('FATAL: Brain has zero projects.');
    return { valid: false, errors, warnings };
  }

  if (!brain.profile) {
    warnings.push('WARNING: Brain has no profile section. LLM may hallucinate profile data.');
  }

  // Validate selected projects have sufficient bullets
  if (selectedProjects && selectedProjects.length > 0) {
    for (const proj of selectedProjects) {
      if (!proj.bullets || proj.bullets.length < 2) {
        warnings.push(`WARNING: Project "${proj.name}" has <2 bullets. LLM will likely hallucinate.`);
      }
      if (!proj.name || proj.name.trim().length < 3) {
        errors.push(`FATAL: Project has missing/invalid name: "${proj.name}".`);
      }
    }
    if (selectedProjects.length < 2) {
      warnings.push('WARNING: Only 1 project selected. Resume will lack diversity.');
    }
  } else {
    errors.push('FATAL: No projects selected for tailoring.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates JD quality before sending to LLM.
 * @param {string} jdText - Raw job description text
 * @param {Object} jdIntel - Extracted JD intelligence
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateJDQuality(jdText, jdIntel) {
  const errors = [];
  const warnings = [];

  if (!jdText || jdText.trim().length < 100) {
    errors.push(`FATAL: JD text is too short (${jdText?.trim().length || 0} chars). Minimum 100 required.`);
  }

  if (!jdIntel) {
    errors.push('FATAL: jdIntel object is null/undefined.');
    return { valid: false, errors, warnings };
  }

  if (!jdIntel.company_name || jdIntel.company_name.trim().length < 2) {
    warnings.push('WARNING: Company name is missing/empty. Cover letter personalization will degrade.');
  }

  if (!jdIntel.role_type || jdIntel.role_type.trim().length < 3) {
    warnings.push('WARNING: Role type is missing/empty. Resume headline will be generic.');
  }

  if (!jdIntel.all_keywords || jdIntel.all_keywords.length < 3) {
    warnings.push(`WARNING: Only ${jdIntel.all_keywords?.length || 0} keywords extracted. ATS matching will be weak.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates profile completeness.
 * @param {Object} profile - Profile data from brain or profile_data.json
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateProfileCompleteness(profile) {
  const errors = [];
  const warnings = [];

  if (!profile) {
    errors.push('FATAL: Profile object is null/undefined.');
    return { valid: false, errors, warnings };
  }

  const requiredFields = ['name'];
  for (const field of requiredFields) {
    if (!profile[field] || profile[field].trim().length < 2) {
      errors.push(`FATAL: Profile missing required field: "${field}".`);
    }
  }

  const desiredFields = ['email', 'phone', 'linkedin', 'title', 'experience_years'];
  for (const field of desiredFields) {
    if (!profile[field]) {
      warnings.push(`WARNING: Profile missing field: "${field}". Output will have gaps.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Master pre-flight check. Runs ALL validators and returns aggregate result.
 * @param {Object} params - { brain, selectedProjects, jdText, jdIntel, profile }
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function runPreFlightValidation({ brain, selectedProjects, jdText, jdIntel, profile }) {
  const allErrors = [];
  const allWarnings = [];

  const brainResult = validateBrainDataQuality(brain, selectedProjects);
  allErrors.push(...brainResult.errors);
  allWarnings.push(...brainResult.warnings);

  const jdResult = validateJDQuality(jdText, jdIntel);
  allErrors.push(...jdResult.errors);
  allWarnings.push(...jdResult.warnings);

  const profileResult = validateProfileCompleteness(profile);
  allErrors.push(...profileResult.errors);
  allWarnings.push(...profileResult.warnings);

  // Log all findings
  if (allWarnings.length > 0) {
    console.warn(`[PreFlight] ⚠️  ${allWarnings.length} warnings:`);
    allWarnings.forEach(w => console.warn(`  ${w}`));
  }
  if (allErrors.length > 0) {
    console.error(`[PreFlight] ❌ ${allErrors.length} FATAL errors — PIPELINE BLOCKED:`);
    allErrors.forEach(e => console.error(`  ${e}`));
  }
  if (allErrors.length === 0) {
    console.log(`[PreFlight] ✅ All checks passed (${allWarnings.length} non-blocking warnings).`);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
