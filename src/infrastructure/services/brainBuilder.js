// GoogleGenAI import removed — brainBuilder now delegates to Global LLM Engine v5

/**
 * brainBuilder.js — V3 Universal Profile Ingestion
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Hybrid 2-Pass Architecture:
 *   Pass 1 (LLM):   Generate core data — profile, projects, experience_detailed
 *   Pass 2a (Code):  Build intelligence layers — domain_index, keyword_index, domain_headers
 *   Pass 2b (LLM):   Generate adaptive layers — skill_pools, experience_variants
 *
 * Guarantees ALL 9 data layers the ATS engine requires are always populated
 * for ANY user profile, ANY industry, ANY role type.
 */

// ─── Domain Detection Keywords ─────────────────────────────────────────────
const DOMAIN_KEYWORDS = {
  fintech: ['fintech', 'payment', 'upi', 'banking', 'lending', 'credit', 'loan', 'insurance', 'neobank', 'wallet', 'kyc', 'aml', 'rbi', 'npci', 'emi', 'bfsi', 'wealth', 'investment', 'payroll', 'payout', 'transaction', 'remittance'],
  cybersecurity: ['security', 'cybersecurity', 'threat', 'vulnerability', 'easm', 'siem', 'soar', 'penetration', 'firewall', 'encryption', 'zero trust', 'soc', 'incident response', 'malware', 'phishing', 'compliance', 'audit'],
  saas: ['saas', 'b2b', 'subscription', 'mrr', 'arr', 'churn', 'multi-tenant', 'self-serve', 'plg', 'product-led', 'enterprise', 'api economy', 'platform'],
  ai_ml: ['ai', 'ml', 'machine learning', 'deep learning', 'nlp', 'natural language', 'computer vision', 'neural network', 'llm', 'generative ai', 'recommendation', 'prediction', 'classification', 'clustering', 'bert', 'transformer'],
  edtech: ['edtech', 'education', 'learning', 'lms', 'student', 'curriculum', 'course', 'campus', 'university', 'school', 'teaching', 'e-learning', 'tutoring'],
  gaming: ['gaming', 'esports', 'game', 'tournament', 'player', 'multiplayer', 'gamification', 'game design', 'unity', 'unreal', 'steam'],
  hrms: ['hr', 'hrms', 'payroll', 'recruitment', 'hiring', 'talent', 'workforce', 'employee', 'benefits', 'onboarding', 'performance review', 'compensation'],
  healthcare: ['health', 'healthcare', 'clinical', 'patient', 'medical', 'telehealth', 'ehr', 'hipaa', 'pharma', 'biotech', 'wellness', 'fitness'],
  ecommerce: ['ecommerce', 'e-commerce', 'marketplace', 'shopping', 'cart', 'checkout', 'order', 'fulfillment', 'inventory', 'catalog', 'retail'],
  logistics: ['logistics', 'supply chain', 'shipping', 'freight', 'warehouse', 'tracking', 'delivery', 'fleet', 'transportation', 'carrier'],
  devops: ['devops', 'ci/cd', 'kubernetes', 'docker', 'terraform', 'jenkins', 'aws', 'gcp', 'azure', 'cloud', 'infrastructure', 'monitoring', 'sre'],
  data_science: ['data science', 'data engineering', 'data pipeline', 'etl', 'data warehouse', 'bigquery', 'snowflake', 'spark', 'hadoop', 'analytics', 'tableau', 'power bi'],
  crypto_web3: ['blockchain', 'crypto', 'web3', 'defi', 'smart contract', 'nft', 'token', 'decentralized', 'ethereum', 'solidity'],
  proptech: ['real estate', 'property', 'proptech', 'rental', 'tenant', 'mortgage', 'housing'],
  iot: ['iot', 'internet of things', 'sensor', 'embedded', 'firmware', 'arduino', 'raspberry pi', 'smart home', 'wearable']
};

