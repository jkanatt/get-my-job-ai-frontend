/**
 * deterministicCompanyContext.js — Component 2 (V2 UPGRADE)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Hybrid Company Intelligence Engine
 * 
 * V2 Upgrades:
 *   - Tries FREE LLM API (OmniRoute) for real company research
 *   - Falls back to domain templates in <100ms if API fails
 *   - 2-second timeout for API call (never blocks pipeline)
 *   - Enriches company context with hidden terminology
 *   - Profile-agnostic: works for any company/domain
 * 
 * Architecture:
 *   1. Try OmniRoute free LLM (2s timeout)
 *   2. If success → rich company intelligence  
 *   3. If timeout/fail → instant domain template fallback
 */

// ─── Domain Templates (Fallback) ────────────────────────────────────────
const DOMAIN_TEMPLATES = {
  fintech: {
    industry_context: 'Financial technology sector focused on digital payments, lending, and banking infrastructure',
    core_products_services: ['Digital Payment Platform', 'Lending & Credit Solutions', 'Banking APIs'],
    business_model: 'B2C/B2B fintech platform monetized through transaction fees, subscription tiers, and financial product margins',
    tech_stack_clues: ['React', 'Node.js', 'Python', 'PostgreSQL', 'Redis', 'Kafka', 'AWS', 'Docker', 'Kubernetes'],
    culture_and_values: ['Move fast with compliance', 'Data-driven decision making', 'Customer trust first'],
    hidden_terminology: ['UPI', 'KYC', 'AML', 'PCI DSS', 'RBI compliance', 'payment rails', 'settlement', 'reconciliation', 'ledger'],
    resume_optimization_strategy: 'Emphasize financial product experience, compliance awareness, and transaction-scale metrics.'
  },
  payments: {
    industry_context: 'Payment processing and digital transaction infrastructure',
    core_products_services: ['Payment Gateway', 'Merchant Dashboard', 'Settlement Engine'],
    business_model: 'Transaction fee-based revenue from merchant services',
    tech_stack_clues: ['Java', 'Spring Boot', 'PostgreSQL', 'RabbitMQ', 'Redis'],
    culture_and_values: ['Reliability first', 'Sub-second latency', 'Regulatory compliance'],
    hidden_terminology: ['acquirer', 'issuer', 'card network', 'tokenization', 'chargeback', 'POS'],
    resume_optimization_strategy: 'Highlight transaction processing, uptime metrics, and PCI compliance.'
  },
  cybersecurity: {
    industry_context: 'Enterprise cybersecurity and threat detection',
    core_products_services: ['SIEM Platform', 'Threat Intelligence', 'Vulnerability Management'],
    business_model: 'Enterprise SaaS with seat-based licensing',
    tech_stack_clues: ['Python', 'Go', 'Elasticsearch', 'Kafka', 'Docker', 'Kubernetes'],
    culture_and_values: ['Security-first mindset', 'Zero trust architecture'],
    hidden_terminology: ['SOC', 'SIEM', 'IDS/IPS', 'MITRE ATT&CK', 'CVE', 'pentest', 'red team', 'incident response'],
    resume_optimization_strategy: 'Emphasize security product experience and compliance frameworks.'
  },
  saas: {
    industry_context: 'Enterprise SaaS platform for business workflow automation',
    core_products_services: ['Cloud Platform', 'Admin Dashboard', 'API & Integrations'],
    business_model: 'Subscription-based SaaS with tiered pricing and enterprise contracts',
    tech_stack_clues: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'AWS'],
    culture_and_values: ['Ship fast, iterate', 'Customer-obsessed', 'Data-driven'],
    hidden_terminology: ['ARR', 'MRR', 'churn rate', 'NRR', 'PLG', 'self-serve', 'onboarding'],
    resume_optimization_strategy: 'Emphasize SaaS metrics (ARR, churn, NRR) and product-led growth.'
  },
  ai_ml: {
    industry_context: 'AI/ML technology company building intelligent automation',
    core_products_services: ['AI Platform', 'ML Pipeline', 'Recommendation Engine'],
    business_model: 'API-as-a-service and enterprise AI platform licensing',
    tech_stack_clues: ['Python', 'TensorFlow', 'PyTorch', 'FastAPI', 'Docker', 'MLflow'],
    culture_and_values: ['Research-driven', 'Responsible AI', 'Experimentation'],
    hidden_terminology: ['LLM', 'RAG', 'fine-tuning', 'embeddings', 'vector database', 'MLOps'],
    resume_optimization_strategy: 'Highlight AI/ML product experience and model deployment at scale.'
  },
  gaming: {
    industry_context: 'Mobile and online gaming company',
    core_products_services: ['Mobile Game Platform', 'In-App Economy', 'Social Features'],
    business_model: 'Free-to-play with in-app purchases and battle passes',
    tech_stack_clues: ['Unity', 'C#', 'Node.js', 'Redis', 'Firebase', 'PlayFab'],
    culture_and_values: ['Player-first design', 'Data-driven monetization'],
    hidden_terminology: ['DAU', 'MAU', 'D1/D7 retention', 'ARPDAU', 'battle pass', 'matchmaking', 'clan'],
    resume_optimization_strategy: 'Highlight gaming engagement metrics and virtual economy design.'
  },
  ecommerce: {
    industry_context: 'E-commerce and digital retail platform',
    core_products_services: ['Online Marketplace', 'Seller Dashboard', 'Recommendation Engine'],
    business_model: 'Commission-based marketplace with advertising revenue',
    tech_stack_clues: ['React', 'Node.js', 'Python', 'Elasticsearch', 'Redis', 'Kafka'],
    culture_and_values: ['Customer obsession', 'Operational excellence'],
    hidden_terminology: ['GMV', 'AOV', 'conversion rate', 'cart abandonment', 'search relevance'],
    resume_optimization_strategy: 'Emphasize e-commerce metrics and search/recommendation systems.'
  },
  healthcare: {
    industry_context: 'Healthcare technology company',
    core_products_services: ['EHR/EMR Platform', 'Telemedicine', 'Clinical Analytics'],
    business_model: 'Enterprise licensing with per-provider pricing',
    tech_stack_clues: ['React', 'Java', 'Python', 'HL7/FHIR', 'PostgreSQL'],
    culture_and_values: ['Patient safety first', 'HIPAA compliance'],
    hidden_terminology: ['EHR', 'EMR', 'HIPAA', 'HL7', 'FHIR', 'PHI', 'interoperability'],
    resume_optimization_strategy: 'Highlight healthcare compliance and clinical workflow optimization.'
  },
  edtech: {
    industry_context: 'Education technology platform',
    core_products_services: ['LMS', 'Assessment Platform', 'Content Delivery'],
    business_model: 'Freemium with premium subscriptions and B2B licensing',
    tech_stack_clues: ['React', 'Node.js', 'Python', 'MongoDB', 'AWS', 'Firebase'],
    culture_and_values: ['Impact-driven', 'Learner-first design'],
    hidden_terminology: ['LMS', 'MOOC', 'adaptive learning', 'gamification', 'completion rate'],
    resume_optimization_strategy: 'Emphasize student engagement and learning outcome improvements.'
  },
  logistics: {
    industry_context: 'Logistics and supply chain technology',
    core_products_services: ['Fleet Management', 'Route Optimization', 'Tracking Dashboard'],
    business_model: 'SaaS with per-shipment pricing',
    tech_stack_clues: ['React', 'Python', 'Go', 'PostgreSQL', 'Google Maps API'],
    culture_and_values: ['Operational efficiency', 'Real-time visibility'],
    hidden_terminology: ['last mile', 'TMS', 'WMS', '3PL', 'ETD/ETA', 'proof of delivery'],
    resume_optimization_strategy: 'Emphasize logistics efficiency metrics and route optimization.'
  },
  hrms: {
    industry_context: 'HR technology platform for workforce management',
    core_products_services: ['HRMS Platform', 'Payroll Engine', 'Employee Portal'],
    business_model: 'Per-employee-per-month SaaS pricing',
    tech_stack_clues: ['React', 'Node.js', 'PostgreSQL', 'Redis', 'AWS'],
    culture_and_values: ['Employee-first design', 'Compliance automation'],
    hidden_terminology: ['HRIS', 'payroll processing', 'statutory compliance', 'leave management'],
    resume_optimization_strategy: 'Highlight HR product experience and compliance automation.'
  },
  general: {
    industry_context: 'Technology company building innovative digital products',
    core_products_services: ['Digital Platform', 'Mobile App', 'Analytics Dashboard'],
    business_model: 'Technology platform with diversified revenue streams',
    tech_stack_clues: ['React', 'Node.js', 'Python', 'PostgreSQL', 'AWS'],
    culture_and_values: ['Innovation-driven', 'Agile methodology'],
    hidden_terminology: ['product roadmap', 'sprint planning', 'OKRs', 'A/B testing'],
    resume_optimization_strategy: 'Emphasize cross-functional product leadership and data-driven decisions.'
  }
};

