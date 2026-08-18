/**
 * Email-to-Name Resolver — 3-Tier Cascading Lookup
 * ════════════════════════════════════════════════════════════════════
 * Resolves a person's name from their email address using three
 * cascading strategies (zero paid APIs required):
 *
 *   Tier 1: Smart Email Parsing (instant, always works)
 *           john.doe@company.com → "John Doe"
 *           j.smith@acme.co → "J Smith"
 *
 *   Tier 2: Gravatar Profile Lookup (free API, good for tech people)
 *           Fetches public Gravatar profile by email hash.
 *
 *   Tier 3: AI Inference via Groq (uses existing GROQ_API_KEY)
 *           When email+domain context suggests a likely name.
 *
 * Usage:
 *   import { resolveNameFromEmail } from '@/infrastructure/services/emailNameResolver';
 *   const { name, confidence, source } = await resolveNameFromEmail('john.doe@stripe.com');
 *   // → { name: 'John Doe', confidence: 95, source: 'email-parse' }
 * ════════════════════════════════════════════════════════════════════
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { callLLM } from './globalLLMEngine.js';

const execAsync = promisify(exec);

/**
 * Resolve a person's name from their email address using the Python ExtractionPipeline.
 *
 * @param {string} email - The email address to look up
 * @param {Object} [options]
 * @returns {Promise<{ name: string|null, firstName: string|null, lastName: string|null, confidence: number, source: string }>}
 */
export async function resolveNameFromEmail(email, options = {}) {
  if (!email || typeof email !== 'string') {
    return { name: "Hiring Manager", firstName: null, lastName: null, confidence: 0, source: 'none' };
  }

  // We run python3 -c to import the script, run the pipeline, and output JSON.
  const pythonCmd = `python3 -c "
import sys, json
from email_name_extractor import ExtractionPipeline
res = ExtractionPipeline().run(sys.argv[1])
print(json.dumps({
  'name': res.full_name,
  'firstName': res.first_name,
  'lastName': res.last_name,
  'confidence': int(res.confidence * 100),
  'source': 'python-extractor'
}))
" "${email}"`;

  try {
    let cwd;
    try {
      cwd = path.join(process.cwd(), 'src', 'infrastructure', 'services');
    } catch (e) {
      cwd = process.cwd(); // Fallback if src doesn't exist relative to cwd
    }
    const { stdout } = await execAsync(pythonCmd, { cwd });
    let result = JSON.parse(stdout.trim());
    
    // Tier 3: AI Inference via Groq/LLM Fallback if Tier 1 fails
    if (!result || result.confidence === 0 || result.name === "Hiring Manager") {
      try {
        const prompt = `Extract the person's first name and last name from this email address: ${email}
Return ONLY a valid JSON object in this format: {"firstName": "John", "lastName": "Doe"}. 
If you cannot determine a human name from the email (e.g. if it is hr@, info@, careers@), return {"firstName": "Hiring", "lastName": "Manager"}.
Do not include markdown blocks, just the JSON.`;
        
        const llmResponse = await callLLM('fast', { 
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        }, { skipLocal: true });
        
        let parsed = llmResponse;
        
        // Extract content from LLM response
        if (llmResponse && llmResponse.choices && llmResponse.choices[0] && llmResponse.choices[0].message) {
          const content = llmResponse.choices[0].message.content;
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            parsed = JSON.parse(match[0]);
          } else {
            parsed = JSON.parse(content);
          }
        }
        
        if (parsed && parsed.firstName && parsed.firstName !== "Hiring") {
          result = {
            name: `${parsed.firstName} ${parsed.lastName || ''}`.trim(),
            firstName: parsed.firstName,
            lastName: parsed.lastName || null,
            confidence: 85,
            source: 'llm-fallback'
          };
        } else {
          result = { name: "Hiring Manager", firstName: null, lastName: null, confidence: 0, source: 'fallback' };
        }
      } catch (llmErr) {
        console.error("LLM fallback email extraction failed:", llmErr.message);
        result = { name: "Hiring Manager", firstName: null, lastName: null, confidence: 0, source: 'fallback' };
      }
    }
    
    return result;
  } catch (err) {
    console.error("Python email extractor failed:", err);
    return { name: "Hiring Manager", firstName: null, lastName: null, confidence: 0, source: 'fallback' };
  }
}

/**
 * Batch resolve names from multiple emails.
 *
 * @param {string[]} emails
 * @returns {Promise<Map<string, { name, firstName, lastName, confidence, source }>>}
 */
export async function batchResolveNames(emails) {
  const results = new Map();
  const promises = emails.map(async (email) => {
    const result = await resolveNameFromEmail(email);
    results.set(email, result);
  });
  await Promise.all(promises);
  return results;
}

// ─── Utility: Extract Domain Company Name ────────────────────────────

/**
 * Extract a likely company name from an email domain.
 * stripe.com → Stripe, john@booking.com → Booking
 */
export function extractCompanyFromEmail(email) {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1].toLowerCase();
  const genericDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
    'live.com', 'msn.com', 'me.com', 'mac.com', 'proton.me',
  ];

  if (genericDomains.includes(domain)) return null;

  // Get the main domain name (before the TLD)
  const parts = domain.split('.');
  const mainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];

  return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
}