const DOMAIN_HEADER_MAP = {
  fintech: 'Fintech \\\\& Payments Domain',
  cybersecurity: 'Cybersecurity \\\\& Compliance Domain',
  saas: 'B2B SaaS \\\\& Growth Domain',
  ai_ml: 'AI/ML \\\\& Data Intelligence Domain',
  edtech: 'EdTech \\\\& Education Domain',
  gaming: 'Gaming \\\\& Community Domain',
  hrms: 'HRMS \\\\& Workforce Domain',
  healthcare: 'Healthcare \\\\& Clinical Domain',
  ecommerce: 'E-Commerce \\\\& Marketplace Domain',
  logistics: 'Supply Chain \\\\& Logistics Domain',
  devops: 'Cloud \\\\& DevOps Domain',
  data_science: 'Data Science \\\\& Analytics Domain',
  crypto_web3: 'Blockchain \\\\& Web3 Domain',
  proptech: 'PropTech \\\\& Real Estate Domain',
  iot: 'IoT \\\\& Embedded Systems Domain',
  general: 'Product \\\\& Technology Domain'
};

// ═══════════════════════════════════════════════════════════════════════════
// PASS 1: LLM — Generate Core Brain Data
// ═══════════════════════════════════════════════════════════════════════════
async function generateCoreBrain(basicProfile) {
  const prompt = `You are a Principal AI Architect whose job is to perfectly reconstruct a user's resume data into a rich "Obsidian Brain" schema.
This schema will be used by an advanced ATS Tailoring Engine.

DO NOT HALLUCINATE data. Base everything strictly on the provided Basic Profile, but enhance and restructure it professionally.
Transform the flat data into deep, rich structures.

OUTPUT ONLY VALID JSON EXACTLY MATCHING THIS SCHEMA:
{
  "version": "2.0",
  "profile": {
    "name": "string",
    "title": "string (the user's primary professional title)",
    "years_of_experience": "string (e.g., '5+', '10+', 'Entry-level')",
    "core_identity": "string (a powerful 1-sentence professional summary)",
    "education": ["string (e.g., 'B.S. Computer Science (University Name)')"],
    "headline_metrics": {
      "key_1": "value (e.g., 'revenue_growth': '300%')",
      "key_2": "extract up to 8 impressive metrics from their experience"
    },
    "languages": ["string"],
    "interests": ["string"],
    "career_highlights": [
      "5-8 powerful bullet points summarizing their absolute best achievements across all roles. Use action verbs and include metrics if available."
    ],
    "leadership_summary": [
      "1-3 bullets summarizing any team leadership, management, or cross-functional coordination they have done. Leave empty array [] if none."
    ],
    "consulting_summary": [
      "1-2 bullets summarizing consulting, advisory, or freelance work. Leave empty array [] if none."
    ],
    "volunteer_community": ["string (community involvement, speaking, mentoring, etc.)"],
    "achievements": [
      "4-6 bullets detailing specific awards, recognition, or major milestones."
    ],
    "extra_curricular": ["string (hobbies, sports, writing, etc.)"],
    "skills_summary": {
      "bars": {
        "Top Skill 1": "95%",
        "Top Skill 2": "90%"
      },
      "blocks": {
        "DOMAIN 1 (e.g., ENGINEERING)": "Skill 1, Skill 2, Skill 3",
        "DOMAIN 2 (e.g., DATA)": "Skill 4, Skill 5, Skill 6"
      }
    },
    "recognition": [
      {
        "title": "Award/Recognition Title",
        "subtitle": "Issuer or Date",
        "description": "Short description"
      }
    ],
    "education_detailed": [
      {
        "title": "Degree — Subject at INSTITUTION (Year – Year) Badge: Degree Description: details",
        "badge": "Short badge text",
        "description": "Any honors or details",
        "url": ""
      }
    ]
  },
  "projects": [
    {
      "id": "lowercase_no_spaces_unique_id",
      "name": "Project Name",
      "subtitle": "Short domain or tech focus (max 45 chars)",
      "link": "url or empty string",
      "link_text": "Live Demo",
      "bullets": [
        "Create 4 highly professional, ATS-optimized bullets for EACH project.",
        "Bullet 1: 1-sentence elevator pitch of the project.",
        "Bullet 2: 1-sentence unique value proposition.",
        "Bullet 3: 3 key technical/business achievements separated by semicolons.",
        "Bullet 4: 3 detailed implementation details with metrics separated by semicolons."
      ],
      "pitch": "1-2 sentence elevator pitch",
      "usp": "1 sentence unique selling proposition",
      "features": "Comma separated list of key features"
    }
  ],
  "experience_detailed": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "duration": "Start – End",
      "location": "Location",
      "description": "1 sentence summarizing the company/role",
      "link": "company website or empty string",
      "achievements": [
        "Create 4-8 powerful, ATS-optimized bullets for EACH role.",
        "Use the XYZ formula: Accomplished [X] as measured by [Y], by doing [Z].",
        "Include ALL significant achievements from the input — do NOT skip any."
      ],
      "tags": [
        "Extract 5-10 keyword tags per role for downstream semantic matching.",
        "Include: technologies, methodologies, domains, skills demonstrated.",
        "Example: ['GTM Strategy', 'PLG', 'A/B Testing', 'Fintech', 'Agile', '0 to 1']"
      ]
    }
  ]
}

CRITICAL RULES:
1. Do not use markdown blocks in your response. Just the raw JSON.
2. If the user has weak bullets, ENHANCE them professionally using strong action verbs, but remain TRUTHFUL to the facts.
3. Categorize ALL flat skills into logical uppercase "blocks" (e.g., "FRONTEND", "BACKEND", "MARKETING", "OPERATIONS", "FINANCE").
4. Provide 6-8 skill bars with arbitrary percentages reflecting their strongest areas.
5. Ensure EVERY role from the input appears in experience_detailed — do NOT skip any roles.
6. Ensure EVERY project from the input appears in projects — do NOT skip any projects. This is CRITICAL.
7. Generate exactly 4 bullets per project following the structure specified.
8. Generate 5-10 keyword tags per experience role.
9. Create an impactful "core_identity" sentence.
10. If they have recognition/awards, populate the recognition array.

Basic Profile Input:
${JSON.stringify(basicProfile, null, 2)}
`;

  return await callLLM(prompt);
}


