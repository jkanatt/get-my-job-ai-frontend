/**
 * Agent 3D: Post-Generation Bullet Validator
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Zero-LLM, deterministic validator that catches every known failure pattern
 * before the resume is compiled to PDF. Runs in <5ms, zero cost.
 *
 * Returns: { valid: boolean, bullets: [], issues: [], fixed: boolean }
 */

// Known fragment patterns that indicate incomplete LLM generation
const FRAGMENT_PATTERNS = [
  /\bThis d\.$/,
  /\bThis di\.$/,
  /\bThis de\.$/,
  /\band t\.$/,
  /\bwith a\.$/,
  /\bfor t\.$/,
  /\bto t\.$/,
  /\bin t\.$/,
  /\bthe s\.$/,
  /[a-z]{1,3}\.\s*$/,  // Very short word followed by period at end (likely fragment)
];

// Default hallucination indicators — overridable via profile's excluded_technologies
const DEFAULT_HALLUCINATION_BLOCKLIST = [
  'kubernetes', 'terraform', 'jenkins', 'ansible', 'puppet', 'chef',
  'scala', 'rust', 'haskell', 'erlang', 'elixir', 'clojure',
  'c++', 'c#', '.net', 'ruby on rails', 'perl',
  'tableau', 'power bi', 'looker', 'dbt', 'snowflake', 'redshift',
  'salesforce', 'sap', 'oracle erp', 'workday',
];

/**
 * Get the active blocklist — uses profile-specific exclusions if available,
 * otherwise falls back to the default list.
 */
function getBlocklist(opts = {}) {
  if (opts.excludedTechnologies && Array.isArray(opts.excludedTechnologies)) {
    return opts.excludedTechnologies.map(t => t.toLowerCase());
  }
  return DEFAULT_HALLUCINATION_BLOCKLIST;
}

