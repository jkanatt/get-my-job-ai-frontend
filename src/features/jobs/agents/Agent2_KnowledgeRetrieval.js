// src/features/jobs/agents/Agent2_KnowledgeRetrieval.js

/**
 * Mine experience_detailed[] for the most relevant achievement bullets.
 * Returns top 15 bullets ranked by keyword overlap with the JD.
 */
function _mineExperienceDetailed(experienceDetailed, allKeywords, domain) {
  const scored = [];
  const kwLower = allKeywords.map(k => k.toLowerCase());

  for (const exp of experienceDetailed) {
    const achievements = exp.achievements || [];
    const tags = (exp.tags || []).map(t => t.toLowerCase());

    // V3: Tag-based experience-level boosting
    let expTagBonus = 0;
    for (const tag of tags) {
      for (const kw of kwLower) {
        if (tag.includes(kw) || kw.includes(tag)) {
          expTagBonus += 3; // Strong signal — tag explicitly matches JD keyword
          break;
        }
      }
    }
    // Cap tag bonus per experience to prevent one heavily-tagged role from dominating
    expTagBonus = Math.min(expTagBonus, 12);

    for (const bullet of achievements) {
      const bulletLower = bullet.toLowerCase();
      let score = 0;

      // Count keyword hits in this bullet
      for (const kw of kwLower) {
        if (bulletLower.includes(kw)) score += 2;
      }

      // Bonus for bullets with metrics
      if (/\d+/.test(bullet)) score += 3;
      if (/\d+[%xX×]/.test(bullet)) score += 2;
      if (/\$[\d,.]+|\d+[KkMmBb]\+?|Rs\.?\s*[\d,.]+|\d+\s*Cr/.test(bullet)) score += 2;

      // Bonus for matching domain tags (original)
      for (const tag of tags) {
        if (tag.includes(domain.toLowerCase()) || kwLower.some(k => tag.includes(k))) {
          score += 1;
        }
      }

      // V3: Apply experience-level tag bonus to all bullets from this role
      score += Math.round(expTagBonus / Math.max(achievements.length, 1));

      scored.push({
        bullet,
        score,
        company: exp.company || '',
        role: exp.role || ''
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 15);
}

/**
 * Mine profile data for relevant career highlights, achievements, and consulting summary.
 */
function _mineProfileData(profile, allKeywords, domain) {
  const kwLower = allKeywords.map(k => k.toLowerCase());
  const ammo = {
    top_highlights: [],
    relevant_achievements: [],
    consulting_context: profile.consulting_summary || [],
    leadership_context: profile.leadership_summary || [],
    recognition_items: []
  };

  // Score career highlights
  const highlights = profile.career_highlights || [];
  const scoredHighlights = highlights.map(h => {
    let score = 0;
    const hLower = h.toLowerCase();
    for (const kw of kwLower) { if (hLower.includes(kw)) score++; }
    if (/\\d+/.test(h)) score += 2;
    return { text: h, score };
  });
  scoredHighlights.sort((a, b) => b.score - a.score);
  ammo.top_highlights = scoredHighlights.slice(0, 4).map(h => h.text);

  // Score achievements
  const achievements = profile.achievements || [];
  const scoredAch = achievements.map(a => {
    let score = 0;
    const aLower = a.toLowerCase();
    for (const kw of kwLower) { if (aLower.includes(kw)) score++; }
    return { text: a, score };
  });
  scoredAch.sort((a, b) => b.score - a.score);
  ammo.relevant_achievements = scoredAch.slice(0, 4).map(a => a.text);

  // Score recognition items
  const recognition = profile.recognition || [];
  const scoredRec = recognition.map(r => {
    let score = 0;
    const desc = (r.description || '').toLowerCase();
    for (const kw of kwLower) { if (desc.includes(kw)) score++; }
    // Boost startup/incubation recognition if domain is startup-related
    if (['startup', 'incubat', 'stanford', 'entrepreneur'].some(t => desc.includes(t))) score += 2;
    return { ...r, score };
  });
  scoredRec.sort((a, b) => b.score - a.score);
  ammo.recognition_items = scoredRec.slice(0, 4);

  return ammo;
}

/**
 * Match skill blocks from brain.profile.skills_summary.blocks against the domain and keywords.
 * UNIVERSAL: Uses pure keyword matching instead of hardcoded domain affinity.
 * Works for ANY industry, ANY role type.
 */
function _matchSkillBlocks(blocks, domain, allKeywords) {
  const kwLower = allKeywords.map(k => k.toLowerCase());
  const domainLower = (domain || 'general').toLowerCase();
  const matched = {};

  for (const [blockName, skillsStr] of Object.entries(blocks)) {
    // Handle both string and array formats
    const skills = typeof skillsStr === 'string'
      ? skillsStr.split(',').map(s => s.trim())
      : Array.isArray(skillsStr) ? skillsStr : [];
    let relevance = 0;

    // Pure keyword overlap scoring — universally works for ANY domain
    for (const skill of skills) {
      const skillLower = skill.toLowerCase();
      for (const kw of kwLower) {
        if (skillLower.includes(kw) || kw.includes(skillLower)) {
          relevance += 2; // Strong match
          break;
        }
      }
    }

    // Bonus: if the block name itself contains domain-relevant words
    const blockLower = blockName.toLowerCase();
    if (blockLower.includes(domainLower) || domainLower.includes(blockLower)) {
      relevance += 3;
    }
    // Also check if any JD keyword matches the block name
    for (const kw of kwLower) {
      if (blockLower.includes(kw)) { relevance += 1; break; }
    }

    // Always include blocks with at least some relevance
    if (relevance > 0) {
      matched[blockName] = { skills, relevance };
    }
  }

  // Return top matching blocks' skills ranked by relevance
  const sorted = Object.entries(matched).sort((a, b) => b[1].relevance - a[1].relevance);
  const topSkills = [];
  for (const [, data] of sorted.slice(0, 5)) {
    topSkills.push(...data.skills);
  }
  return [...new Set(topSkills)];
}

/**
 * AGENT 2: Knowledge Retrieval (Vector + Keyword + RLHF)
 */
export async function agentKnowledgeRetrieval(jdText, jdIntel, brain, domain, userId) {
  const allKeywords = jdIntel.all_keywords || [];
  const seniority = jdIntel.seniority || 'Senior';

  // Fix #9: Load RLHF weights to boost projects/keywords that led to past interviews
  let rlhfWeights = { keywordWeights: {}, projectWeights: {} };
  if (userId && userId !== 'anonymous') {
    try {
      const { getRLHFWeights } = await import('@/infrastructure/services/rlhfTracker');
      rlhfWeights = await getRLHFWeights(userId);
    } catch (e) {
      console.warn('[RLHF] Could not load weights (non-fatal):', e.message);
    }
  }

  // ── 1. Rank and select projects (V3: LLM Relevance & Impact Scoring via Vector Brain) ──
  // We use the centralized vectorBrainRetrieval which now performs LLM scoring
  const { vectorBrainRetrieval } = await import('@/infrastructure/services/vectorBrain.js');
  let projectRankings = await vectorBrainRetrieval(jdText, jdIntel, brain, brain.projects?.length || 50);

  // Apply RLHF project weight boosts
  for (const p of projectRankings) {
    const rlhfBoost = rlhfWeights.projectWeights[p.id] || 0;
    if (rlhfBoost > 0) {
      p.combined_score += rlhfBoost * 0.2; // Scale RLHF weight to a reasonable boost
    }
  }

  // Boost projects that match the domain_index
  const domainProjects = new Set();
  for (const [domainKey, projectIds] of Object.entries(brain.domain_index || {})) {
    if (
      domainKey.toLowerCase().includes(domain.toLowerCase()) ||
      domain.toLowerCase().includes(domainKey.toLowerCase())
    ) {
      projectIds.forEach(id => domainProjects.add(id));
    }
  }

  projectRankings.forEach(p => {
    if (domainProjects.has(p.id)) p.combined_score += 3; // Boost domain matches heavily
  });

  // Rank all available projects using these scores and automatically select the highest-ranked projects
  projectRankings.sort((a, b) => b.combined_score - a.combined_score);

  // ── Knowledge Graph Parallel Signal (if available) ──
  try {
    const { KnowledgeGraph, graphAwareProjectSelection } = await import('@/infrastructure/services/knowledgeGraph');
    const kg = KnowledgeGraph.load();
    if (kg && kg.nodes.size > 0) {
      const kgRanked = graphAwareProjectSelection(kg, { domain, keywords: allKeywords }, 8);
      // Boost projects that the KG also ranks highly
      for (const kgProj of kgRanked) {
        const match = projectRankings.find(p => p.id === kgProj.id);
        if (match) {
          match.combined_score += (kgProj.score || 1) * 0.5; // KG contributes 50% weight
        }
      }
      projectRankings.sort((a, b) => b.combined_score - a.combined_score);
    }
  } catch (kgErr) {
    // KG is optional — pipeline continues without it
  }

  // Retrieve exactly the Top 4 projects based on JD relevance scoring
  const maxSupport = Math.min(4, brain.projects?.length || 0);
  const topProjectsIds = projectRankings.slice(0, maxSupport).map(p => p.id);
  const selectedProjects = topProjectsIds.map(id =>
    brain.projects.find(p => p.id === id)
  ).filter(Boolean);

  // ── 2. Mine experience_detailed for best achievement bullets ──
  const bestAchievements = _mineExperienceDetailed(brain.experience_detailed || [], allKeywords, domain);

  // ── 3. Mine profile data ──
  const profileAmmo = _mineProfileData(brain.profile || {}, allKeywords, domain);

  // ── 4. Select domain-specific skill pool from brain.skills_summary.blocks ──
  const brainSkillBlocks = _matchSkillBlocks(brain.profile?.skills_summary?.blocks || {}, domain, allKeywords);

  // ── 5. Experience variants (UNIVERSAL — dynamically reads ALL companies) ──
  const companyVariants = {};
  for (const [companyKey, variants] of Object.entries(brain.experience_variants || {})) {
    if (companyKey === 'summary') continue;
    companyVariants[companyKey] = variants[domain] || variants.general || {};
  }
  const summaryVariant = brain.experience_variants?.summary?.[domain] || brain.experience_variants?.summary?.general || {};

  // ── 6. Domain header and skills ──
  const domainHeader = brain.domain_headers?.[domain] || brain.domain_headers?.general || 'Product \\& Technology Domain';
  const domainSkillPool = brain.skill_pools?.domain_skills?.[domain] || brain.skill_pools?.domain_skills?.[Object.keys(brain.skill_pools?.domain_skills || {})[0]] || [];

  return {
    selected_project_ids: topProjectsIds,
    selected_projects: selectedProjects,
    project_rankings: projectRankings.slice(0, 10),
    domain,
    seniority,
    domain_header: domainHeader,
    domain_skill_pool: domainSkillPool,
    brain_skill_blocks: brainSkillBlocks,
    best_achievements: bestAchievements,
    profile_ammo: profileAmmo,
    company_variants: companyVariants,
    summary_variant: summaryVariant
  };
}
