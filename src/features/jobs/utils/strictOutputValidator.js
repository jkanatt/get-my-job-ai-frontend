/**
 * strictOutputValidator.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Non-AI validator that runs AFTER every LLM generation.
 * Catches hallucinated data, quality issues, and format violations.
 * Zero API calls. Deterministic. <5ms.
 */

// Strong action verbs that signal good bullet quality
const STRONG_ACTION_VERBS = new Set([
  'achieved', 'accelerated', 'architected', 'automated', 'built', 'championed',
  'consolidated', 'created', 'defined', 'delivered', 'designed', 'developed',
  'directed', 'drove', 'eliminated', 'enabled', 'engineered', 'established',
  'executed', 'expanded', 'formulated', 'generated', 'grew', 'identified',
  'implemented', 'improved', 'increased', 'initiated', 'innovated', 'integrated',
  'launched', 'led', 'managed', 'migrated', 'optimized', 'orchestrated',
  'originated', 'owned', 'partnered', 'pioneered', 'reduced', 'redesigned',
  'refactored', 'resolved', 'revamped', 'scaled', 'secured', 'shipped',
  'simplified', 'spearheaded', 'streamlined', 'strengthened', 'structured',
  'surpassed', 'tracked', 'transformed', 'unified', 'upgraded',
]);

// Metric indicators that signal quantitative results
const METRIC_PATTERNS = [
  /\d+[%xX]/, /\$[\d,]+/, /\d+[KkMmBb]\+?/, /\d+\+/, /\d+\s*(users|clients|customers|members)/i,
  /\d+\s*(days|weeks|months|hours)/i, /\d+\s*(teams?|engineers?|developers?)/i,
  /\d+\s*(products?|features?|platforms?)/i, /\d+\s*(countries|cities|regions)/i,
  /\d+\s*(stars?|rating)/i, /ROI/i, /NPS/i, /MRR/i, /ARR/i, /DAU/i, /MAU/i,
  /\d+\.\d+/, /\d+,\d+/,
];

/**
 * Strip LaTeX markup for visible character counting.
 */
function stripLatex(str) {
  return (str || '')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\hlink\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\item\s*/g, '')
    .replace(/\\noindent\s*/g, '')
    .replace(/\\{1,2}/g, '')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_');
}

/**
 * Validates bullet quality across resume sections.
 * @param {string[]} bullets - Array of bullet strings
 * @param {string} sectionName - For error reporting
 * @returns {{ valid: boolean, violations: Object[], score: number }}
 */
