/**
 * Dynamic Email Template Engine v2 — 3-Template Architecture
 * 
 * ⚠️ THIS FILE IS IMPORTED BY CLIENT COMPONENTS — NO fs/path/server modules
 * 
 * Templates:
 *   1. Startup Founder Connect — bold, founder-aware, leadership-anchored
 *   2. Corporate Executive Pitch — professional gravitas, structured, academics
 *   3. Universal Dynamic — auto-adapts when company type is unclear
 */

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY TYPE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

const STARTUP_SIGNALS = [
  'startup', 'seed', 'series a', 'series b', 'series c', 'yc', 'y combinator',
  'high-growth', 'early-stage', 'founding', 'co-founder', 'disrupt',
  'venture', 'bootstrapped', 'pre-seed', 'incubator', 'accelerator',
  'stealth', 'we are building', 'join our founding', 'fast-paced startup',
  'equity', 'esop', 'stock options', 'scrappy', 'zero to one'
];

const CORPORATE_SIGNALS = [
  'enterprise', 'fortune 500', 'established', 'multinational', 'mnc',
  'bank', 'banking', 'insurance', 'corporation', 'conglomerate', 'listed',
  'public company', 'global leader', 'decades of experience', 'nbfc',
  'rbi', 'sebi', 'compliance', 'regulated', 'large-scale', 'group company',
  'subsidiary', 'holding company', 'publicly traded', 'nse', 'bse'
];

