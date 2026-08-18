/**
 * resumeValidator.js — Pre-Compilation Quality Gate
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Runs BEFORE Agent 7 (PDF Compiler) to catch broken data
 * before it reaches the LaTeX generator.
 *
 * Validates:
 *   1. Every experience entry has company_name, title, and ≥1 bullet
 *   2. Every key_project has ≥2 bullets with ≥50 chars each
 *   3. No project name contains URL fragments or query strings
 *   4. Summary section exists and is non-empty
 *   5. Skills section exists
 *
 * Returns { pass: boolean, violations: string[], fixed: object }
 */

// Experience keys are now dynamically derived from masterResume

const BOGUS_PROJECT_PATTERNS = [
  /\?node-id=/i,
  /figma\.com/i,
  /\(figma\)/i,
  /\(view documentation\)/i,
  /&t=/i,
  /^joshua[\s-]kanatt/i,
];

/**
 * Validate and auto-fix a tailored resume data object.
 * @param {object} resumeData - The tailored resume JSON
 * @param {object} masterResume - The master resume JSON (fallback source)
 * @returns {{ pass: boolean, violations: string[], data: object }}
 */
export function validateResume(resumeData, masterResume) {
  const violations = [];
  const data = JSON.parse(JSON.stringify(resumeData)); // Deep clone

  const allowedExperienceKeys = Object.keys(masterResume?.experience || {});

  // ═══ 1. EXPERIENCE VALIDATION ═══
  const experience = data.experience || {};
  const expKeys = Object.keys(experience);

  // Filter to only allowed keys
  for (const key of expKeys) {
    if (!allowedExperienceKeys.includes(key)) {
      delete data.experience[key];
      violations.push(`[EXP] Removed disallowed experience entry: '${key}'`);
    }
  }

  // Validate each allowed entry
  for (const key of allowedExperienceKeys) {
    const entry = data.experience[key];
    if (!entry) {
      // Restore from master if missing
      if (masterResume?.experience?.[key]) {
        data.experience[key] = JSON.parse(JSON.stringify(masterResume.experience[key]));
        violations.push(`[EXP] Restored missing experience entry '${key}' from master`);
      }
      continue;
    }

    // Check company_name and title
    if (!entry.company_name || !entry.title) {
      if (masterResume?.experience?.[key]) {
        entry.company_name = masterResume.experience[key].company_name;
        entry.title = masterResume.experience[key].title;
        entry.location = masterResume.experience[key].location;
        entry.tenure = masterResume.experience[key].tenure;
        violations.push(`[EXP] Restored immutable fields for '${key}' from master`);
      }
    }

    // Check bullets exist
    const hasBullets = Object.keys(entry).some(
      f => f.startsWith('bullet') && typeof entry[f] === 'string' && entry[f].length > 20
    );
    const hasBulletsArray = Array.isArray(entry.bullets) && entry.bullets.some(
      b => typeof b === 'string' && b.length > 20
    );

    if (!hasBullets && !hasBulletsArray) {
      if (masterResume?.experience?.[key]) {
        // Restore bullets from master
        const masterEntry = masterResume.experience[key];
        for (let i = 1; i <= 6; i++) {
          if (masterEntry[`bullet${i}`]) {
            entry[`bullet${i}`] = masterEntry[`bullet${i}`];
          }
        }
        violations.push(`[EXP] Restored bullets for '${key}' from master (had zero valid bullets)`);
      }
    }
  }

  // ═══ 2. KEY PROJECTS VALIDATION ═══
  const projects = data.key_projects || [];
  const cleanedProjects = [];

  for (const proj of projects) {
    const name = proj.name || '';
    const id = proj.id || '';
    const combinedText = `${name} ${id}`.toLowerCase();

    // Filter bogus projects
    let isBogus = false;
    for (const pattern of BOGUS_PROJECT_PATTERNS) {
      if (pattern.test(combinedText)) {
        violations.push(`[PROJ] Removed bogus project: '${name}' (matched: ${pattern})`);
        isBogus = true;
        break;
      }
    }
    if (isBogus) continue;

    // Validate bullets
    const bullets = proj.bullets || [];
    const validBullets = bullets.filter(b => typeof b === 'string' && b.length >= 50);

    if (validBullets.length < 2) {
      violations.push(`[PROJ] Project '${name}' has only ${validBullets.length} valid bullets (min 2)`);
      // Still include it but log the violation
    }

    cleanedProjects.push(proj);
  }

  data.key_projects = cleanedProjects;

  // ═══ 3. SUMMARY VALIDATION ═══
  const summary = data.summary;
  if (!summary || (typeof summary === 'object' && !summary.line1 && !summary.line2)) {
    violations.push(`[SUMMARY] Summary section is empty or missing`);
  }

  // ═══ 4. SKILLS VALIDATION ═══
  const skills = data.skills || {};
  if (Object.keys(skills).length === 0) {
    violations.push(`[SKILLS] Skills section is empty`);
  }

  const pass = violations.filter(v => v.startsWith('[EXP]')).length === 0
    && cleanedProjects.length >= 3;

  if (violations.length > 0) {
    console.warn(`[ResumeValidator] ${violations.length} violations found:`);
    violations.forEach(v => console.warn(`  → ${v}`));
  } else {
    console.log(`[ResumeValidator] ✅ All checks passed`);
  }

  return { pass, violations, data };
}