export function validateBulletQuality(bullets, sectionName = 'unknown') {
  const violations = [];
  let totalScore = 0;

  if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
    violations.push({ type: 'empty_section', section: sectionName, message: 'No bullets found.' });
    return { valid: false, violations, score: 0 };
  }

  for (let i = 0; i < bullets.length; i++) {
    const bullet = bullets[i];
    const visible = stripLatex(bullet);
    let bulletScore = 0;

    // Check 1: Not starting with "I"
    if (/^\s*I\s/.test(visible)) {
      violations.push({ type: 'passive_voice', index: i, section: sectionName, message: `Bullet starts with "I": "${visible.substring(0, 60)}..."` });
    } else {
      bulletScore += 10;
    }

    // Check 2: Has strong action verb
    const firstWord = visible.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (STRONG_ACTION_VERBS.has(firstWord)) {
      bulletScore += 20;
    } else {
      violations.push({ type: 'weak_action_verb', index: i, section: sectionName, message: `Weak opening verb "${firstWord}": "${visible.substring(0, 60)}..."` });
    }

    // Check 3: Has metrics
    const hasMetric = METRIC_PATTERNS.some(pat => pat.test(visible));
    if (hasMetric) {
      bulletScore += 30;
    } else {
      violations.push({ type: 'no_metric', index: i, section: sectionName, message: `No metric found: "${visible.substring(0, 60)}..."` });
    }

    // Check 4: Optimal line width (80-84 or 164-250)
    const visLen = visible.length;
    if ((visLen >= 80 && visLen <= 90) || (visLen >= 160 && visLen <= 250)) {
      bulletScore += 20;
    } else if (visLen > 10 && visLen < 75) {
      violations.push({ type: 'suboptimal_width', index: i, section: sectionName, message: `Too short (${visLen} chars): "${visible.substring(0, 60)}..."` });
    } else if (visLen > 90 && visLen < 155) {
      violations.push({ type: 'suboptimal_width', index: i, section: sectionName, message: `Awkward wrap (${visLen} chars): "${visible.substring(0, 60)}..."` });
    } else {
      bulletScore += 10; // Acceptable but not perfect
    }

    // Check 5: Not too short or empty
    if (visLen < 30) {
      violations.push({ type: 'too_short', index: i, section: sectionName, message: `Bullet too short (${visLen} chars).` });
    } else {
      bulletScore += 10;
    }

    // Check 6: No duplicate bullets
    for (let j = 0; j < i; j++) {
      const otherVisible = stripLatex(bullets[j]);
      if (visible === otherVisible) {
        violations.push({ type: 'duplicate', index: i, section: sectionName, message: `Exact duplicate of bullet ${j}.` });
      } else {
        // Check near-duplicate (first 40 chars match)
        if (visible.substring(0, 40) === otherVisible.substring(0, 40)) {
          violations.push({ type: 'near_duplicate', index: i, section: sectionName, message: `Near-duplicate of bullet ${j}: same opening.` });
        }
      }
    }

    totalScore += bulletScore;
  }

  const maxScore = bullets.length * 90; // Max possible: 10+20+30+20+10
  const normalizedScore = Math.round((totalScore / maxScore) * 100);

  return {
    valid: violations.filter(v => v.type !== 'suboptimal_width' && v.type !== 'no_metric').length === 0,
    violations,
    score: normalizedScore,
  };
}

/**
 * Validates that skills in resume output exist in the brain's skill pools.
 * @param {Object} outputSkills - Skills section from LLM output
 * @param {Object} brain - The obsidian brain with skill_pools and profile
 * @returns {{ valid: boolean, violations: Object[] }}
 */