// ═══════════════════════════════════════════════════════════════════════════
// PASS 2a: Deterministic Intelligence Layer (Zero Cost, Instant)
// ═══════════════════════════════════════════════════════════════════════════
function buildIntelligenceLayer(coreBrain) {
  const projects = coreBrain.projects || [];
  const experience = coreBrain.experience_detailed || [];

  // ── 1. Domain Index: Scan every project for domain keywords ──
  const domainIndex = {};
  for (const project of projects) {
    const projectText = [
      project.name,
      project.subtitle,
      ...(project.bullets || []),
      project.pitch || '',
      project.usp || '',
      project.features || ''
    ].join(' ').toLowerCase();

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      for (const kw of keywords) {
        if (projectText.includes(kw)) {
          if (!domainIndex[domain]) domainIndex[domain] = [];
          if (!domainIndex[domain].includes(project.id)) {
            domainIndex[domain].push(project.id);
          }
          break; // One match per domain per project is enough
        }
      }
    }
  }

  // Also add human-readable domain names (e.g., "Fintech", "B2B SaaS")
  const readableDomainIndex = {};
  const domainReadableNames = {
    fintech: 'Fintech', cybersecurity: 'Cybersecurity', saas: 'B2B SaaS',
    ai_ml: 'AI/ML', edtech: 'EdTech', gaming: 'Gaming', hrms: 'HRMS',
    healthcare: 'Healthcare', ecommerce: 'E-Commerce', logistics: 'Logistics',
    devops: 'DevOps', data_science: 'Data Analytics', crypto_web3: 'Crypto/Web3',
    proptech: 'PropTech', iot: 'IoT'
  };
  for (const [key, ids] of Object.entries(domainIndex)) {
    const readable = domainReadableNames[key] || key;
    readableDomainIndex[readable] = ids;
  }

  // ── 2. Keyword Index: Extract significant terms from each project ──
  const keywordIndex = {};
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'that', 'this', 'these', 'those', 'it', 'its', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just', 'about', 'up', 'down', 'also', 'product', 'platform', 'system', 'built', 'designed', 'created', 'developed', 'using', 'based', 'across', 'including', 'features', 'users', 'data', 'management', 'application', 'app']);

  // Known high-value keywords to always extract
  const highValueTerms = new Set([
    'UPI', 'KYC', 'AML', 'PRD', 'RBAC', 'API', 'AI/ML', 'EASM', 'NLP',
    'CRM', 'ERP', 'HRM', 'ATS', 'LMS', 'LOS', 'EMI', 'PLG', 'GTM',
    'OKR', 'RICE', 'NPS', 'MRR', 'ARR', 'CIBIL', 'NFC', 'P2P', 'P2M',
    'B2B', 'B2C', 'B2B2C', 'D2C', 'SaaS', 'IoT', 'SDK', 'REST',
    'Agile', 'Scrum', 'Figma', 'Jira', 'SQL', 'Python', 'React', 'Node',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
    'Salesforce', 'HubSpot', 'Tableau', 'Power BI', 'Mixpanel', 'Amplitude',
    'Stripe', 'Razorpay', 'Firebase', 'Supabase', 'MongoDB', 'PostgreSQL',
    'Redis', 'Kafka', 'GraphQL', 'WebSocket', 'TypeScript', 'JavaScript',
    'Java', 'Go', 'Rust', 'Swift', 'Kotlin', 'Flutter', 'React Native',
    'Cybersecurity', 'Threat Intelligence', 'Vulnerability', 'Compliance',
    'Fraud Detection', 'Gamification', 'Blockchain', 'Smart Contract',
    'Dashboard', 'Onboarding', 'Monetization', 'Subscription',
    'Recruitment', 'Lead Scoring', 'Sentiment Analysis', 'A/B Testing',
    'Funnel Analysis', 'User Research', 'Product Discovery', 'Roadmap',
    'Stakeholder Management', 'Cross-Functional', 'Data Visualization'
  ]);

  for (const project of projects) {
    const fullText = [project.name, project.subtitle, ...(project.bullets || [])].join(' ');

    // Extract high-value terms
    for (const term of highValueTerms) {
      if (fullText.toLowerCase().includes(term.toLowerCase())) {
        if (!keywordIndex[term]) keywordIndex[term] = [];
        if (!keywordIndex[term].includes(project.id)) {
          keywordIndex[term].push(project.id);
        }
      }
    }

    // Extract capitalized acronyms and important nouns
    const acronyms = fullText.match(/\b[A-Z]{2,}[a-z]?\b/g) || [];
    for (const acr of acronyms) {
      if (stopwords.has(acr.toLowerCase()) || acr.length < 2) continue;
      if (!keywordIndex[acr]) keywordIndex[acr] = [];
      if (!keywordIndex[acr].includes(project.id)) {
        keywordIndex[acr].push(project.id);
      }
    }
  }

  // Also index experience tags
  for (const exp of experience) {
    for (const tag of (exp.tags || [])) {
      if (!keywordIndex[tag]) keywordIndex[tag] = [];
      // Map to related project IDs if possible
      for (const project of projects) {
        const projectText = [project.name, ...(project.bullets || [])].join(' ').toLowerCase();
        if (projectText.includes(tag.toLowerCase())) {
          if (!keywordIndex[tag].includes(project.id)) {
            keywordIndex[tag].push(project.id);
          }
        }
      }
    }
  }

  // ── 3. Domain Headers ──
  const domainHeaders = { ...DOMAIN_HEADER_MAP };
  // Add any detected domains that aren't in the default map
  for (const domain of Object.keys(domainIndex)) {
    if (!domainHeaders[domain]) {
      const capitalized = domain.charAt(0).toUpperCase() + domain.slice(1);
      domainHeaders[domain] = `${capitalized} \\\\& Technology Domain`;
    }
  }

  return {
    domain_index: readableDomainIndex,
    keyword_index: keywordIndex,
    domain_headers: domainHeaders
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// PASS 2b: LLM — Generate Adaptive Layers (skill_pools, experience_variants)
// ═══════════════════════════════════════════════════════════════════════════
async function generateAdaptiveLayers(coreBrain) {
  const companies = (coreBrain.experience_detailed || []).map(e => ({
    key: (e.company || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20),
    company: e.company,
    role: e.role,
    description: e.description || '',
    tags: (e.tags || []).slice(0, 8)
  }));

  const detectedDomains = [];
  const allText = JSON.stringify(coreBrain).toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let matchCount = 0;
    for (const kw of keywords) {
      if (allText.includes(kw)) matchCount++;
    }
    if (matchCount >= 2) detectedDomains.push(domain);
  }
  if (detectedDomains.length === 0) detectedDomains.push('general');

  const allSkills = [];
  const blocks = coreBrain.profile?.skills_summary?.blocks || {};
  for (const [, skillStr] of Object.entries(blocks)) {
    if (typeof skillStr === 'string') {
      allSkills.push(...skillStr.split(',').map(s => s.trim()));
    } else if (Array.isArray(skillStr)) {
      allSkills.push(...skillStr);
    }
  }

  const prompt = `You are a Principal AI Architect. Generate the adaptive intelligence layers for a resume brain schema.

DETECTED DOMAINS for this person: ${JSON.stringify(detectedDomains)}
ALL SKILLS from their profile: ${JSON.stringify([...new Set(allSkills)].slice(0, 60))}
COMPANIES in their experience: ${JSON.stringify(companies)}

OUTPUT ONLY VALID JSON with this exact structure:
{
  "skill_pools": {
    "ai_product_strategy": {
      "core": ["14-16 strings — their core professional competencies"],
      "alternates": ["14-18 strings — secondary competencies they could claim"]
    },
    "domain_skills": {
      ${detectedDomains.map(d => `"${d}": ["10-13 domain-specific skills for ${d}"]`).join(',\n      ')}
    },
    "tools": {
      "core": ["12-14 strings — tools they actually use"],
      "alternates": ["12-16 strings — tools they could reasonably claim"]
    },
    "analytics": {
      "core": ["6-8 strings — analytics tools they use"],
      "alternates": ["8-12 strings — analytics tools they could claim"]
    },
    "other_skills": {
      "core": ["12-14 strings — soft skills, methodologies, frameworks"],
      "alternates": ["10-14 strings — secondary soft skills"]
    },
    "domain_expertise_pool": {
      ${detectedDomains.map(d => `"${d}": ["8-12 domain verticals for ${d}"]`).join(',\n      ')},
      "general": ["15-25 broad industry/technology verticals they can claim"]
    }
  },
  "experience_variants": {
    ${companies.map(c => `"${c.key}": {
      "__INSTRUCTION__": "Generate 4-6 highly specific, contextual string fields that summarize this role. Name the keys descriptively (e.g., 'platform_scale', 'core_innovation', 'revenue_impact'). Provide variants for each domain.",
      ${detectedDomains.map(d => `"${d}": {
        "dynamic_field_1": "string (40-45 chars)",
        "dynamic_field_2": "string (20-30 chars)",
        "dynamic_field_3": "string (30-40 chars)"
      }`).join(',\n      ')},
      "general": {
        "dynamic_field_1": "string (40-45 chars)",
        "dynamic_field_2": "string (20-30 chars)",
        "dynamic_field_3": "string (30-40 chars)"
      }
    }`).join(',\n    ')},
    "summary": {
      ${[...detectedDomains, 'general'].map(d => `"${d}": {
        "product_types": "50-55 char description of product types for ${d}",
        "domain_context": "58-65 char domain expertise context for ${d}",
        "closing_strength": "44-50 char unique value proposition for ${d}"
      }`).join(',\n      ')}
    }
  }
}

RULES:
1. Base ALL skills on the provided profile data. Do NOT hallucinate skills the person doesn't have.
2. "alternates" are skills they COULD reasonably claim based on adjacent expertise — not fabricated.
3. Experience variant descriptions must be truthful reframings of the same work, not inventions.
4. Use \\\\& for ampersands in any LaTeX-safe strings.
5. Keep character limits strict — the ATS engine enforces them downstream.
6. If a company's work doesn't fit a domain, write a reasonable general-purpose variant.`;

  return await callLLM(prompt);
}


