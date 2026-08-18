import { callLLM } from './llmRouter.js';
import { parseLlmJson } from '../../shared/utils/llmJsonParser.js';

/**
 * Agent 3C: Consensus Loop (Boardroom Debate)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Simulates a boardroom of 3 expert personas critiquing the generated bullets,
 * then synthesizes the final perfected JSON.
 *
 * Role-Adaptive: Picks different personas based on role_type
 * (PM, Engineering, Data, Design, Marketing, Finance, etc.)
 */

// ── Role-specific persona configurations ──
const ROLE_PERSONAS = {
  product: {
    personas: [
      'The VP of Product (Focus: Product strategy, user impact, stakeholder management, roadmap execution)',
      'The Principal Engineer (Focus: Technical feasibility, architecture decisions, system design complexity)',
      'The ATS Optimizer (Focus: Exact keyword matching, action verbs, XYZ formula, measurable outcomes)'
    ],
    emphasis: 'product metrics, user engagement, A/B testing, OKRs, stakeholder alignment'
  },
  engineering: {
    personas: [
      'The Engineering Director (Focus: System design, scalability, architecture, code quality, reliability)',
      'The Staff Engineer (Focus: Technical depth, algorithms, data structures, performance optimization)',
      'The ATS Optimizer (Focus: Exact keyword matching, modern tech stack terms, quantified impact)'
    ],
    emphasis: 'system reliability, latency, throughput, code quality, CI/CD, technical debt reduction'
  },
  data: {
    personas: [
      'The Chief Data Officer (Focus: Data strategy, governance, business intelligence, analytics ROI)',
      'The ML Engineering Lead (Focus: Model accuracy, feature engineering, pipeline reliability, deployment)',
      'The ATS Optimizer (Focus: Data-specific keywords, tools, frameworks, quantified model performance)'
    ],
    emphasis: 'data pipeline throughput, model accuracy, feature importance, data quality, dashboard adoption'
  },
  design: {
    personas: [
      'The Design Director (Focus: Design systems, user research, accessibility, visual consistency)',
      'The UX Research Lead (Focus: User testing results, conversion uplift, task completion rates)',
      'The ATS Optimizer (Focus: Design tool keywords, portfolio metrics, collaboration with engineering)'
    ],
    emphasis: 'user satisfaction, conversion rates, accessibility compliance, design system adoption'
  },
  default: {
    personas: [
      'The Hiring Manager (Focus: Business impact, leadership, scale, and results)',
      'The Principal Engineer / Tech Lead (Focus: Technical accuracy, modern stack, architecture, complexity)',
      'The ATS/Recruiting Optimizer (Focus: Exact keyword matching, action verbs, XYZ formula compliance)'
    ],
    emphasis: 'business impact, leadership, technical depth, measurable outcomes'
  }
};

function getPersonasForRole(roleType) {
  const roleKey = (roleType || '').toLowerCase();
  if (roleKey.includes('product') || roleKey.includes('pm')) return ROLE_PERSONAS.product;
  if (roleKey.includes('engineer') || roleKey.includes('developer') || roleKey.includes('swe')) return ROLE_PERSONAS.engineering;
  if (roleKey.includes('data') || roleKey.includes('ml') || roleKey.includes('analytics')) return ROLE_PERSONAS.data;
  if (roleKey.includes('design') || roleKey.includes('ux') || roleKey.includes('ui')) return ROLE_PERSONAS.design;
  return ROLE_PERSONAS.default;
}

export async function agentConsensusLoop(initialBullets, jdIntel) {
  const roleConfig = getPersonasForRole(jdIntel.role_type || jdIntel.role || '');

  const systemPrompt = `You are a Multi-Agent Consensus Boardroom.
You will simulate a debate between 3 elite professionals reviewing a candidate's resume bullets against a Job Description.

PERSONAS:
1. ${roleConfig.personas[0]}
2. ${roleConfig.personas[1]}
3. ${roleConfig.personas[2]}

ROLE-SPECIFIC EMPHASIS: ${roleConfig.emphasis}

PROCESS:
1. Critique the provided initial bullets based on the JD constraints.
2. Identify weak verbs, missing keywords, hallucinated metrics, or poor formatting.
3. Rewrite the bullets to perfectly align with the JD, ensuring they follow the XYZ formula ("Accomplished [X] as measured by [Y], by doing [Z]").
4. MAXIMUM LINE WIDTH UTILIZATION: The LaTeX template supports exactly 84 characters per line. Every bullet point MUST fully utilize this horizontal width.
   - A single-line bullet must be 80-84 characters.
   - A two-line bullet must be 164-168 characters (first line wraps at 84, second line must also fill the width).
5. PAGE LAYOUT: Do NOT increase the number of lines. Focus entirely on horizontally expanding existing sentences to their maximum character limits.
6. You MUST retain the exact JSON schema of the input.
7. All bullets MUST have 2-3 phrases wrapped in **bold** (markdown).
8. Output ONLY VALID JSON representing the final, perfected output. No markdown wrappers around the JSON if it breaks parsing, just the JSON block.

OUTPUT SCHEMA:
The output MUST exactly match the schema of the provided INITIAL_BULLETS_JSON. Do not add or remove keys. Just improve the content.`;

  // OPT-9: Extract critical keywords from graph for preservation
  const graphNodes = jdIntel.requirement_graph?.graph || [];
  const criticalKeywords = graphNodes.filter(n => n.priority_tier <= 2).map(n => n.canonical);
  const keywordsToPreserve = criticalKeywords.length > 0
    ? criticalKeywords.slice(0, 15)
    : (jdIntel.semantic_map?.must_have || []);

  const userPrompt = `JD DOMAIN: ${jdIntel.domain}
JD SENIORITY: ${jdIntel.seniority}
JD ROLE TYPE: ${jdIntel.role_type || jdIntel.role || 'General'}
JD MUST-HAVE KEYWORDS: ${JSON.stringify(jdIntel.semantic_map?.must_have || [])}
JD RESPONSIBILITIES: ${JSON.stringify(jdIntel.responsibilities || [])}

⚠️ KEYWORDS THAT MUST BE PRESERVED IN FINAL OUTPUT (DO NOT rewrite any bullet in a way that removes these):
${JSON.stringify(keywordsToPreserve)}

INITIAL_BULLETS_JSON (To be critiqued and perfected):
${JSON.stringify(initialBullets, null, 2)}

Run the boardroom consensus and return the final perfected JSON now.`;

  // Global Engine routes 'consensus' to Tier 6 (gemini-3.1-pro-preview) by default
  // H4: 120s timeout guard — prevents Pro model from hanging the pipeline
  const CONSENSUS_TIMEOUT_MS = 120000;
  let completion;
  try {
    completion = await Promise.race([
      callLLM('consensus', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4000
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('[Consensus] Timeout after 120s')), CONSENSUS_TIMEOUT_MS)
      )
    ]);
  } catch (timeoutErr) {
    console.warn(`[Consensus] ${timeoutErr.message} — falling back to initial bullets.`);
    // Attach metadata so downstream agents know consensus was skipped
    if (initialBullets && typeof initialBullets === 'object') {
      initialBullets._meta = { consensusSkipped: true, reason: timeoutErr.message };
    }
    return initialBullets;
  }

  const result = parseLlmJson(completion.choices[0]?.message?.content || '{}');
  if (!result || !result.experience || !result.key_projects) {
    console.warn("Consensus Loop failed to produce valid JSON, falling back to initial bullets.");
    return initialBullets;
  }

  return result;
}
