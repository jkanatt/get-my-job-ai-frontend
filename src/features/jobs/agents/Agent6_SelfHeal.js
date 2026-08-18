import path from 'path';
import { resumeToPlainText } from '@/features/jobs/utils/nlpScorer';
import { parseLatexLayout } from '@/infrastructure/services/latexParser';
import { measureTextWidth } from '@/infrastructure/services/latexMetrics';
import { optimizeBulletWidth } from '@/infrastructure/services/contentFitEngine';

/**
 * M5: Dynamically discover all string[] skill arrays in the resume structure.
 * Walks the object tree up to 3 levels deep, collecting arrays of short strings
 * (likely skill tags rather than bullet descriptions).
 */
function _discoverSkillArrays(obj, parentPath = [], depth = 0) {
  if (depth > 3 || !obj || typeof obj !== 'object') return [];
  const results = [];
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const currentPath = [...parentPath, key];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
      // Heuristic: skill arrays have short strings (< 60 chars avg) and no bullet-like content
      const avgLen = val.reduce((sum, s) => sum + s.length, 0) / val.length;
      if (avgLen < 60 && !val.some(s => /^\s*[-•]/.test(s))) {
        results.push({ path: currentPath, maxItems: Math.max(val.length + 4, 16) });
      }
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      results.push(..._discoverSkillArrays(val, currentPath, depth + 1));
    }
  }
  return results;
}

/**
 * Mine experience_detailed[] for the most relevant achievement bullets.
 * Returns top 15 bullets ranked by keyword overlap with the JD.
 */
function _mineExperienceDetailed(experienceDetailed, priorityMissing, domain) {
  const scored = [];
  const kwLower = priorityMissing.map(k => k.toLowerCase());

  for (const exp of experienceDetailed) {
    const achievements = exp.achievements || [];
    
    for (const bullet of achievements) {
      const bulletLower = bullet.toLowerCase();
      let score = 0;

      for (const kw of kwLower) {
        if (bulletLower.includes(kw)) score += 2;
      }

      scored.push({
        bullet,
        score,
        company: exp.company || '',
        role: exp.role || ''
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * AGENT 6: Self-Healing Loop (zero-cost, deterministic)
 */
export async function agentSelfHeal(tailoredResume, validation, brain, jdIntel) {
  const resumeCopy = JSON.parse(JSON.stringify(tailoredResume));
  const fixes = [];
  const missingKws = validation.missing_keywords || [];
  const missingMustHaves = validation.missing_must_haves || [];

  // Priority: fix must-haves first, then other missing keywords
  const priorityMissing = [...missingMustHaves, ...missingKws.filter(k => !missingMustHaves.includes(k))];

  // ── Strategy 1: Inject missing keywords into skills arrays ──
  // M5: Dynamically discover skill arrays from the resume structure
  const skillArrays = _discoverSkillArrays(resumeCopy);

  // Check which keywords could be injected as skills
  const allExistingSkills = new Set();
  for (const { path: p } of skillArrays) {
    const arr = p.reduce((o, k) => o?.[k], resumeCopy);
    if (Array.isArray(arr)) arr.forEach(s => allExistingSkills.add(s.toLowerCase().replace(/\\/g, '').replace(/\&/g, '&').trim()));
  }

  for (const kw of priorityMissing.slice(0, 15)) {
    if (allExistingSkills.has(kw.toLowerCase())) continue;

    // Try to find a skill array with room or swap the least relevant item
    for (const { path: p, maxItems } of skillArrays) {
      const parent = p.slice(0, -1).reduce((o, k) => o?.[k], resumeCopy);
      const key = p[p.length - 1];
      if (!parent) continue;
      if (!Array.isArray(parent[key])) {
        parent[key] = [];
      }

      const arr = parent[key];
      if (arr.length < maxItems) {
        // Room to add
        arr.push(kw);
        fixes.push({ action: 'added_skill', keyword: kw, section: p.join('.') });
        allExistingSkills.add(kw.toLowerCase());
        break;
      }
    }
  }

  // ── Strategy 2: Swap project bullets to inject missing keywords ──
  if (resumeCopy.key_projects && Array.isArray(resumeCopy.key_projects)) {
    const achievementPool = _mineExperienceDetailed(brain.experience_detailed || [], priorityMissing, jdIntel.domain || 'general');

    // Cache plaintext once before the loop, regenerate only after modifications
    let cachedPlainText = resumeToPlainText(resumeCopy).toLowerCase();
    for (const kw of priorityMissing.slice(0, 8)) {
      // Check if keyword is already present after skills injection
      if (cachedPlainText.includes(kw.toLowerCase())) continue;

      // Find a brain bullet that contains this keyword
      const matchingBullet = achievementPool.find(a =>
        a.bullet.toLowerCase().includes(kw.toLowerCase())
      );

      if (matchingBullet) {
        // Find the weakest project bullet and swap it
        let weakestBulletIdx = -1;
        let weakestProjectIdx = -1;
        let lowestScore = Infinity;

        for (let pi = 0; pi < resumeCopy.key_projects.length; pi++) {
          const bullets = resumeCopy.key_projects[pi].bullets || [];
          for (let bi = 0; bi < bullets.length; bi++) {
            const bulletText = bullets[bi].toLowerCase();
            let score = 0;
            for (const k of priorityMissing) {
              if (bulletText.includes(k.toLowerCase())) score++;
            }
            if (!/\d/.test(bullets[bi])) score -= 2; // Penalize bullets without numbers
            if (score < lowestScore) {
              lowestScore = score;
              weakestBulletIdx = bi;
              weakestProjectIdx = pi;
            }
          }
        }

        if (weakestProjectIdx >= 0 && weakestBulletIdx >= 0) {
          // Apply strict Agent 3B constraints to the swapped bullet
          let newBullet = matchingBullet.bullet;
          
          // Layout constraints
          const texPath = path.join(process.cwd(), 'joshua_kanatt_resume.tex');
          const layout = parseLatexLayout(texPath) || { lineWidthPt: 503, font: 'Helvetica', fontSize: 11 };
          let currentWidthPt = measureTextWidth(newBullet, layout.fontFamily, layout.fontSize);
          
          newBullet = await optimizeBulletWidth(newBullet, currentWidthPt, layout.lineWidthPt);
          
          newBullet = newBullet.replace(/\\s+/g, ' ').replace(/\\*\\*\\*\\*/g, '');
          const oldBullet = resumeCopy.key_projects[weakestProjectIdx].bullets[weakestBulletIdx];
          resumeCopy.key_projects[weakestProjectIdx].bullets[weakestBulletIdx] = newBullet;
          cachedPlainText = resumeToPlainText(resumeCopy).toLowerCase(); // Refresh cache after swap
          fixes.push({
            action: 'swapped_bullet',
            keyword: kw,
            project: resumeCopy.key_projects[weakestProjectIdx].name,
            old: oldBullet?.substring(0, 60) + '...',
            new: newBullet.substring(0, 60) + '...'
          });
        }
      }
    }
  }

  return { data: resumeCopy, fixes };
}
