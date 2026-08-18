import { DynamoDBAdapter } from '@/infrastructure/database/dynamodb-adapter';

/**
 * rlhfTracker.js — Reinforcement Learning from Human Feedback
 * Phase 4: Non-linear Continuous Learning
 * 
 * Tracks which keywords and projects successfully lead to interview conversions,
 * adjusting their weights for future resume generations.
 * 
 * Uses DynamoDBAdapter (Supabase-compatible query builder) for all DB operations.
 */

function getDB() {
  return new DynamoDBAdapter();
}

export async function trackRLHFSuccess(userId, jobId, keywords, projectIds, atsScore, interviewGranted, dbClient = null) {
  try {
    const db = dbClient || getDB();
    
    // Calculate the weight adjustment based on outcome
    // If they got an interview, keywords get a massive +1.5 boost
    // If they just got a high ATS score but no outcome yet, slight +0.1 bump
    let weightAdjustment = 0;
    if (interviewGranted) {
      weightAdjustment = 1.5;
    } else if (atsScore > 85) {
      weightAdjustment = 0.1;
    }

    if (weightAdjustment === 0) return;

    // 1. Update Keyword Weights
    for (const kw of keywords) {
      const { data: existingKw } = await db
        .from('rlhf_keywords')
        .select('*')
        .eq('user_id', userId)
        .eq('keyword', kw)
        .single();

      if (existingKw) {
        // Apply 0.9 decay to the bonus portion of the weight to prevent runaway weights
        const currentBonus = Math.max(0, (existingKw.weight || 1.0) - 1.0);
        const newWeight = 1.0 + (currentBonus * 0.9) + weightAdjustment;

        await db
          .from('rlhf_keywords')
          .update({ 
            weight: newWeight,
            success_count: (existingKw.success_count || 0) + (interviewGranted ? 1 : 0)
          })
          .eq('id', existingKw.id);
      } else {
        await db
          .from('rlhf_keywords')
          .insert({
            user_id: userId,
            keyword: kw,
            weight: 1.0 + weightAdjustment,
            success_count: interviewGranted ? 1 : 0
          });
      }
    }

    // 2. Update Project Weights
    for (const pid of projectIds) {
      const { data: existingProj } = await db
        .from('rlhf_projects')
        .select('*')
        .eq('user_id', userId)
        .eq('project_id', pid)
        .single();

      if (existingProj) {
        // Apply 0.9 decay to the bonus portion of the weight
        const currentBonus = Math.max(0, (existingProj.weight || 1.0) - 1.0);
        const newWeight = 1.0 + (currentBonus * 0.9) + weightAdjustment;

        await db
          .from('rlhf_projects')
          .update({ 
            weight: newWeight,
            success_count: (existingProj.success_count || 0) + (interviewGranted ? 1 : 0)
          })
          .eq('id', existingProj.id);
      } else {
        await db
          .from('rlhf_projects')
          .insert({
            user_id: userId,
            project_id: pid,
            weight: 1.0 + weightAdjustment,
            success_count: interviewGranted ? 1 : 0
          });
      }
    }

    console.log(`[RLHF] Adjusted weights for ${keywords.length} keywords and ${projectIds.length} projects. (Adjustment: +${weightAdjustment})`);
  } catch (error) {
    console.error("[RLHF] Failed to track feedback:", error.message);
  }
}

/**
 * Retrieves the RLHF weights to boost the ATS targeting process.
 * Returns { keywordWeights: { keyword: weight }, projectWeights: { projectId: weight } }
 */
export async function getRLHFWeights(userId) {
  try {
    const db = getDB();
    
    const { data: keywords } = await db
      .from('rlhf_keywords')
      .select('keyword, weight')
      .eq('user_id', userId);

    const { data: projects } = await db
      .from('rlhf_projects')
      .select('project_id, weight')
      .eq('user_id', userId);

    const keywordWeights = {};
    const projectWeights = {};

    (keywords || []).forEach(k => { keywordWeights[k.keyword] = k.weight; });
    (projects || []).forEach(p => { projectWeights[p.project_id] = p.weight; });

    return { keywordWeights, projectWeights };
  } catch (error) {
    console.error("[RLHF] Failed to fetch weights:", error.message);
    return { keywordWeights: {}, projectWeights: {} };
  }
}