// LaTeX special characters that need escaping
const LATEX_UNSAFE_CHARS = /(?<!\\)[&%$#_{}]/;

/**
 * Validate a single bullet string against all rules.
 * @param {string} bullet - The bullet text to validate
 * @param {object} opts - Options { minLength, maxLength, projectKeywords }
 * @returns {{ valid: boolean, issues: string[], fixed: string }}
 */
function validateBullet(bullet, opts = {}) {
  const minLength = opts.minLength || 120;
  const maxLength = opts.maxLength || 250;
  const issues = [];
  let fixed = bullet;

  // Rule 1: Fragment Detection
  for (const pattern of FRAGMENT_PATTERNS) {
    if (pattern.test(bullet)) {
      issues.push(`FRAGMENT: Ends with incomplete word "${bullet.slice(-15)}"`);
      break;
    }
  }

  // Rule 2: Multi-Sentence Detection (more than 1 sentence-ending period)
  // Exclude common abbreviations
  const cleanForSentences = bullet
    .replace(/\b(?:e\.g\.|i\.e\.|vs\.|etc\.|Inc\.|Ltd\.|Dr\.|Mr\.|Ms\.)/gi, 'ABBR')
    .replace(/\d+\.\d+/g, 'NUM'); // decimal numbers like 99.5
  const sentenceEnds = (cleanForSentences.match(/\.\s+[A-Z]/g) || []).length;
  if (sentenceEnds > 0) {
    issues.push(`MULTI_SENTENCE: Contains ${sentenceEnds + 1} sentences (must be exactly 1)`);
  }

  // Rule 3: Character Length Check
  // Strip LaTeX bold tags for visible character count
  const visibleText = bullet.replace(/\\textbf\{([^}]+)\}/g, '$1');
  if (visibleText.length < minLength) {
    issues.push(`TOO_SHORT: ${visibleText.length} chars (min: ${minLength})`);
  }
  if (visibleText.length > maxLength) {
    issues.push(`TOO_LONG: ${visibleText.length} chars (max: ${maxLength})`);
  }

  // Rule 4: Hallucination Guard (uses dynamic blocklist from profile or defaults)
  const bulletLower = bullet.toLowerCase();
  const blocklist = getBlocklist(opts);
  for (const blocked of blocklist) {
    if (bulletLower.includes(blocked)) {
      issues.push(`HALLUCINATION: Contains "${blocked}" which is not in candidate's tech stack`);
    }
  }

  // Rule 5: LaTeX Safety
  if (LATEX_UNSAFE_CHARS.test(bullet)) {
    issues.push(`LATEX_UNSAFE: Contains unescaped special character`);
    // Auto-fix: escape the characters
    fixed = fixed.replace(/(?<!\\)&/g, '\\&');
    fixed = fixed.replace(/(?<!\\)%/g, '\\%');
    fixed = fixed.replace(/(?<!\\)\$/g, '\\$');
    fixed = fixed.replace(/(?<!\\)#/g, '\\#');
    fixed = fixed.replace(/(?<!\\)_/g, '\\_');
  }

  // Rule 6: Starts with action verb (first word should be capitalized verb)
  const firstWord = bullet.split(/\s+/)[0]?.replace(/\\textbf\{/, '');
  if (firstWord && /^[a-z]/.test(firstWord)) {
    issues.push(`WEAK_START: Bullet starts with lowercase "${firstWord}" — should start with strong action verb`);
  }

  // Rule 7: Orphan detection (last line < 10 visible chars after 84-char wrap)
  if (visibleText.length > 84) {
    const lastLineLength = visibleText.length % 84;
    if (lastLineLength > 0 && lastLineLength < 10) {
      issues.push(`ORPHAN: Last line only ${lastLineLength} chars — rephrase to fill or shorten`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    fixed: issues.length > 0 ? fixed : bullet
  };
}

/**
 * Validate all bullets in a tailored resume structure.
 * @param {object} tailoredResume - The full resume JSON (with experience and key_projects)
 * @returns {{ valid: boolean, totalIssues: number, details: object, fixedResume: object }}
 */
export function agentBulletValidator(tailoredResume) {
  const details = { experience: {}, key_projects: [] };
  let totalIssues = 0;
  let anyFixed = false;
  const fixedResume = JSON.parse(JSON.stringify(tailoredResume)); // Deep clone

  // Validate experience bullets
  if (fixedResume.experience) {
    for (const [roleKey, roleData] of Object.entries(fixedResume.experience)) {
      if (!roleData.bullets) continue;
      const bulletResults = [];
      for (let i = 0; i < roleData.bullets.length; i++) {
        const result = validateBullet(roleData.bullets[i], { minLength: 100, maxLength: 250 });
        bulletResults.push(result);
        if (!result.valid) {
          totalIssues += result.issues.length;
          fixedResume.experience[roleKey].bullets[i] = result.fixed;
          anyFixed = true;
        }
      }
      details.experience[roleKey] = bulletResults;
    }
  }

  // Validate key_projects bullets
  if (fixedResume.key_projects && Array.isArray(fixedResume.key_projects)) {
    for (let p = 0; p < fixedResume.key_projects.length; p++) {
      const project = fixedResume.key_projects[p];
      if (!project.bullets) continue;
      const bulletResults = [];
      for (let i = 0; i < project.bullets.length; i++) {
        const result = validateBullet(project.bullets[i], { minLength: 120, maxLength: 250 });
        bulletResults.push(result);
        if (!result.valid) {
          totalIssues += result.issues.length;
          fixedResume.key_projects[p].bullets[i] = result.fixed;
          anyFixed = true;
        }
      }
      details.key_projects.push({ name: project.name, bullets: bulletResults });
    }
  }

  const isValid = totalIssues === 0;

  if (!isValid) {
    console.log(`[Agent 3D Validator] Found ${totalIssues} issues across resume bullets.`);
    // Log first 5 issues for debugging
    let loggedCount = 0;
    for (const [role, results] of Object.entries(details.experience)) {
      for (const r of results) {
        if (!r.valid && loggedCount < 5) {
          console.log(`  [EXP/${role}] ${r.issues.join(', ')}`);
          loggedCount++;
        }
      }
    }
    for (const proj of details.key_projects) {
      for (const r of proj.bullets) {
        if (!r.valid && loggedCount < 5) {
          console.log(`  [PROJ/${proj.name}] ${r.issues.join(', ')}`);
          loggedCount++;
        }
      }
    }
  } else {
    console.log(`[Agent 3D Validator] ✅ All bullets passed validation.`);
  }

  return {
    valid: isValid,
    totalIssues,
    details,
    fixedResume: anyFixed ? fixedResume : tailoredResume,
    fixed: anyFixed
  };
}
