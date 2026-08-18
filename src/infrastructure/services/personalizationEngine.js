import { getResilientLLMClient } from './llmRouter.js';

// ══════════════════════════════════════════════════════════════════════════════
// PERSONALIZATION ENGINE v2 — Hybrid Template + Surgical LLM Architecture
// ══════════════════════════════════════════════════════════════════════════════
// Cover Letter: LLM generates 3 dynamic paragraphs (JSON), engine assembles
// Email: LLM generates 6 tiny dynamic fields (JSON), engine deterministically
//        assembles the sacred email template — LLM never touches static text.
// ══════════════════════════════════════════════════════════════════════════════

const BANNED_PHRASES = [
  "i am thrilled", "passionate about",
  "i am confident", "in today's fast paced", "in today's competitive",
  "look no further", "i would be a great fit", "i believe i am",
  "dynamic professional", "results driven", "team player",
  "think outside the box", "hit the ground running", "wear many hats",
  "synergy", "synergies", "leverage my skills", "proven track record",
  "go above and beyond"
];

// ── Cover Letter Paragraph Validator ──
function validateParagraphs(p1, p2, p3) {
  const paragraphs = [p1, p2, p3];

  if (!p1 || !p2 || !p3) {
    throw new Error("Validation Failed: Missing one or more paragraphs (P1, P2, P3).");
  }

  for (let i = 0; i < paragraphs.length; i++) {
    const text = paragraphs[i];
    const lowerText = text.toLowerCase();

    // Check banned phrases
    for (const phrase of BANNED_PHRASES) {
      if (lowerText.includes(phrase)) {
        throw new Error(`Validation Failed: Contains banned phrase "${phrase}"`);
      }
    }

    // Check em dashes / en dashes
    if (text.includes('—') || text.includes('–')) {
      throw new Error(`Validation Failed: Contains forbidden em dash or en dash in Paragraph ${i + 1}`);
    }

    // Check hyphen breaks (hyphen surrounded by spaces or at line end)
    if (text.match(/ - /) || text.match(/ -$/m)) {
      throw new Error(`Validation Failed: Contains forbidden hyphen break in Paragraph ${i + 1}`);
    }

    // Check sentence count (1 to 6 sentences)
    // Resilient negative lookbehind to avoid splitting on acronyms like U.S. or M.S.
    const sentenceCount = text.split(/(?<!\b[A-Z])[.!?]+(?=\s|$)/).filter(s => s.trim().length > 0).length;
    if (sentenceCount < 1 || sentenceCount > 6) {
      throw new Error(`Validation Failed: Paragraph ${i + 1} has ${sentenceCount} sentences (must be between 1 and 6).`);
    }
  }
}