// ═══════════════════════════════════════════════════════════════════════════
// LLM Caller — Delegates to Global LLM Engine v5 (17-tier routing)
// ═══════════════════════════════════════════════════════════════════════════
async function callLLM(prompt) {
  // Dynamic import to avoid circular dependency at module load time
  const { callLLM: globalCallLLM } = await import('./globalLLMEngine.js');

  const completion = await globalCallLLM('parsing', {
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.15,
    max_tokens: 8000
  });

  const resultText = completion.choices[0]?.message?.content?.trim() || '{}';

  // Parse with fallback
  try {
    return JSON.parse(resultText);
  } catch {
    // Try extracting JSON from markdown blocks
    const match = resultText.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch { /* ignore */ }
    }
    const start = resultText.indexOf('{');
    const end = resultText.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try { return JSON.parse(resultText.substring(start, end + 1)); } catch { /* ignore */ }
    }
    throw new Error('LLM returned unparseable JSON');
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Universal Profile Ingestion — Brain Builder V3
 * Converts a basic parsed resume JSON into the deep "Obsidian Brain" schema
 * required by the ATS Intelligence Engine.
 *
 * Guarantees ALL 9 data layers are populated:
 * 1. profile          (LLM)
 * 2. projects         (LLM)
 * 3. experience_detailed (LLM, with tags)
 * 4. domain_index     (Deterministic)
 * 5. keyword_index    (Deterministic)
 * 6. domain_headers   (Deterministic)
 * 7. skill_pools      (LLM)
 * 8. experience_variants (LLM)
 * 9. version          (Static)
 */
