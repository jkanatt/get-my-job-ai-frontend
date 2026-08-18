import { callLLM } from '@/infrastructure/services/llmRouter';
import { parseLlmJson } from '@/shared/utils/llmJsonParser';

/**
 * AGENT 3A: Skills Architect
 */
export async function agentSkillsArchitect(jdIntel, retrieval, masterResume, companyContext = null, variantTemperature = 0.2) {
  const brainSkills = retrieval.brain_skill_blocks?.slice(0, 25) || [];
  const profileHighlights = retrieval.profile_ammo?.top_highlights || [];

  const systemPrompt = `You are an elite Skills Architect who can perfectly tailor resume skills for ANY industry, ANY role, ANY seniority level. Your ONLY job is to select and write skills sections and summary that maximize ATS keyword coverage for this specific JD.

OUTPUT ONLY VALID JSON:
{
  "skills": {
    "ai_product_strategy": ["14-16 strings — core competencies matching the JD role"],
    "domain_header": "string (max 40 chars — industry/domain header matching JD, use \\& for ampersands)",
    "domain_skills": ["11-13 strings — industry-specific skills from the JD"],
    "tools": ["16-18 strings — Mixpanel, Amplitude, Google Analytics, Tableau, Power BI, SQL, Python, Jira, Confluence, Figma, Miro, Firebase, Notion, Trello, ClickUp, Azure DevOps"]
  },
  "summary": {
    "profile_summary_rewrite": "string (160-250 chars, ENTIRE REWRITE of the 'having built...' sentence. MUST strictly follow this structure: 'Built 35+ \\\\textbf{[JD-RELEVANT INDUSTRY 1, industry 2....]} products across [JD-RELEVANT PRODUCT AREAS], leveraging [JD-RELEVANT AI/TECH] and strategizing [JD-RELEVANT BUSINESS AREAS] across [B2B/B2C/B2B2C] markets, with expertise in [TOP 2-3 JD-RELEVANT AREAS].')",
    "closing_strength": "string (44-50 chars, unique value proposition for this role)"
  },
  "page2": {
    "other_skills": ["8-10 strings — STRONGEST ATS-relevant PM/AI/Leadership/Strategy skills. NO generic skills. Prioritize Product Management, AI, Leadership, Communication, Research, Strategy, and Business skills."],
    "domain_expertise": ["28-31 strings — ALL relevant verticals, frameworks, technologies, methodologies. FILL completely."],
    "consulting_domains": "string (48-55 chars — consulting/advisory areas)"
  }
}

UNIVERSAL RULES (work for ANY role — PM, Engineer, Designer, Data Scientist, Marketing, Sales, Operations, etc.):
1. INJECT every must-have JD keyword into at least one skills section. Place the MOST critical ones in ai_product_strategy and domain_skills.
2. NO duplicates across ANY skills section. Each skill appears ONCE across the entire resume.
3. Use \\& for ampersands in LaTeX strings.
4. Fill page2.domain_expertise to 28-31 items — this is the density section. Include industry verticals, frameworks, methodologies, compliance standards, tools.
5. Summary strings MUST fill the full character range — no short strings that leave visible gaps.
6. Domain header MUST precisely match the JD's industry and role context (e.g., "Cloud Infrastructure \\& DevOps" for a DevOps role, "Healthcare \\& Clinical Systems" for a health tech role).
7. Prioritize MUST-HAVE keywords over nice-to-haves. Every required skill from the JD must be present.
8. Match the SENIORITY level of the role — for senior/lead roles, use strategic language; for IC roles, use tactical/technical language.
9. PROFILE SUMMARY REWRITE: For profile_summary_rewrite, intelligently identify the highest-relevance industries, product domains, technologies, customer segments, business models, and capabilities from the JD. Reorder, replace, or refine keywords to maximize ATS matching while remaining completely truthful to the candidate's experience. Prioritize the JD's strongest signals, use semantic equivalents, avoid keyword stuffing, and preserve a natural executive-level narrative.
10. CRITICAL HYPHEN RULE: ABSOLUTELY ZERO HYPHENS, EM DASHES, OR EN DASHES IN ANY FORM. No '-', no '—', no '–'. Rewrite every clause to flow naturally. Compound adjectives like 'AI-driven' must be rewritten as 'AI driven' (no hyphen).
11. SENTENCE INJECTION RULE: 'profile_summary_rewrite' replaces the ENTIRE sentence in the template. You MUST strictly follow the structure: "Built 35+ \\\\textbf{[JD-RELEVANT INDUSTRY 1, industry 2....]} products across [JD-RELEVANT PRODUCT AREAS], leveraging [JD-RELEVANT AI/TECH] and strategizing [JD-RELEVANT BUSINESS AREAS] across [B2B/B2C/B2B2C] markets, with expertise in [TOP 2-3 JD-RELEVANT AREAS]." Ensure there is a period at the end of the sentence.
12. STRICT SKILLS BLOCKLIST: DO NOT output any generic adjectives, adverbs, conjunctions, or meaningless single words as skills (e.g., "fast", "quickly", "ruthlessly", "someone", "role", "impact", "not", "What You'll Own", "translate", "ads", "arr", "uagenius"). Every skill MUST be a professional noun-phrase competency (e.g., "Product Strategy", "API Integration", "Agile Methodology").
13. PROFILE SUMMARY TONE: When writing profile_summary_rewrite, strictly follow the provided structure exactly. Fill the brackets with highly relevant terms from the JD. For example: "Built 35+ \\\\textbf{loyalty, fintech, and engagement} products across enterprise rewards and gaming platforms, leveraging generative AI and no-code mechanics and strategizing Go-To-Market expansion across B2B and B2C markets, with expertise in AI agents and TPAP integrations." Do NOT output placeholder text.

CHARACTER COUNT LIMITS PER SKILL TAG (CRITICAL — layout will break if violated):
- ai_product_strategy: each string MUST be 3-28 characters. Use concise phrases like "Product Strategy", "Sprint Planning", "User Research".
- domain_skills: each string MUST be 3-28 characters. Use concise terms like "Payment Gateways", "UPI Integration", "KYC Compliance".
- tools: each string MUST be 3-25 characters. Use tool names like "Mixpanel", "Google Analytics", "Power BI".
- page2.other_skills: each string MUST be 3-30 characters.
- page2.domain_expertise: each string MUST be 3-30 characters.
- NEVER concatenate multiple skills into one string with commas or slashes. Each skill tag is ONE concept.`;

  // OPT-2: Extract tiered keywords from graph if available
  const graphNodes = jdIntel.requirement_graph?.graph || [];
  const criticalKws = graphNodes.filter(n => n.priority_tier <= 2).map(n => n.canonical);
  const highKws = graphNodes.filter(n => n.priority_tier >= 3 && n.priority_tier <= 4).map(n => n.canonical);
  const supportingKws = graphNodes.filter(n => n.priority_tier >= 5 && n.priority_tier <= 6).map(n => n.canonical);

  // Use graph-based keywords if available, otherwise fall back to semantic_map
  const mustHaveDisplay = criticalKws.length > 0
    ? criticalKws.slice(0, 20)
    : (jdIntel.semantic_map?.must_have?.slice(0, 20) || []);
  const preferredDisplay = highKws.length > 0
    ? [...highKws.slice(0, 10), ...supportingKws.slice(0, 5)]
    : (jdIntel.semantic_map?.preferred?.slice(0, 15) || []);

  const userPrompt = `CRITICAL MUST-HAVE SKILLS (Tier 1-2 — EVERY ONE of these MUST appear in at least one skills section): ${JSON.stringify(mustHaveDisplay)}
ADDITIONAL PREFERRED SKILLS (Tier 3-6): ${JSON.stringify(preferredDisplay)}
JD DOMAIN: ${jdIntel.domain}
JD ROLE TYPE: ${jdIntel.role_type}
JD SENIORITY: ${jdIntel.seniority}
DOMAIN HEADER INSTRUCTION: Use the JD's exact industry/domain terminology for domain_header — match the recruiter's language precisely.

BRAIN SKILL POOL (use these as base): ${JSON.stringify(brainSkills.slice(0, 20))}
DOMAIN SKILL POOL: ${JSON.stringify(retrieval.domain_skill_pool)}

CAREER HIGHLIGHTS (for summary context):
${profileHighlights.map(h => '• ' + h).join('\n')}
${companyContext ? `\nCOMPANY CONTEXT: ${JSON.stringify(companyContext.resume_optimization_strategy || '')}` : ''}

CURRENT RESUME SKILLS (modify, don't discard entirely):
${JSON.stringify(masterResume.skills, null, 1)}

CURRENT PAGE2 (modify):
${JSON.stringify(masterResume.page2, null, 1)}

PAGE 2 DENSITY: Fill other_skills to 12-14 items and domain_expertise to 35-38 items. These are free keyword surfaces.

Generate perfectly tailored skills and summary JSON now.`;

  const completion = await callLLM('skills_architect', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: variantTemperature, // Using parameter instead of process.env!
    max_tokens: 2500
  });

  const result = parseLlmJson(completion.choices[0]?.message?.content || '{}');
  if (!result) throw new Error('Skills Architect failed to produce valid JSON');

  // ── POST-PROCESSING: Enforce character limits per skill tag ──
  const LIMITS = {
    'skills.ai_product_strategy': 28,
    'skills.domain_skills': 28,
    'skills.tools': 25,
    'page2.other_skills': 30,
    'page2.domain_expertise': 30
  };

  function enforceCharLimit(arr, maxLen) {
    if (!Array.isArray(arr)) return arr;
    return arr
      .map(s => typeof s === 'string' ? s.trim() : String(s))
      .filter(s => s.length >= 2)
      .map(s => s.length > maxLen ? s.slice(0, maxLen).replace(/\s+\S*$/, '').trim() : s);
  }

  if (result.skills) {
    if (result.skills.ai_product_strategy) result.skills.ai_product_strategy = enforceCharLimit(result.skills.ai_product_strategy, 28);
    if (result.skills.domain_skills) result.skills.domain_skills = enforceCharLimit(result.skills.domain_skills, 28);
    if (result.skills.tools) result.skills.tools = enforceCharLimit(result.skills.tools, 25);
  }
  if (result.page2) {
    if (result.page2.other_skills) result.page2.other_skills = enforceCharLimit(result.page2.other_skills, 30);
    if (result.page2.domain_expertise) result.page2.domain_expertise = enforceCharLimit(result.page2.domain_expertise, 30);
  }

  return result;
}