export function validateSkillsIntegrity(outputSkills, brain) {
  const violations = [];

  if (!outputSkills || typeof outputSkills !== 'object') {
    return { valid: true, violations }; // No skills to validate
  }

  // Build a master set of known skills from brain
  const knownSkills = new Set();
  
  // From skill_pools
  if (brain?.skill_pools) {
    for (const pool of Object.values(brain.skill_pools)) {
      if (Array.isArray(pool)) {
        pool.forEach(s => knownSkills.add(s.toLowerCase().trim()));
      }
    }
  }

  // From profile skills_summary blocks
  if (brain?.profile?.skills_summary?.blocks) {
    for (const blockStr of Object.values(brain.profile.skills_summary.blocks)) {
      if (typeof blockStr === 'string') {
        blockStr.split(',').forEach(s => knownSkills.add(s.toLowerCase().trim()));
      }
    }
  }

  // Check each skill in output against known skills
  for (const [category, skills] of Object.entries(outputSkills)) {
    if (Array.isArray(skills)) {
      for (const skill of skills) {
        const lower = (typeof skill === 'string' ? skill : '').toLowerCase().trim();
        // Only flag if we have a populated known skills set (>10 skills)
        if (knownSkills.size > 10 && !knownSkills.has(lower)) {
          // Soft check: see if any known skill contains this as a substring
          const partialMatch = [...knownSkills].some(ks => ks.includes(lower) || lower.includes(ks));
          if (!partialMatch) {
            violations.push({ type: 'unknown_skill', category, skill, message: `Skill "${skill}" not found in brain skill pools.` });
          }
        }
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Validates that project names in the resume match the brain's project registry.
 * @param {Array} outputProjects - Key projects from LLM output
 * @param {Object} brain - The obsidian brain
 * @returns {{ valid: boolean, violations: Object[] }}
 */
export function validateProjectRegistry(outputProjects, brain) {
  const violations = [];

  if (!outputProjects || !Array.isArray(outputProjects) || outputProjects.length === 0) {
    return { valid: true, violations };
  }

  const knownNames = new Set((brain?.projects || []).map(p => p.name?.toLowerCase().trim()));

  for (const proj of outputProjects) {
    const name = (proj.name || '').toLowerCase().trim();
    if (name && !knownNames.has(name)) {
      // Fuzzy check: see if brain has a project with similar name
      const fuzzyMatch = [...knownNames].some(kn => kn.includes(name) || name.includes(kn));
      if (!fuzzyMatch) {
        violations.push({ type: 'hallucinated_project', name: proj.name, message: `Project "${proj.name}" not found in brain registry.` });
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Master output validation. Runs ALL validators on LLM output.
 * @param {Object} resumeJSON - The LLM-generated resume JSON
 * @param {Object} brain - The obsidian brain
 * @returns {{ valid: boolean, violations: Object[], score: number }}
 */
export function runOutputValidation(resumeJSON, brain) {
  const allViolations = [];
  let totalScore = 100;

  // Validate experience bullets
  if (resumeJSON.experience) {
    for (const [key, exp] of Object.entries(resumeJSON.experience)) {
      if (typeof exp === 'object' && exp !== null) {
        const bullets = [];
        for (let i = 1; i <= 4; i++) {
          if (exp[`bullet${i}`]) bullets.push(exp[`bullet${i}`]);
        }
        if (exp.bullets && Array.isArray(exp.bullets)) bullets.push(...exp.bullets);
        if (bullets.length > 0) {
          const result = validateBulletQuality(bullets, `experience.${key}`);
          allViolations.push(...result.violations);
          totalScore = Math.min(totalScore, result.score);
        }
      }
    }
  }

  // Validate project bullets
  if (resumeJSON.key_projects) {
    for (let i = 0; i < resumeJSON.key_projects.length; i++) {
      const proj = resumeJSON.key_projects[i];
      if (proj.bullets && proj.bullets.length > 0) {
        const result = validateBulletQuality(proj.bullets, `key_projects[${i}]`);
        allViolations.push(...result.violations);
        totalScore = Math.min(totalScore, result.score);
      }
    }
    // Validate project registry
    const regResult = validateProjectRegistry(resumeJSON.key_projects, brain);
    allViolations.push(...regResult.violations);
  }

  // Validate skills integrity
  if (resumeJSON.skills) {
    const skillResult = validateSkillsIntegrity(resumeJSON.skills, brain);
    allViolations.push(...skillResult.violations);
  }

  // Log results
  const fatalViolations = allViolations.filter(v => v.type === 'hallucinated_project' || v.type === 'duplicate' || v.type === 'passive_voice');
  const warnings = allViolations.filter(v => !fatalViolations.includes(v));

  if (fatalViolations.length > 0) {
    console.error(`[OutputValidator] ❌ ${fatalViolations.length} FATAL violations:`);
    fatalViolations.forEach(v => console.error(`  [${v.type}] ${v.message}`));
  }
  if (warnings.length > 0) {
    console.warn(`[OutputValidator] ⚠️  ${warnings.length} quality warnings:`);
    warnings.slice(0, 10).forEach(v => console.warn(`  [${v.type}] ${v.message}`));
    if (warnings.length > 10) console.warn(`  ... and ${warnings.length - 10} more.`);
  }
  if (allViolations.length === 0) {
    console.log(`[OutputValidator] ✅ All output checks passed. Quality score: ${totalScore}/100.`);
  }

  return {
    valid: fatalViolations.length === 0,
    violations: allViolations,
    score: totalScore,
  };
}