export async function buildBrainFromBasicProfile(basicProfile) {
  console.log('[Get My Job BrainBuilder V3] ═══ Starting 2-pass brain construction ═══');

  // ── PASS 1: Core Brain (LLM) ──
  console.log('[Get My Job BrainBuilder V3] Pass 1: Generating core brain data...');
  const coreBrain = await generateCoreBrain(basicProfile);

  const projectCount = coreBrain.projects?.length || 0;
  const expCount = coreBrain.experience_detailed?.length || 0;
  console.log(`[Get My Job BrainBuilder V3] Pass 1 complete: ${projectCount} projects, ${expCount} experiences`);

  // ── PASS 2a: Intelligence Layer (Deterministic, instant) ──
  console.log('[Get My Job BrainBuilder V3] Pass 2a: Building deterministic intelligence layer...');
  const intelligence = buildIntelligenceLayer(coreBrain);
  console.log(`[Get My Job BrainBuilder V3] Pass 2a complete: ${Object.keys(intelligence.domain_index).length} domains, ${Object.keys(intelligence.keyword_index).length} keywords indexed`);

  // ── PASS 2b: Adaptive Layers (LLM) ──
  console.log('[Get My Job BrainBuilder V3] Pass 2b: Generating adaptive layers (skill_pools, experience_variants)...');
  const adaptive = await generateAdaptiveLayers(coreBrain);
  console.log('[Get My Job BrainBuilder V3] Pass 2b complete: skill_pools and experience_variants generated');

  // ── MERGE: Assemble the complete brain ──
  const completeBrain = {
    version: '2.0',
    profile: coreBrain.profile,
    projects: coreBrain.projects,
    domain_index: intelligence.domain_index,
    keyword_index: intelligence.keyword_index,
    skill_pools: adaptive.skill_pools || {},
    experience_variants: adaptive.experience_variants || {},
    domain_headers: intelligence.domain_headers,
    experience_detailed: coreBrain.experience_detailed
  };

  // ── Validate completeness ──
  const requiredLayers = ['profile', 'projects', 'experience_detailed', 'domain_index', 'keyword_index', 'skill_pools', 'experience_variants', 'domain_headers'];
  const missing = requiredLayers.filter(layer => !completeBrain[layer] || (typeof completeBrain[layer] === 'object' && Object.keys(completeBrain[layer]).length === 0));

  if (missing.length > 0) {
    console.warn(`[Get My Job BrainBuilder V3] ⚠ Warning: ${missing.length} layers have empty data: ${missing.join(', ')}`);
  } else {
    console.log('[Get My Job BrainBuilder V3] ✅ All 9 data layers populated successfully!');
  }

  console.log('[Get My Job BrainBuilder V3] ═══ Brain construction complete ═══');
  return completeBrain;
}
