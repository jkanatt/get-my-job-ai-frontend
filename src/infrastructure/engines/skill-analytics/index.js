/**
 * Skill Gap Analytics Engine
 * ==========================
 * Aggregates required skills across all discovered jobs, compares against
 * the user's profile, and generates a prioritized gap report with learning
 * recommendations.
 *
 * Architecture:
 *   1. Pull all jobs from Supabase (with relevance_score > threshold)
 *   2. Aggregate skill frequency across jobs
 *   3. Load user profile skills
 *   4. Compute gap = demanded skills NOT in user profile
 *   5. Rank gaps by frequency × avg relevance score
 *   6. Return structured report
 */

/**
 * Normalizes a skill name for comparison.
 * e.g., "React.js" → "react", "Amazon Web Services" → "aws"
 */
function normalizeSkill(skill) {
  if (!skill) return '';
  const aliases = {
    'react.js': 'react', 'reactjs': 'react', 'react js': 'react',
    'node.js': 'nodejs', 'node js': 'nodejs',
    'amazon web services': 'aws', 'google cloud platform': 'gcp',
    'google cloud': 'gcp', 'microsoft azure': 'azure',
    'machine learning': 'ml', 'artificial intelligence': 'ai',
    'typescript': 'typescript', 'ts': 'typescript',
    'javascript': 'javascript', 'js': 'javascript',
    'postgresql': 'postgres', 'mongo db': 'mongodb',
    'ci/cd': 'cicd', 'ci cd': 'cicd',
    'product management': 'product_management',
    'project management': 'project_management',
    'data science': 'data_science', 'data analysis': 'data_analysis',
  };

  const lower = skill.toLowerCase().trim();
  return aliases[lower] || lower.replace(/[^a-z0-9+#.]/g, '_').replace(/_+/g, '_');
}

/**
 * Groups similar skills together for better analysis.
 */
function getSkillCategory(normalizedSkill) {
  const categories = {
    'Programming Languages': ['python', 'javascript', 'typescript', 'java', 'go', 'rust', 'c++', 'ruby', 'swift', 'kotlin', 'php', 'scala', 'r'],
    'Frontend': ['react', 'angular', 'vue', 'svelte', 'nextjs', 'html', 'css', 'tailwind', 'sass'],
    'Backend': ['nodejs', 'django', 'flask', 'fastapi', 'spring', 'express', 'rails', 'graphql', 'rest'],
    'Cloud & Infra': ['aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'cicd', 'jenkins', 'github_actions'],
    'Data & ML': ['sql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'spark', 'ml', 'ai', 'tensorflow', 'pytorch', 'pandas', 'bigquery', 'data_science'],
    'Product & Strategy': ['product_management', 'product_strategy', 'roadmap', 'agile', 'scrum', 'jira', 'okrs', 'stakeholder_management'],
    'Design': ['figma', 'sketch', 'design_thinking', 'user_research', 'ux', 'ui'],
  };

  for (const [category, skills] of Object.entries(categories)) {
    if (skills.includes(normalizedSkill)) return category;
  }
  return 'Other';
}

/**
 * Analyzes the skill gap between market demand and user profile.
 *
 * @param {Array<Object>} jobs - Array of jobs from DB with { skills: string[], relevance_score: number, title: string }
 * @param {Array<string>} userSkills - User's profile skills
 * @param {Object} options
 * @param {number} [options.minFrequency=2] - Minimum occurrences to include in report
 * @param {number} [options.topN=20] - Max number of gaps to return
 * @returns {Object} Gap analysis report
 */
export function analyzeSkillGap(jobs, userSkills = [], options = {}) {
  const { minFrequency = 2, topN = 20 } = options;

  // Normalize user skills
  const userSkillSet = new Set(userSkills.map(normalizeSkill).filter(Boolean));

  // Aggregate skill demand across all jobs
  const skillDemand = {}; // { normalizedSkill: { count, totalRelevance, jobs: [{title, score}] } }
  let totalJobs = 0;

  for (const job of jobs) {
    if (!job.skills || !Array.isArray(job.skills)) continue;
    totalJobs++;

    const seenInJob = new Set(); // prevent double-counting within one job
    for (const rawSkill of job.skills) {
      const normalized = normalizeSkill(rawSkill);
      if (!normalized || normalized.length < 2) continue;
      if (seenInJob.has(normalized)) continue;
      seenInJob.add(normalized);

      if (!skillDemand[normalized]) {
        skillDemand[normalized] = { raw: rawSkill, count: 0, totalRelevance: 0, jobs: [] };
      }
      skillDemand[normalized].count++;
      skillDemand[normalized].totalRelevance += (job.relevance_score || 50);
      if (skillDemand[normalized].jobs.length < 5) {
        skillDemand[normalized].jobs.push({ title: job.title, score: job.relevance_score });
      }
    }
  }

  // Separate into "have" and "gap"
  const haveSkills = [];
  const gapSkills = [];

  for (const [normalized, data] of Object.entries(skillDemand)) {
    if (data.count < minFrequency) continue;

    const entry = {
      skill: data.raw,
      normalized,
      category: getSkillCategory(normalized),
      frequency: data.count,
      percentage: Math.round((data.count / totalJobs) * 100),
      avgRelevance: Math.round(data.totalRelevance / data.count),
      priority: Math.round((data.count / totalJobs) * (data.totalRelevance / data.count)),
      exampleJobs: data.jobs,
    };

    if (userSkillSet.has(normalized)) {
      haveSkills.push(entry);
    } else {
      gapSkills.push(entry);
    }
  }

  // Sort gaps by priority (frequency × avg relevance), descending
  gapSkills.sort((a, b) => b.priority - a.priority);
  haveSkills.sort((a, b) => b.frequency - a.frequency);

  // Group gaps by category
  const gapsByCategory = {};
  for (const gap of gapSkills.slice(0, topN)) {
    if (!gapsByCategory[gap.category]) gapsByCategory[gap.category] = [];
    gapsByCategory[gap.category].push(gap);
  }

  // Coverage score: what % of demanded skills does the user already have?
  const totalDemanded = Object.keys(skillDemand).filter(s => skillDemand[s].count >= minFrequency).length;
  const coveragePercent = totalDemanded > 0
    ? Math.round((haveSkills.length / totalDemanded) * 100)
    : 0;

  return {
    summary: {
      totalJobsAnalyzed: totalJobs,
      totalUniqueSkills: Object.keys(skillDemand).length,
      skillsYouHave: haveSkills.length,
      skillsYouMiss: Math.min(gapSkills.length, topN),
      coveragePercent,
      overallAssessment: coveragePercent >= 75 ? 'Strong Match'
        : coveragePercent >= 50 ? 'Good Match — Fill Key Gaps'
        : coveragePercent >= 25 ? 'Moderate Match — Significant Upskilling Needed'
        : 'Low Match — Consider Pivoting Strategy',
    },
    topGaps: gapSkills.slice(0, topN),
    gapsByCategory,
    matchedSkills: haveSkills,
    recommendations: generateRecommendations(gapSkills.slice(0, 5)),
  };
}

/**
 * Generates actionable learning recommendations for top skill gaps.
 */
function generateRecommendations(topGaps) {
  return topGaps.map(gap => ({
    skill: gap.skill,
    urgency: gap.percentage > 50 ? 'Critical' : gap.percentage > 25 ? 'High' : 'Medium',
    reasoning: `Appears in ${gap.percentage}% of your target jobs (${gap.frequency} of the analyzed roles).`,
    suggestion: `Consider adding ${gap.skill} to your skillset. It's demanded in ${gap.frequency} roles with an average relevance score of ${gap.avgRelevance}.`,
  }));
}

export default { analyzeSkillGap, normalizeSkill, getSkillCategory };