/**
 * Hybrid Company Context Generator.
 * Tries free LLM API first, falls back to domain templates.
 *
 * @param {Object} jdIntel - Output from JD parser
 * @param {boolean} useLLM - Whether to try LLM enrichment (default: true)
 * @returns {Promise<Object|null>} Company context
 */
export async function deterministicCompanyContext(jdIntel, useLLM = true) {
  const domain = jdIntel.domain || 'general';
  const companyName = jdIntel.company_name;
  const template = JSON.parse(JSON.stringify(DOMAIN_TEMPLATES[domain] || DOMAIN_TEMPLATES.general));

  // If no company detected, still return domain template (useful for skills/keywords)
  if (!companyName || jdIntel.identification_confidence < 30) {
    return template;
  }

  // Personalize template with company name
  template.industry_context = `${companyName} — ${template.industry_context}`;

  // ── Try FREE LLM enrichment with 2s timeout ──
  if (useLLM) {
    try {
      const enriched = await Promise.race([
        enrichWithLLM(companyName, domain, jdIntel),
        new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout (2s)')), 2000))
      ]);

      if (enriched) {
        // Merge LLM enrichment with template (LLM data takes priority)
        return {
          ...template,
          ...enriched,
          hidden_terminology: [...new Set([...(template.hidden_terminology || []), ...(enriched.hidden_terminology || [])])],
        };
      }
    } catch (err) {
      console.log(`[DET CompanyContext] LLM enrichment failed (${err.message}) — using domain template`);
    }
  }

  return template;
}

/**
 * Try to enrich company context using OmniRoute free LLM.
 */
async function enrichWithLLM(companyName, domain, jdIntel) {
  try {
    // Dynamic import to avoid hard dependency
    const { callLLM } = await import('@/infrastructure/services/llmRouter');

    const completion = await callLLM('company_research', {
      messages: [{
        role: 'system',
        content: 'You are a company research assistant. Given a company name and industry, provide brief intelligence. Output ONLY valid JSON.'
      }, {
        role: 'user',
        content: `Company: ${companyName}
Industry: ${domain}
Role: ${jdIntel.role_type || 'Product Manager'}

Return this JSON:
{
  "industry_context": "1-line description of what ${companyName} does",
  "business_model": "How they make money (1 line)",
  "hidden_terminology": ["5-8 industry-specific terms used at this company"],
  "resume_optimization_strategy": "1-line advice for tailoring resume to this company"
}`
      }],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (result.industry_context) {
      console.log(`[DET CompanyContext] ✅ LLM enriched: ${companyName}`);
      return result;
    }
  } catch (e) {
    // Silently fail — template fallback handles it
  }

  return null;
}
