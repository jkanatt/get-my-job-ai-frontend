import fs from 'fs';
import path from 'path';
import { callLLM } from '@/infrastructure/services/llmRouter';
import { parseLlmJson } from '@/shared/utils/llmJsonParser';
import { parseLatexLayout } from '@/infrastructure/services/latexParser';
import { measureTextWidth } from '@/infrastructure/services/latexMetrics';
import { optimizeBulletWidth } from '@/infrastructure/services/contentFitEngine';

/**
 * AGENT 3B: Bullet Engineer
 */
export async function agentBulletEngineer(jdIntel, retrieval, masterResume, companyContext = null, variantTemperature = 0.2) {
  if (process.env.MOCK_LLM === 'true') {
    // Determine SENDER_PATH correctly
    const SENDER_PATH = process.cwd(); // or adjust appropriately if needed
    const mockDataPath = path.join(SENDER_PATH, 'build', 'tailored_resume_data.json');
    if (fs.existsSync(mockDataPath)) {
      let mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));
      mockData = JSON.parse(JSON.stringify(mockData).replace(/\\\\textbf\{([^}]+)\}/g, '**$1**'));
      return { experience: mockData.experience, key_projects: mockData.key_projects };
    }
  }

  const selectedProjects = retrieval.selected_projects;
  const bestAchievements = retrieval.best_achievements || [];

  const projectContext = selectedProjects.map(p => {
    const domainBullets = p.bullet_variants?.[retrieval.domain] ||
      p.bullet_variants?.[Object.keys(p.bullet_variants || {})[0]] ||
      p.bullets || [];
    return {
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      link: p.link,
      link_text: p.link_text,
      bullets: domainBullets.slice(0, 6),
      kpis: (p.kpis || []).slice(0, 5)
    };
  });

  const achievementAmmo = bestAchievements.slice(0, 10).map(a =>
    `[${a.company}] ${a.bullet}`
  );

  // V3: Build dynamic experience schema from actual companies in the brain
  const companyVariants = retrieval.company_variants || {};
  const companyKeys = Object.keys(companyVariants);
  const dynamicExperienceSchema = {};
  for (const key of companyKeys) {
    const variant = companyVariants[key];
    const fields = {};
    for (const [fieldName, fieldValue] of Object.entries(variant)) {
      if (typeof fieldValue === 'string') {
        const len = fieldValue.length;
        // Enforce word counts instead of exact character limits since LLMs cannot count characters
        fields[fieldName] = len < 100 ? `string (exactly 1 complete sentence, approx 10-15 words)` : `string (exactly 1 complete sentence, approx 25-30 words)`;
      } else {
        fields[fieldName] = `string`;
      }
    }
    dynamicExperienceSchema[key] = fields;
  }

  const systemPrompt = `You are an elite Resume Engineer. Your primary directive is to rebuild Page 2 projects dynamically for every job based on the JD, ATS keywords, industry, role, and company.

OUTPUT ONLY VALID JSON:
{
  "experience": ${JSON.stringify(dynamicExperienceSchema, null, 2)},
  "key_projects": [
    {
      "id": "project_id",
      "name": "Project Name",
      "subtitle": "exact subtitle provided",
      "link": "url or empty",
      "link_text": "Live Demo",
      "bullets": [
        "string (exactly 1 complete sentence, approx 25-30 words, end with a period)",
        "string (exactly 1 complete sentence, approx 25-30 words, end with a period)",
        "string (exactly 1 complete sentence, approx 25-30 words, end with a period)",
        "string (exactly 1 complete sentence, approx 25-30 words, end with a period)"
      ]
    }
  ]
}

STRICT COMPLIANCE RULES:
1. Dynamic Project Generation: Page 2 must never remain static. Always extract project information from the complete Obsidian knowledge base, including product docs, PRDs, research, architecture, testing, GTM, pricing, integrations, APIs, and project links.
8. Project Structure (Exactly 4 Bullets): Each project must contain EXACTLY 4 bullets. EVERY bullet MUST be EXACTLY ONE single sentence. DO NOT use multiple sentences in a single bullet. Do NOT abruptly cut off sentences; they must be grammatically complete and end in a period. Aim for ~25-30 words per bullet to naturally fill 2 lines. NEVER leave incomplete fragments like 'This d.' or 'This di.' at the end.
   - Bullet 1 (Product Overview): What the product is, key features, users, and business value.
   - Bullet 2 (Leadership): Product ownership, roadmap, prioritization, stakeholder management, Agile execution, and cross-functional leadership.
   - Bullet 3 (Technology): AI, LLMs, integrations, APIs, architecture, cloud, analytics, automation, and key technologies.
   - Bullet 4 (Delivery & Validation): Research, MVP, testing, QA/UAT, acceptance criteria, GTM, PLG, pricing, subscriptions, customer satisfaction, analytics, and product outcomes.
9. Line Width Optimization (CRITICAL): Ensure the resume follows a strict, consistent line-width optimization rule. Every single bullet MUST be precisely between 160 and 168 characters in length to naturally fill two lines without orphans. You MUST proactively adjust text generation to meet these exact width thresholds while maintaining EXACTLY ONE complete sentence. Expand or condense the wording naturally.
10. You MUST rewrite the key_projects bullets to inject the JD MUST-HAVE KEYWORDS. However, you MUST NOT hallucinate new metrics, features, or fake facts. You must synthesize ONLY real facts from the provided project context (which is perfectly sourced from the candidate's master documents).
11. NEVER hallucinate tools or platforms (e.g., Mixpanel, A/B testing) if they are not explicitly mentioned in the original project context.
12. KEYWORD INJECTION: Make slight keyword adjustments using JD terminology to horizontally fill out the lines, without changing the factual content, achievements, or original meaning.
13. Use \\& for ampersands, \\% for percent signs.
14. Select EXACTLY 4 projects to ensure the page is fully filled without leaving empty space. Use the projects provided — do NOT invent new ones.
15. EXPERIENCE KEYWORD INJECTION: You MUST subtly inject exactly 3-5 of the HIGHEST PRIORITY JD KEYWORDS across the bullets for each company in the experience section. DO NOT rewrite the sentences entirely, DO NOT hallucinate fake metrics, and DO NOT change the core meaning. Just swap or add 3-5 words perfectly to improve ATS matching, maintaining exactly the same number of bullets and the same approximate line length.`;

  // V3: Dynamic variant injection — works for ANY user's companies
  const variantLines = Object.entries(companyVariants)
    .map(([key, val]) => `${key}: ${JSON.stringify(val)}`)
    .join('\n');

  // OPT-4: Extract tiered keywords from graph if available
  const graphNodes = jdIntel.requirement_graph?.graph || [];
  const tier1Kws = graphNodes.filter(n => n.priority_tier <= 2).map(n => n.canonical);
  const tier3Kws = graphNodes.filter(n => n.priority_tier >= 3 && n.priority_tier <= 4).map(n => n.canonical);

  const mustHaveDisplay = tier1Kws.length > 0
    ? tier1Kws.slice(0, 15)
    : (jdIntel.semantic_map?.must_have?.slice(0, 20) || []);

  const userPrompt = `HIGHEST PRIORITY KEYWORDS (Tier 1-2 — every project MUST mention at least one): ${JSON.stringify(mustHaveDisplay)}
ADDITIONAL JD KEYWORDS (Tier 3-4): ${JSON.stringify(tier3Kws.length > 0 ? tier3Kws.slice(0, 10) : [])}
JD DOMAIN: ${jdIntel.domain}
JD SENIORITY: ${jdIntel.seniority}
JD RESPONSIBILITIES: ${JSON.stringify(jdIntel.responsibilities?.slice(0, 8))}

SELECTED PROJECTS (pick 5-6 from these):
${JSON.stringify(projectContext, null, 1)}

TOP ACHIEVEMENT BULLETS FROM CAREER (use for metric injection):
${achievementAmmo.join('\n')}

EXPERIENCE VARIANTS:
${variantLines}

${companyContext ? `COMPANY STRATEGY: ${companyContext.resume_optimization_strategy || ''}` : ''}

Generate perfectly engineered experience and project JSON now.`;

  const completion = await callLLM('bullet_engineering', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: variantTemperature,
    max_tokens: 3000
  });

  const result = parseLlmJson(completion.choices[0]?.message?.content || '{}');
  if (!result) throw new Error('Bullet Engineer failed to produce valid JSON');

  // Intelligent LaTeX Layout Engine: Parse Template dynamically
  const texPath = path.join(process.cwd(), 'joshua_kanatt_resume.tex');
  const layout = parseLatexLayout(texPath) || { lineWidthPt: 503, font: 'Helvetica', fontSize: 11 };

  // Final Validation: Character limit compliance and orphan elimination
  if (result.key_projects && Array.isArray(result.key_projects)) {
    // Phase 1: Collect and execute all expansions concurrently
    const expansionPromises = [];
    
    for (const project of result.key_projects) {
      if (!Array.isArray(project.bullets)) project.bullets = [];
      
      // Strict Page 2 Enforcement: Exactly 4 bullets
      while (project.bullets.length < 4) {
        project.bullets.push("Engineered modern technical architectures to drive scalable product capabilities.");
      }
      project.bullets = project.bullets.slice(0, 4);

      for (let i = 0; i < project.bullets.length; i++) {
        let text = project.bullets[i].trim();
        let currentWidthPt = measureTextWidth(text, layout.fontFamily, layout.fontSize);
        
        // Use Content Fit Engine to dynamically adjust to exact layout constraints
        expansionPromises.push((async () => {
             try {
               const fixedText = await optimizeBulletWidth(text, currentWidthPt, layout.lineWidthPt);
               if (fixedText && fixedText !== text) {
                 return { project, index: i, text: fixedText };
               }
             } catch(e) {
               console.error('Intelligent Layout Engine Optimization failed', e.message);
             }
             return null;
        })());
      }
    }

    // Await all concurrent LLM expansions
    const expansionResults = await Promise.all(expansionPromises);
    for (const res of expansionResults) {
      if (res) {
        res.project.bullets[res.index] = res.text.replace(/\\s+/g, ' ').replace(/\\*\\*\\*\\*/g, '');
      }
    }
  }

  return result;
}