export function detectCompanyType(jdText, companyName) {
  const text = ((jdText || '') + ' ' + (companyName || '')).toLowerCase();
  const startupScore = STARTUP_SIGNALS.filter(s => text.includes(s)).length;
  const corporateScore = CORPORATE_SIGNALS.filter(s => text.includes(s)).length;

  if (startupScore > corporateScore) return 'startup';
  if (corporateScore > startupScore) return 'corporate';
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN DETECTION — Returns a SINGLE domain phrase for value prop
// ═══════════════════════════════════════════════════════════════════════════

const DOMAIN_MAP = {
  fintech: { keywords: ['upi', 'payments', 'banking', 'lending', 'credit', 'neobank', 'wallet', 'kyc', 'aml', 'pci dss', 'iso 20022', 'open banking', 'prepaid', 'forex', 'settlement', 'ledger', 'insurance', 'nbfc', 'rbi', 'wealth', 'trading', 'demat', 'mutual fund'], label: 'FinTech and digital payments' },
  ai_ml: { keywords: ['ai', 'ml', 'machine learning', 'llm', 'gpt', 'generative ai', 'nlp', 'deep learning', 'rag', 'vector', 'prompt engineering', 'chatbot', 'computer vision', 'model training'], label: 'AI/ML and intelligent systems' },
  saas: { keywords: ['saas', 'b2b', 'enterprise', 'multi-tenant', 'subscription', 'arr', 'mrr', 'churn', 'customer success', 'onboarding', 'rbac', 'api-first'], label: 'enterprise SaaS' },
  ecommerce: { keywords: ['e-commerce', 'ecommerce', 'marketplace', 'cart', 'checkout', 'supply chain', 'inventory', 'omnichannel', 'retail', 'merchant', 'catalog'], label: 'E-Commerce and marketplace platforms' },
  gaming: { keywords: ['gaming', 'esports', 'tournament', 'matchmaking', 'in-app purchase', 'player retention', 'engagement loop', 'game'], label: 'gaming and esports' },
  healthtech: { keywords: ['health', 'medical', 'clinical', 'pharma', 'patient', 'diagnostic', 'telemedicine', 'healthcare', 'hospital'], label: 'HealthTech and digital health' },
  edtech: { keywords: ['education', 'edtech', 'learning', 'course', 'lms', 'student', 'admission', 'curriculum', 'university'], label: 'EdTech and digital learning' },
  logistics: { keywords: ['logistics', 'freight', 'supply chain', 'carrier', 'shipping', 'warehouse', 'delivery', 'fleet', 'tracking'], label: 'logistics and supply chain' },
  hrtech: { keywords: ['hrms', 'payroll', 'recruitment', 'hiring', 'talent', 'workforce', 'employee', 'ats', 'hr'], label: 'HR Tech and workforce management' },
  cybersecurity: { keywords: ['security', 'vulnerability', 'threat', 'penetration', 'attack surface', 'siem', 'zero trust', 'cybersecurity'], label: 'cybersecurity' },
  consumer: { keywords: ['consumer', 'b2c', 'user growth', 'retention', 'engagement', 'social', 'content', 'creator', 'media'], label: 'consumer technology' },
};

export function detectDomain(jdText) {
  const text = (jdText || '').toLowerCase();
  let bestDomain = 'technology';
  let bestScore = 0;

  for (const [, config] of Object.entries(DOMAIN_MAP)) {
    const score = config.keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = config.label;
    }
  }

  return bestDomain;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE STRUCTURES — 3 Templates
// ═══════════════════════════════════════════════════════════════════════════

export const TEMPLATE_STRUCTURES = [
  {
    id: 1,
    name: "Startup Founder Connect",
    type: "startup",
    subjectTemplate: "Application for {role} at {company} — Joshua Kanatt | Ex Founder & CPO | Immediate Joiner",
    bodyTemplate: `<p>Hi {recruiterName},</p>
<p>I am incredibly excited about the {role} opportunity at {company}. Having followed {founderReference}'s vision for {companyMission}, I am inspired by the opportunity to contribute. I bring a strong foundation in {topJDSkill1}, {topJDSkill2}, and hands on experience owning end to end product lifecycle from ideation to launch and optimization, and I believe my execution speed and technical depth align perfectly with what your team is building.</p>
<p>{experienceProjectParagraph}</p>
<p>I have attached my resume for your review. You can also explore my most relevant work directly here:<br/>{portfolioLinks}</p>
<p>I look forward to discussing how my background can directly contribute to your team's success.</p>
{candidateDetailsBlock}
{signatureBlock}`
  },
  {
    id: 2,
    name: "Corporate Executive Pitch",
    type: "corporate",
    subjectTemplate: "Application: {role} at {company} — Joshua Kanatt | 5+ Yrs | Ex Founder & CPO | Immediate Joiner",
    bodyTemplate: `<p>Hi {recruiterName},</p>
<p>I am excited about the {role} opportunity at {company}, particularly in the realm of {jdSpecificDomain}, as it closely aligns with my passion for driving innovative {domainLabel} products and my experience in architecting and scaling platforms that integrate complex {domainContext} and user experiences.</p>
<p>{experienceProjectParagraph}</p>
<p>As an Ex Founder and Product Leader with 5+ years of deep experience in {domainLabel}, I have built and scaled a company to 200+ employees without external funding, led 60+ engineers, and shipped 30+ products from zero to one. I own the entire product journey, from deep market research and PRD execution to {domainSpecificSkills}, combining strong product thinking with operational excellence and a relentless user first mindset.</p>
<p>I hold a B.Tech in Computer Science from Hindusthan College of Engineering and Technology, a Global MBA from Deakin Business School, an M.S. in Data Science from LJMU, and a PGP from IMT Ghaziabad. As the Founder and CEO of GAMERS TAG, I was selected for 6 global incubation programs including Stanford SeedSpark, NASSCOM 10K Startups, Cisco LaunchPad, Microsoft for Startups, and Razorpay Rize, and have been recognized among India's Top Product Builders.</p>
<p>I have attached my resume for your review and would love for you to explore my portfolio. I have had an incredible product journey building highly scalable platforms across diverse domains, and I believe the work speaks for itself.</p>
{candidateDetailsBlock}
{signatureBlock}`
  },
  {
    id: 3,
    name: "Universal Dynamic",
    type: "universal",
    subjectTemplate: "Application for {role} | {company} | Ex Founder & CPO | Immediate Joiner",
    bodyTemplate: `<p>Hi {recruiterName},</p>
<p>{hookParagraph}</p>
<p>{experienceProjectParagraph}</p>
<p>As an Ex Founder who built a company to 200+ employees and shipped 30+ products from zero to one in {domainLabel}, I own the entire product journey, from deep market research and data driven validation to engineering collaboration and GTM execution. I combine strong product thinking with {domainSpecificSkills} and a natural instinct for anticipating user needs.</p>
<p>I have attached my resume and would love for you to explore my portfolio. The depth and scale of platforms I have built tells the story better than any email can.</p>
{candidateDetailsBlock}
{signatureBlock}`
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// FIXED BLOCKS — IMMUTABLE
// ═══════════════════════════════════════════════════════════════════════════

export function buildCandidateDetailsBlock(profile) {
  const p = profile || {};
  return `<br>
<b>Candidate Details:</b><br>
Full Name: ${p.name || 'Joshua Kanatt'}<br>
Current Company: ${p.company || 'Neshma'}<br>
LinkedIn: ${(p.linkedin || 'linkedin.com/in/joshuakanatt').replace('https://', '')}<br>
Portfolio: ${(p.portfolio || 'jk-lac.vercel.app/#projects').replace('https://', '')}<br>
Mobile: ${p.phone || '+91 85472 58015'}<br>
Email: ${p.email || 'joshuakanatt66@gmail.com'}<br>
Overall Experience: ${p.experience_years || '5+'}+ Years<br>
Current Location: ${p.location || 'Bengaluru'}<br>
Notice Period: ${p.notice_period || 'Immediate / 10 Days'}<br>
Current CTC: ${p.current_ctc || '28 LPA'}<br>
Expected CTC: ${p.expected_ctc || '28-36 LPA (Negotiable)'}<br>`;
}

export function buildSignatureBlock(profile) {
  const p = profile || {};
  const name = p.name || 'Joshua Kanatt';
  const phone = p.phone || '+91 85472 58015';
  const email = p.email || 'joshuakanatt66@gmail.com';
  const signoff = p.custom_signoff || 'Top Product Builder in India';
  
  return `<p>Would love to get on a quick call and walk you through how my experience can add value to your team. Looking forward to hearing from you.</p>
<p>Warm Regards,<br>
${name}<br>
${signoff}<br>
${phone}<br>
${email}</p>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildTemplateContext(profile) {
  const p = profile || {};
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || 'Candidate';
  const firstName = p.first_name || name.split(' ')[0] || 'Candidate';
  const email = p.email || '';
  const phone = p.phone || '';
  const linkedin = p.linkedin || '';
  const portfolio = p.portfolio || '';
  const currentCompany = p.company || '';
  const industry = p.industry || '';
  const targetRole = p.target_role || '';
  const title = p.title || targetRole || '';
  const location = p.location || '';
  const experienceYears = p.experience_years || '5+ Yrs';
  const noticePeriod = p.notice_period || '';
  const currentCtc = p.current_ctc || '';
  const expectedCtc = p.expected_ctc ? (p.is_negotiable ? `${p.expected_ctc} (Negotiable)` : p.expected_ctc) : '';
  const skills = Array.isArray(p.skills) ? p.skills.slice(0, 5).join(', ') : (p.skills || 'Modern Tech Stack');
  
  const customTagline = p.custom_tagline || title || 'Product Leader';
  const customSignoff = p.custom_signoff || title || 'Product Manager';
  const showCtc = p.show_ctc_in_emails === true;
  const showNoticePeriod = p.show_notice_period !== false;

  const experiences = Array.isArray(p.experience) ? p.experience : [];
  const exp1 = experiences[0] || {};
  const exp2 = experiences[1] || {};

  const edu = Array.isArray(p.education) ? p.education : [];
  const edu_summary = edu.map(e => `I hold a ${e.degree || 'Degree'} from ${e.institution || 'University'}`).join(', ') + '.';

  const signoff = `<p>Sincerely,<br/>${name}</p>`;
  return {
    name,
    firstName,
    email,
    phone,
    linkedin,
    portfolio,
    currentCompany,
    industry,
    targetRole,
    title,
    location,
    experienceYears,
    noticePeriod,
    currentCtc,
    expectedCtc,
    skills,
    customTagline,
    customSignoff,
    exp1_title: exp1.title || 'Role',
    exp1_company: exp1.company || 'my previous company',
    exp1_description: exp1.description || 'I drove significant impact.',
    exp2_title: exp2.title || 'Role',
    exp2_company: exp2.company || 'my earlier company',
    exp2_description: exp2.description || 'I scaled operations successfully.',
    edu_summary,
    signoff,
    candidateDetailsBlock: buildCandidateDetailsBlock(p),
    signatureBlock: buildSignatureBlock(p)
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE RENDERER
// ═══════════════════════════════════════════════════════════════════════════

export function renderTemplate(templateString, profileContext, jobContext = {}) {
  const context = {
    ...profileContext,
    company: jobContext.company || '[Company]',
    role: jobContext.role || '[Role]',
    recruiterName: jobContext.recruiterName || 'there',
    founderReference: jobContext.founderReference || 'your leadership',
    companyMission: jobContext.companyMission || 'driving innovation',
    topJDSkill1: jobContext.topJDSkill1 || 'product strategy',
    topJDSkill2: jobContext.topJDSkill2 || 'cross-functional execution',
    jdSpecificDomain: jobContext.jdSpecificDomain || 'product management',
    domainLabel: jobContext.domainLabel || 'technology',
    domainContext: jobContext.domainContext || 'technical workflows',
    domainSpecificSkills: jobContext.domainSpecificSkills || 'engineering collaboration and GTM execution',
    experienceProjectParagraph: jobContext.experienceProjectParagraph || '',
    hookParagraph: jobContext.hookParagraph || '',
    portfolioLinks: jobContext.portfolioLinks || '',
  };

  let rendered = templateString;
  
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string' || typeof value === 'number') {
      const regex = new RegExp(`{${key}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
  }

  return rendered;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-SELECT TEMPLATE based on company type
// ═══════════════════════════════════════════════════════════════════════════

export function autoSelectTemplate(companyType) {
  switch (companyType) {
    case 'startup':
      return TEMPLATE_STRUCTURES.find(t => t.id === 1);
    case 'corporate':
      return TEMPLATE_STRUCTURES.find(t => t.id === 2);
    default:
      return TEMPLATE_STRUCTURES.find(t => t.id === 3);
  }
}
