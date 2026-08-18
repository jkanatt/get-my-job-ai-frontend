import { callLLM } from './llmRouter.js';

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
  'live.com', 'msn.com', 'me.com', 'mac.com'
]);

/**
 * Capitalizes the first letter of each word
 */
function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * ENGINE A: Domain Heuristics
 * Parses the domain directly from the email address.
 */
async function resolveViaDomain(email) {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1].toLowerCase();
  
  if (GENERIC_DOMAINS.has(domain)) {
    return null;
  }

  let name = domain.split('.')[0];
  name = name.replace(/-/g, ' ');
  return toTitleCase(name);
}

/**
 * ENGINE B: NLP Regex Pattern Matcher
 * Scans the JD for highly confident explicit declarations of the company name.
 */
async function resolveViaRegex(jdText) {
  if (!jdText) return null;
  
  // Clean up excessive whitespace
  const text = jdText.replace(/\s+/g, ' ');

  const patterns = [
    /About\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2})(?=\s|[,.!?:;])/i,
    /Welcome to\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2})(?=\s|[,.!?:;])/i,
    /At\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2}),?\s+(?:we\s+believe|we\s+are|we're|our\s+mission)/i,
    /Join\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2})(?=\s|[,.!?:;])/i,
    // Additional patterns for broader coverage
    /([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2})\s+is\s+(?:hiring|looking\s+for|seeking)/i,
    /Careers?\s+at\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2})(?=\s|[,.!?:;])/i,
    /Work\s+at\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2})(?=\s|[,.!?:;])/i,
    /(?:at|with)\s+([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2}),?\s+we\s+/i,
    /Company:\s*([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2})(?=\s|[,.!?:;\n])/i,
    /([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,2})\s+team\s+is\s+(?:looking|growing|expanding)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Filter out generic capitalized phrases that aren't companies
      const avoid = ['Us', 'The Team', 'Our', 'This Role', 'The Company'];
      if (!avoid.some(a => candidate.toLowerCase() === a.toLowerCase())) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * ENGINE C: Deep AI Contextual Analysis
 * Uses Groq to semantically deduce the company name.
 */
async function resolveViaAI(email, jdText) {
  if (!process.env.GROQ_API_KEY) return null;

  try {
    const prompt = `You are an expert recruiter and corporate intelligence AI.
Your task is to determine the exact, proper noun name of the hiring company based on the provided Job Description and the recruiter's email.

Rules:
1. If the company is explicitly named in the JD, return that exact name.
2. If the JD is confidential/anonymous but the recruiter's email belongs to a corporate domain (e.g. hr@stripe.com), deduce the company name from the domain (e.g. Stripe).
3. If neither the JD nor the email reveal the specific company name (e.g. confidential JD + gmail address), return "your company".
4. NEVER return long descriptive sentences like "one of the top apps" or "a fast-growing startup". We strictly want the brand name or "your company".

Respond ONLY with a valid JSON object in this format:
{
  "company_name": "Extracted Brand Name or 'your company'"
}

Data:
Recruiter Email: ${email || 'None provided'}
JD Text:
${jdText ? jdText.substring(0, 3000) : 'None provided'}
`;

    const response = await callLLM('company_research', {
      messages: [
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 50,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content.trim());
    
    if (parsed.company_name && 
        parsed.company_name.toLowerCase() !== 'unknown' && 
        parsed.company_name.toLowerCase() !== 'none' &&
        parsed.company_name.toLowerCase() !== 'your company') {
       return parsed.company_name;
    }
    
    return null;
  } catch (error) {
    console.error('AI Company Resolution failed:', error.message);
    return null;
  }
}

/**
 * Master Consensus Algorithm
 * Executes 3 engines in parallel and merges the results based on confidence.
 */
export async function resolveCompanyName(email, jdText) {
  // Execute all 3 engines in parallel
  const [domainRes, regexRes, aiRes] = await Promise.allSettled([
    resolveViaDomain(email),
    resolveViaRegex(jdText),
    resolveViaAI(email, jdText)
  ]);

  const domain = domainRes.status === 'fulfilled' ? domainRes.value : null;
  const regex = regexRes.status === 'fulfilled' ? regexRes.value : null;
  const ai = aiRes.status === 'fulfilled' ? aiRes.value : null;

  // Consensus 1: If AI agrees with Regex or Domain, we have 100% confidence.
  if (ai) {
    if ((regex && ai.toLowerCase().includes(regex.toLowerCase())) || 
        (domain && ai.toLowerCase().includes(domain.toLowerCase()))) {
      return ai;
    }
  }

  // Consensus 2: If AI found a highly specific name, trust the AI.
  if (ai) return ai;

  // Consensus 3: Regex is highly specific since it searches for "About X"
  if (regex) return regex;

  // Consensus 4: Fallback to Domain if nothing else works
  if (domain) return domain;

  // Consensus 5: Absolute Fallback
  return "your company";
}
