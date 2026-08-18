/**
 * LLM Extractor — AI-Powered Extraction via Global LLM Engine
 * ═══════════════════════════════════════════════════════════════════════
 * Routes text through the project's globalLLMEngine (17-tier Gemini failover)
 * for structured extraction. Falls back to OmniRoute gateway if the global
 * engine is unavailable.
 *
 * Used for: company name extraction, funding data, news classification,
 * batch processing, and company enrichment.
 */

import { callLLM as callGlobalLLM } from '@/infrastructure/services/globalLLMEngine';
import axios from 'axios';

// Fallback gateway config (only used if globalLLMEngine has zero providers)
const FALLBACK_GATEWAY_URL = process.env.LLM_GATEWAY_URL || 'http://localhost:20128/v1';
const FALLBACK_GATEWAY_KEY = process.env.LLM_GATEWAY_KEY || 'sk-3474d6547f654fe2-a9a2c5-8aad41df';

// ─── Core LLM Call ─────────────────────────────────────────────────────

/**
 * Unified LLM call — tries globalLLMEngine first, falls back to gateway.
 */
async function callLLM(systemPrompt, userPrompt, { temperature = 0.1, maxTokens = 500, taskType = 'intelligence_extraction' } = {}) {
  // ── Primary: globalLLMEngine (17-tier Gemini failover) ──
  try {
    const completion = await callGlobalLLM(taskType, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    const content = completion?.choices?.[0]?.message?.content?.trim();
    if (!content || content === 'null') return null;

    return parseJSONSafe(content);
  } catch (primaryErr) {
    console.warn(`[LLMExtractor] globalLLMEngine failed: ${primaryErr.message?.slice(0, 120)}`);
  }

  // ── Fallback: OmniRoute gateway ──
  try {
    const { data } = await axios.post(
      `${FALLBACK_GATEWAY_URL}/chat/completions`,
      {
        model: 'auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      },
      {
        timeout: 30_000,
        headers: {
          'Authorization': `Bearer ${FALLBACK_GATEWAY_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content || content === 'null') return null;

    return parseJSONSafe(content);
  } catch (fallbackErr) {
    console.warn('[LLMExtractor] Fallback gateway also failed:', fallbackErr.message?.slice(0, 100));
    return null;
  }
}

/**
 * Safely parse JSON from LLM output, handling markdown fences.
 */
function parseJSONSafe(content) {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── Company Name Extraction (Lightweight) ─────────────────────────────

/**
 * Extract the actual company name from a headline using LLM.
 *
 * @param {string} title - Article headline
 * @param {string} description - Article summary (optional)
 * @returns {Promise<string|null>} Extracted company name or null
 */
export async function extractCompanyNameWithLLM(title, description = '') {
  if (!title || title.length < 10) return null;

  const result = await callLLM(
    'You are a startup news parser. Extract the PRIMARY startup/company name from the headline. Return ONLY a JSON object: {"company": "CompanyName"} or {"company": null} if no specific company is mentioned. Do NOT return investor names, article titles, or descriptive phrases as company names.',
    `Headline: ${title}\n${description ? `Summary: ${description.slice(0, 300)}` : ''}`,
    { maxTokens: 100, taskType: 'intelligence_extraction' }
  );

  return result?.company || null;
}

/**
 * Batch extract company names from multiple items.
 * Sends up to 8 items at once for efficiency.
 *
 * @param {object[]} items - Array of {title, description} objects
 * @returns {Promise<string[]>} Array of extracted company names (null for failures)
 */
export async function extractBatchCompanyNames(items) {
  if (!items?.length) return [];

  const results = [];
  for (let i = 0; i < items.length; i += 8) {
    const chunk = items.slice(i, i + 8);
    const numbered = chunk.map((item, idx) => `${idx + 1}. "${item.title}"`).join('\n');

    const result = await callLLM(
      'You are a startup news parser. For each numbered headline, extract the PRIMARY startup/company name. Return a JSON array of objects: [{"idx": 1, "company": "CompanyName"}, ...]. Use null for company if no specific startup is mentioned. Do NOT return investor names, descriptive phrases, or article section titles.',
      `Extract company names:\n${numbered}`,
      { maxTokens: 800, taskType: 'intelligence_extraction' }
    );

    if (Array.isArray(result)) {
      for (let j = 0; j < chunk.length; j++) {
        const match = result.find(r => r.idx === j + 1);
        results.push(match?.company || null);
      }
    } else {
      results.push(...chunk.map(() => null));
    }

    // Small delay between batches
    if (i + 8 < items.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}

// ─── Funding Data Extraction ───────────────────────────────────────────

/**
 * Extract structured funding data from messy text using LLM.
 *
 * @param {string} text - Raw text containing funding information
 * @returns {Promise<object|null>} Extracted funding data or null
 */
export async function extractFundingWithLLM(text) {
  if (!text || text.length < 20) return null;

  return callLLM(
    'You are a financial data extraction assistant. Extract funding events from text and return strict JSON only. No markdown, no explanation.',
    `Extract the startup funding event from this text as strict JSON. Return ONLY valid JSON with these keys:
- company: string (company name)
- amount: number (numeric amount, no currency symbols)
- currency: string (ISO code: USD, INR, EUR, etc.)
- round: string (pre-seed, seed, series-a, series-b, series-c, series-d, bridge, debt, strategic, ipo, undisclosed)
- date: string (ISO date YYYY-MM-DD, or null if unknown)
- lead_investor: string or null
- other_investors: string[] (list of other investors)
- valuation: number or null (company valuation in same currency)
- industry: string or null (company's industry/sector)

If no funding event is present, return null.

TEXT:
${text.slice(0, 2000)}`,
    { taskType: 'intelligence_extraction' }
  );
}

// ─── News Event Extraction ─────────────────────────────────────────────

/**
 * Extract structured news event data from text using LLM.
 */
export async function extractNewsWithLLM(text) {
  if (!text || text.length < 20) return null;

  return callLLM(
    'You are a news classification assistant. Classify and extract structured data from startup news. Return strict JSON only.',
    `Classify and extract data from this startup/tech news. Return ONLY valid JSON:
- company: string (company name)
- category: string (funding|hiring|growth|product|partnership|ma|workforce|leadership|ipo|other)
- event_type: string (specific type, e.g., "series_b_funding", "ceo_appointment")
- headline: string (one-line summary)
- key_facts: object (key data points like amount, people, locations)
- people_involved: string[] (names of people mentioned)
- location: string or null
- sentiment: string (positive|negative|neutral)

TEXT:
${text.slice(0, 1500)}`,
    { taskType: 'intelligence_extraction' }
  );
}

// ─── Company Enrichment ────────────────────────────────────────────────

/**
 * Deep-enrich a company profile using LLM knowledge.
 *
 * @param {string} companyName - Company name
 * @param {object} existingData - Any existing data we have
 * @returns {Promise<object|null>} Enriched company profile
 */
export async function deepEnrichCompany(companyName, existingData = {}) {
  if (!companyName) return null;

  const context = existingData.description
    ? `\nKnown info: ${existingData.description}`
    : '';

  return callLLM(
    'You are a startup intelligence analyst. Given a company name, provide all publicly known information. Return strict JSON only. Only include facts you are confident about — use null for unknown fields.',
    `Provide a comprehensive profile for the startup/company "${companyName}".${context}

Return ONLY valid JSON:
- website: string or null (official website URL)
- industry: string or null (primary industry/sector)
- sub_industry: string or null (specific niche)
- location: string or null (headquarters city, country)
- founded_year: number or null
- stage: string or null (pre-seed|seed|early|growth|late|public)
- employee_count: string or null (range like "51-200")
- description: string or null (1-2 sentence company description)
- founders: [{name: string, title: string}] or []
- products: string[] or [] (main products/services)
- competitors: string[] or [] (top 3-5 competitors)
- tech_stack: string[] or [] (known technologies used)
- is_indian: boolean (true if headquartered in India)`,
    { maxTokens: 1000, taskType: 'intelligence_extraction' }
  );
}

// ─── Gateway Health ────────────────────────────────────────────────────

/**
 * Check if at least one LLM provider is available.
 * Tries globalLLMEngine first, then falls back to gateway.
 */
export async function isGatewayAvailable() {
  // The globalLLMEngine is always "available" if any Gemini key is set
  if (process.env.GEMINI_API_KEY || process.env.GEMINI_OPENAI_API_KEY) {
    return true;
  }

  // Fallback: check OmniRoute gateway
  try {
    const { data } = await axios.get(`${FALLBACK_GATEWAY_URL}/models`, {
      timeout: 5000,
      headers: { 'Authorization': `Bearer ${FALLBACK_GATEWAY_KEY}` },
    });
    return !!data;
  } catch {
    return false;
  }
}