// ── Email Dynamic Fields Validator ──
function validateEmailFields(fields, CANONICAL_LINK_MAP) {
  const errors = [];
  const required = ['company_mission', 'jd_domain', 'project_1_name', 'project_1_url', 'project_1_accomplishment', 'project_2_name', 'project_2_url', 'project_2_accomplishment'];

  // 1. Check all required fields exist and are non-empty
  for (const key of required) {
    if (!fields[key] || typeof fields[key] !== 'string' || fields[key].trim().length === 0) {
      errors.push(`Missing or empty required field: "${key}"`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Email Validation Failed: ${errors.join('; ')}`);
  }

  // 2. company_mission: 1 sentence, no banned phrases, no dashes
  const mission = fields.company_mission;
  const missionSentences = mission.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  if (missionSentences > 2) {
    errors.push(`company_mission has ${missionSentences} sentences (must be 1-2). Value: "${mission}"`);
  }
  for (const phrase of BANNED_PHRASES) {
    if (mission.toLowerCase().includes(phrase)) {
      errors.push(`company_mission contains banned phrase: "${phrase}"`);
    }
  }
  if (mission.includes('—') || mission.includes('–')) {
    errors.push(`company_mission contains forbidden em/en dash`);
  }

  // 3. jd_domain: 2-8 words only
  const domainWords = fields.jd_domain.trim().split(/\s+/).length;
  if (domainWords < 1 || domainWords > 10) {
    errors.push(`jd_domain has ${domainWords} words (must be 1-10). Value: "${fields.jd_domain}"`);
  }

  // 4. URLs must be valid https:// and match canonical map if possible
  for (const urlField of ['project_1_url', 'project_2_url']) {
    const url = fields[urlField];
    if (!url.match(/^https?:\/\//)) {
      errors.push(`${urlField} is not a valid URL: "${url}"`);
    }
  }

  // 5. Accomplishments: no dashes, no banned phrases, reasonable length
  for (const accField of ['project_1_accomplishment', 'project_2_accomplishment']) {
    const acc = fields[accField];
    if (acc.includes('—') || acc.includes('–')) {
      errors.push(`${accField} contains forbidden em/en dash`);
    }
    if (acc.match(/ - /)) {
      errors.push(`${accField} contains forbidden spaced hyphen break`);
    }
    for (const phrase of BANNED_PHRASES) {
      if (acc.toLowerCase().includes(phrase)) {
        errors.push(`${accField} contains banned phrase: "${phrase}"`);
      }
    }
    // Reject if too short or too long
    const wordCount = acc.split(/\s+/).length;
    if (wordCount < 5) {
      errors.push(`${accField} is too short (${wordCount} words, minimum 5)`);
    }
    if (wordCount > 50) {
      errors.push(`${accField} is too long (${wordCount} words, maximum 50)`);
    }
  }

  // 6. URL Canonical Correction — auto-fix hallucinated URLs
  const correctedFields = { ...fields };
  for (const [projField, urlField] of [['project_1_name', 'project_1_url'], ['project_2_name', 'project_2_url']]) {
    const name = fields[projField].toLowerCase().trim();
    if (CANONICAL_LINK_MAP[name] && CANONICAL_LINK_MAP[name] !== fields[urlField]) {
      console.warn(`[EmailValidator] Auto-correcting ${urlField}: "${fields[urlField]}" → "${CANONICAL_LINK_MAP[name]}"`);
      correctedFields[urlField] = CANONICAL_LINK_MAP[name];
    }
  }

  if (errors.length > 0) {
    throw new Error(`Email Validation Failed: ${errors.join('; ')}`);
  }

  return correctedFields;
}

// ── Sacred Email Template Constants ──
const SACRED_EMAIL_P3 = `Most importantly, I want to bring the absolute best version of myself to the team: taking ownership of meaningful problems, building from first principles, moving with urgency, and creating impact well beyond what is expected of the role.`;

const SACRED_EMAIL_P4 = `I have attached my resume and would love for you to explore my portfolio at https://jk-lac.vercel.app/#projects. The depth and scale of platforms I have built tells the story better than any email can.`;

// NOTE: Candidate Details footer is NOT included here.
// It is assembled by send_application.js using live profileData to avoid duplication
// and ensure dynamic values (experience, CTC, location) are always current.

// ── Deterministic Email Assembler ──
// NOTE: This returns ONLY the email body paragraphs (P1-P4).
// The candidate details footer + signature is appended by send_application.js
// to avoid duplication and keep profileData as the single source of truth.
function assembleEmail(fields, company, hrName) {
  const p1 = `Hi ${hrName},\n\nI have a strong admiration for what ${company} is building and the ambition behind it: ${fields.company_mission}. What excites me most is the opportunity to work on complex problems at scale, challenge conventional ways of solving them, and transform ${fields.jd_domain} workflows into intelligent, effortless experiences.`;

  const p2 = `I bring a strong zero to one builder mindset with hands-on experience across product, technology, simple SaaS user flows, design, PLG, GTM, roadmapping, problem solving, customer analysis, user behavior, deep research, and RCA. I thrive at the intersection of ambiguity and execution, going deep into problems, identifying what can be fundamentally improved, and turning ideas into practical systems that create measurable impact. When building the ${fields.project_1_name} project at ${fields.project_1_url}, I ${fields.project_1_accomplishment}, while during my work on the ${fields.project_2_name} project at ${fields.project_2_url}, I ${fields.project_2_accomplishment}.`;

  return [p1, p2, SACRED_EMAIL_P3, SACRED_EMAIL_P4].join('\n\n');
}

export async function generatePersonalizedNarrative(jdText, jdIntel, topProjects, profileData, outputType = 'cover_letter') {
  const role = jdIntel.role_type || jdIntel.role || 'Product Manager';
  const company = jdIntel.company_name || 'your company';
  const hrName = jdIntel.recruiterName || jdIntel.hr_name || jdIntel.hr_email || 'Hiring Manager';

  // Change 5: Increase context to 6 projects for richer evidence bank
  const topProjectsCondensed = (topProjects || []).slice(0, 6).map(p => ({
    id: p.id,
    name: p.name,
    subtitle: p.subtitle || '',
    bullets: (p.bullets || []).slice(0, 2),
    project_link: p.link || p.project_link || '',
    metrics: p.metrics || {}
  }));
  
  // Build canonical name→URL map for post-processing link correction
  const CANONICAL_LINK_MAP = {};
  for (const p of topProjectsCondensed) {
    if (p.project_link) {
      CANONICAL_LINK_MAP[p.name.toLowerCase().trim()] = p.project_link;
    }
  }

  const PROJECT_RELEVANCE_BRIEF = topProjectsCondensed.map(p => {
    const url = p.project_link || '';
    return `- ${p.name}: ${url || 'NO LINK AVAILABLE'}`;
  }).join('\n');

  // Change 4: JD keyword injection — surface pre-extracted intelligence
  const jdKeywords = [
    ...(jdIntel.all_keywords || []),
    ...(jdIntel.required_skills || []),
  ].filter(Boolean).slice(0, 20);
  const jdKeywordBrief = jdKeywords.length > 0
    ? `\nJD PRIORITY KEYWORDS (pre-extracted): ${jdKeywords.join(', ')}`
    : '';
  const jdDomainHint = jdIntel.domain ? `\nJD DOMAIN: ${jdIntel.domain}` : '';

  let systemPrompt = '';
  let dynamicUserPrompt = '';

  // Change 2: counterPrompt now shared between BOTH cover letter AND email paths
  const counterPrompt = `
CRITICAL FIX: The engine MUST NEVER leak its internal generation framework into the final output. 
YOU MUST RETURN ONLY VALID JSON.
NO conversational filler (e.g., "Here is the cover letter", "Certainly!").
NO internal labels (e.g., "Paragraph 1:", "JD Motivation", "###").

CRITICAL PROJECT RULE: Treat the provided candidate evidence as "Projects" or "Products built", NOT as previous employers, jobs, or formal roles. For example, write "When building the Get My Job Autonomous Careers project...", NEVER write "In my previous role at Get My Job...".

CRITICAL TITLE RULE: The candidate is a **Senior Product Manager (SPM)**. You MUST NOT hallucinate fake, inflated titles like "Director of Product", "VP of Product", or "Head of Product". If you refer to their role, refer to them ONLY as a Senior Product Manager or a Founder/Builder.

CRITICAL METRICS RULE: All of the candidate's projects are currently in the PRE-RELEASE/MVP/Beta phase. They have undergone rigorous testing, MVP validation, and GTM strategy planning, but they are NOT yet publicly launched and have NO live customers. You MUST NOT hallucinate live user counts, post-launch revenue, or active customers. Frame the success strictly around "pre-launch validation", "MVP execution", "user testing", and "GTM readiness".

CRITICAL STYLE RULE: ZERO AI TONE. Write like a highly intelligent, direct, fast-moving human product builder. DO NOT use flowery language, complex adjectives, or corporate fluff. Use stark, powerful, action-driven language.

CRITICAL HYPHEN RULE: ABSOLUTELY ZERO HYPHENS, EM DASHES, OR EN DASHES IN ANY FORM. No "-", no "—", no "–". Rewrite every clause to flow naturally using commas, periods, semicolons, or conjunctions. Compound adjectives like "AI-driven" must be rewritten as "AI driven" (no hyphen). This rule has zero exceptions.
`;

  if (outputType === 'cover_letter') {
    systemPrompt = `GLOBAL COVER LETTER GENERATION ENGINE — REVIEWER PANEL PROMPT

You are generating the dynamic Zone A (Paragraphs 1-3) of a highly tailored 6-paragraph cover letter.
You must satisfy a panel of four strict reviewers who must approve your letter:
1. Staff product architect: Rejects vague claims without a system/mechanism behind them.
2. Growth lead: Rejects generic growth language without a metric or channel attached.
3. Recruiter (10,000 letters read): Rejects anything that reads like a template.
4. Editor: Rejects any sentence that could be cut without losing information.

TARGET: ${role} at ${company}
${jdKeywordBrief}
${jdDomainHint}

INPUT EVIDENCE BANK (Candidate Experience):
${JSON.stringify(topProjectsCondensed, null, 2)}

PROJECT RELEVANCE BRIEF (Links & Names):
${PROJECT_RELEVANCE_BRIEF}

HARD RULES (13 CONSTRAINTS):
1. No AI tone. No flowery language or corporate fluff.
2. No em dashes (—). Zero tolerance.
3. No hyphen as sentence break (e.g., " - "). Compound words are fine.
4. No fabrication. Every claim must trace to the Evidence Bank.
5. No duplication. Do not talk about general "Founder background", "MBA", "Deakin", or "startup scaling" in general, as these are covered in the fixed P4-P6 paragraphs.
6. PARAGRAPH 1 TEMPLATE RULE: For paragraph_1, you MUST exactly use the following template, dynamically tailoring the bracketed sections based on the JD and company: "I’m excited to apply for the **[ROLE]** at **[COMPANY]**, especially because of your vision to **[COMPANY VISION / MISSION / IMPACT]**. The opportunity strongly aligns with my experience in **[JD RELEVANT AREAS]**, where I’ve built and strategized products to solve complex **[PROBLEM / CUSTOMER / BUSINESS CHALLENGE]**. I see a strong reflection of my **entrepreneurial mindset, ownership, leadership, and dynamic problem-solving approach** in what [COMPANY] is building, making this role a particularly strong fit for my experience and ambitions." Do NOT include hyphens or dashes in your filled text.
7. P2 maps requirements. 2 to 3 JD requirements matched to 2 to 3 real experience points from the Evidence Bank.
8. P3 is one concrete execution example. A system, a launch, a number. Not a summary of career.
9. Length and voice: 3 to 5 sentences per paragraph, active voice.
10. BOLD KEYWORDS (MANDATORY): You MUST use Markdown **bolding** strategically in EVERY paragraph to highlight at least 3 to 5 crucial JD technical terms, tools, methodologies, and core competencies (e.g. **AI agents**, **n8n**, **rapid prototyping**, **Prompt Engineering**, **LLMs**, **Python**) for immediate ATS and human scannability. Do NOT use LaTeX tags.
11. TONE: Do not be overly technical or robotic. Keep the tone conversational, business-focused, and highly accessible to product leaders.
12. BANNED PHRASES: NEVER use any of these exact phrases: "i am thrilled", "passionate about", "i am confident", "in today's fast paced", "in today's competitive", "look no further", "i would be a great fit", "i believe i am", "dynamic professional", "results driven", "team player", "think outside the box", "hit the ground running", "wear many hats", "synergy", "synergies", "leverage my skills", "proven track record", "go above and beyond".
13. strict JSON output. ONLY valid JSON, NO markdown fences, NO commentary.

OUTPUT CONTRACT:
{
  "paragraph_1": "...",
  "paragraph_2": "...",
  "paragraph_3": "..."
}

${counterPrompt}
`;
    dynamicUserPrompt = `Here is the Job Description (truncated to key context):\n\n${jdText.slice(0, 2500)}\n\nGenerate the JSON with the 3 dynamic paragraphs now.`;
  } else {
    // ══════════════════════════════════════════════════════════════════════
    // EMAIL v2: SURGICAL JSON GENERATION — LLM produces ONLY 6 fields
    // The static email template text is NEVER seen by the LLM.
    // ══════════════════════════════════════════════════════════════════════
    systemPrompt = `You are selecting the 2 most relevant projects and writing 2 micro-accomplishments for a cold email to a recruiter.

TARGET ROLE: ${role} at ${company}
${jdKeywordBrief}
${jdDomainHint}

CANDIDATE PROJECT EVIDENCE BANK:
${JSON.stringify(topProjectsCondensed, null, 2)}

PROJECT LINK REFERENCE (COPY URLS EXACTLY):
${PROJECT_RELEVANCE_BRIEF}

YOUR TASK:
Analyze the Job Description below and output a JSON object with EXACTLY these 6 fields:

{
  "company_mission": "1 sentence describing what ${company} does based on the JD (e.g., 'transforming creative automation and UA intelligence into scalable systems for gaming studios')",
  "jd_domain": "2-5 word domain label (e.g., 'AdTech and creative intelligence', 'FinTech and payments', 'enterprise SaaS')",
  "project_1_name": "Name of most relevant project from Evidence Bank",
  "project_1_url": "EXACT URL from PROJECT LINK REFERENCE above — copy it character for character",
  "project_1_accomplishment": "1 sentence: what you did on this project that is highly relevant to the JD (start lowercase, no period at end)",
  "project_2_name": "Name of second most relevant project from Evidence Bank",
  "project_2_url": "EXACT URL from PROJECT LINK REFERENCE above — copy it character for character",
  "project_2_accomplishment": "1 sentence: what you did on this project that is highly relevant to the JD (start lowercase, no period at end)"
}

RULES:
1. Output ONLY valid JSON. No markdown fences, no commentary, no labels.
2. company_mission: max 1 sentence. Describe their actual product/mission from the JD.
3. jd_domain: 2-5 words describing the industry/domain.
4. Project names MUST exist in the Evidence Bank. Do NOT invent projects.
5. URLs MUST be copied EXACTLY from the PROJECT LINK REFERENCE. Do NOT modify, shorten, or guess URLs.
6. Accomplishments must trace to real bullets in the Evidence Bank. No hallucination.
7. Accomplishments: start with a lowercase verb, no period at the end, 10-30 words.
8. ZERO hyphens, em dashes, en dashes anywhere. Use commas or conjunctions instead.
9. ZERO AI tone. Write like a direct, fast-moving human product builder.

${counterPrompt}
`;
    dynamicUserPrompt = `Here is the Job Description (truncated to key context):

${jdText.slice(0, 2500)}

Output the JSON object with the 6 fields now.`;
  }
  
  const maxRetries = 3;
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      // Change 6: Task-specific temperature
      const temperature = outputType === 'cover_letter' ? 0.25 : 0.4;

      const completion = await getResilientLLMClient().chat.completions.create({
        model: 'auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: dynamicUserPrompt }
        ],
        temperature,
        max_tokens: outputType === 'cover_letter' ? 4000 : 2000,
        response_format: { type: "json_object" }
      });

      let narrative = completion.choices[0]?.message?.content?.trim() || '';

      if (outputType === 'cover_letter') {
        // Strip possible markdown blocks if LLM still puts them despite instructions
        narrative = narrative.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

        let parsed;
        try {
          const jsonMatch = narrative.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            parsed = JSON.parse(narrative);
          }
        } catch (e) {
          console.error("RAW NARRATIVE OUTPUT:", narrative);
          throw new Error("Validation Failed: Output is not valid JSON. You MUST output strict JSON only.");
        }

        const p1 = parsed.paragraph_1;
        const p2 = parsed.paragraph_2;
        const p3 = parsed.paragraph_3;

        validateParagraphs(p1, p2, p3);

        // ── SACRED PARAGRAPHS P4/P5/P6 — HARDCODED, IMMUTABLE, ALWAYS PRESENT ──
        // PRODUCTION RULE: These 3 paragraphs appear IDENTICALLY in EVERY cover letter.
        // They are NEVER modified, NEVER conditionally omitted, NEVER data-driven.
        // This is a direct user directive with zero exceptions.

        const SACRED_P4 = `What sets me apart is my ability to own the entire product journey from idea to scale. I identify high-impact opportunities through deep market, customer, and competitive research, validate ideas with data, define **product strategy**, design **intuitive user experiences**, write detailed **product requirements**, and partner with engineering to build **scalable products** that solve real customer problems. Beyond product development, I lead **GTM strategy**, **pricing**, **positioning**, **marketing**, **product launches**, **growth experiments**, and **investor storytelling**.`;

        const SACRED_P5 = `I am an Ex Founder and **Product Builder & strategist** with over five years of experience across **E Commerce**, **FinTech**, **AI**, **SaaS**, **Enterprise**, and highly scalable consumer networks. During my entrepreneurial journey, I built and scaled a company to more than **200 employees**, led a team of **over 60 engineers**, and built more than **30 products from scratch**. My experience spans rigorous **product discovery**, **technical PRD execution**, cross-functional stakeholder management, **advanced data analysis**, **experimentation**, and complete business ownership.`;

        const SACRED_P6 = `Academically, I hold a **Global MBA** from Deakin Business School, an **M.S. in Data Science** from Liverpool John Moores University, a PGP from IMT Ghaziabad, PGDM from IIIT Bangalore, Btech from Hindusthan College and attained **6x Top Global elite Incubations**. I have also been recognized among **India's Top Product Builders** and have had the opportunity to be part of **Stanford SeedSpark**, **NASSCOM 10K Startups**, **Cisco LaunchPad**, **Microsoft for Startups**, and **Razorpay Rize**.`;

        const profile = profileData || {};

        // Assemble: Greeting + 3 LLM paragraphs + 3 Sacred paragraphs + Sign-off
        const paragraphs = [
          `Dear ${hrName || 'Hiring Manager'},`,
          p1, p2, p3,
          SACRED_P4,
          SACRED_P5,
          SACRED_P6,
          "Sincerely,",
          profile.name || "Joshua Kanatt"
        ];

        const assembled = paragraphs.join('\n\n');

        // Global hyphen post-processing (only on LLM paragraphs — sacred text has none)
        const cleaned = assembled
          .replace(/\s*—\s*/g, ', ')
          .replace(/\s*–\s*/g, ', ')
          .replace(/\s+-\s+/g, ', ');

        // Convert markdown bold to latex bold for cover letter
        return cleaned.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
      } else {
        // ══════════════════════════════════════════════════════════════════
        // EMAIL v2: Parse JSON fields → Validate → Assemble deterministically
        // ══════════════════════════════════════════════════════════════════

        // Strip possible markdown blocks
        narrative = narrative.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

        let parsed;
        try {
          const jsonMatch = narrative.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            parsed = JSON.parse(narrative);
          }
        } catch (e) {
          console.error("RAW NARRATIVE OUTPUT (EMAIL):", narrative);
          throw new Error("Email Validation Failed: Output is not valid JSON. You MUST output strict JSON only with the 6 required fields.");
        }

        // Change 3: Validate all email fields structurally
        const validatedFields = validateEmailFields(parsed, CANONICAL_LINK_MAP);

        // Global hyphen post-processing on dynamic fields
        for (const key of ['company_mission', 'jd_domain', 'project_1_accomplishment', 'project_2_accomplishment']) {
          if (validatedFields[key]) {
            validatedFields[key] = validatedFields[key]
              .replace(/\s*—\s*/g, ', ')
              .replace(/\s*–\s*/g, ', ')
              .replace(/\s+-\s+/g, ', ');
          }
        }

        // Deterministic assembly — LLM output never touches static template text
        const emailBody = assembleEmail(validatedFields, company, hrName);

        console.log(`[PersonalizationEngine v2] Email assembled deterministically. Projects: ${validatedFields.project_1_name}, ${validatedFields.project_2_name}`);
        return emailBody;
      }

    } catch (error) {
      console.error(`[Attempt ${attempt}/${maxRetries}] Personalization Engine Failed/Rejected:`, error.message);
      lastError = error;
      if (attempt === maxRetries) {
        throw lastError;
      }
      // Change 7: Self-healing with structured field-level error feedback
      dynamicUserPrompt += `\n\nYOUR PREVIOUS ATTEMPT FAILED: ${error.message}\nYOU MUST FIX THIS IN YOUR NEXT RESPONSE. Output ONLY valid JSON.`;
    }
  }
}
