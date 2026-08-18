/**
 * Tier 2: Deep Semantic Email Analyzer via Global LLM Engine v5
 * Uses the centralized 17-tier model routing for email intent parsing.
 * Now includes user-email awareness for accurate classification.
 */

async function callGroq(messages, responseFormat = null) {
  // Delegate to Global LLM Engine — handles all failover automatically
  const { callLLM } = await import('../../services/globalLLMEngine.js');
  const params = {
    messages,
    temperature: 0.1,
    max_tokens: 1024,
  };
  if (responseFormat) params.response_format = responseFormat;

  const completion = await callLLM('email_analysis', params);
  return completion.choices?.[0]?.message?.content || '';
}

export async function analyzeWithGemini(subject, body, fromEmail, userEmail) {
  try {
    const prompt = `You are a strict, expert email analyzer for a job application tracking system.
Your job is to read an email and categorize its intent in the context of job applications.

CRITICAL CONTEXT:
- The JOB APPLICANT's email is: ${userEmail || 'unknown'}
- If the "From" email matches the applicant's email, this is an OUTGOING email from the applicant → classify as "Sent"
- If the "From" email is different from the applicant's, this is an INCOMING email from a company/recruiter

CATEGORIES (in order of priority):
- "Sent": The email was sent BY the job applicant (outgoing). Also includes auto-receipt confirmations that merely say "we received your application" or "thank you for applying" without any substantive response.
- "Viewed": A company/recruiter has EXPLICITLY reviewed the application and says so (e.g., "we have reviewed your application", "your profile stood out"). Auto-acknowledgments like "thank you for applying" do NOT count as Viewed.
- "Responded": A company/recruiter is asking for more info (questionnaire, visa status, portfolio, salary expectations) or giving a general non-automated response that isn't an interview invitation or rejection.
- "Interview": An EXPLICIT invitation to interview — requesting availability, sending a booking link (Calendly/Zoom), or next steps involving a phone screen, coding test, or in-person meeting. Generic mentions of "schedule" or "call" in non-job contexts do NOT count.
- "Rejected": An explicit rejection (e.g., "not moving forward", "decided to proceed with other candidates", "position filled", "unfortunately").
- "Offer": An explicit offer of employment with discussion of compensation, start dates, or offer letters.
- "Unknown": A completely unrelated email — marketing, newsletters, social media notifications, SaaS tool notifications, financial alerts, personal emails, or any email that has NO connection to a job application.

IMPORTANT RULES:
1. Do NOT classify marketing emails, newsletters, or social media notifications as job-related. If the email contains "unsubscribe", "view in browser", or "manage preferences", it is almost certainly "Unknown".
2. Auto-acknowledgment emails ("thank you for your interest", "application received") should be classified as "Viewed" ONLY if there is also a personal message from a recruiter. Otherwise classify as "Sent".
3. Be VERY strict about "Interview" — require explicit interview language, not just generic scheduling.
4. If the sender domain is a well-known non-job service (google.com, linkedin.com, github.com, stripe.com, etc.), classify as "Unknown" unless it's from a recruiter at that company.

INPUT:
From: ${fromEmail || 'Unknown'}
Subject: ${subject || 'No Subject'}
Body:
${body ? Array.from(body).slice(0, 3000).join('') : 'No Body'}

INSTRUCTIONS:
Categorize this email. Provide a confidence score (0 to 100). Provide a brief 1-sentence reason.
Extract any relevant booking or meeting links (e.g., calendly.com, zoom.us, meet.google.com).

Return a JSON object with these exact keys: type, confidence, reason, extracted_links (array of strings).`;

    const result = await callGroq(
      [{ role: 'user', content: prompt }],
      { type: 'json_object' }
    );

    const parsed = JSON.parse(result);

    return {
      type: parsed.type || 'Unknown',
      confidence: parsed.confidence || 0,
      reason: (parsed.reason || 'AI analysis completed').replace(/\x00/g, ''),
      extracted_links: parsed.extracted_links || []
    };
  } catch (error) {
    console.error("Error in Groq Email Analyzer:", error.message);
    return {
      type: 'Unknown',
      confidence: 0,
      reason: `AI parsing failed: ${error.message}`,
      extracted_links: []
    };
  }
}

/**
 * Deterministic pipe-delimited subject parser.
 * The user's sent email subjects follow a consistent format:
 *   "Applying for {Role} | {Company} | {Experience} | {Title} | {Skills} | ..."
 *   "Application for {Role} - {Name}" (alternate format)
 * 
 * Company is ALWAYS the 2nd pipe-delimited segment.
 * Role is extracted from the 1st segment after "Applying for" / "Application for".
 * 
 * Returns { company, role } or null if subject doesn't match the pattern.
 */
export function parseSubjectPipeFormat(subject) {
  if (!subject) return null;

  // Match "Applying for {Role} | {Company} | ..." or "Application for {Role} | {Company} | ..."
  const pipeMatch = subject.match(
    /^(?:Applying|Application)\s+for\s+(.+?)(?:\s*\|\s*)(.+?)(?:\s*\|\s*)/i
  );

  if (!pipeMatch) return null;

  const rawRole = (pipeMatch[1] || '').trim();
  const rawCompany = (pipeMatch[2] || '').trim();

  // Validate: company should NOT be experience info (e.g. "5+"), candidate title, or too short
  const isExperience = /^\d+\+?\s*(yrs?|years?)?$/i.test(rawCompany);
  const isCandidateTitle = /\b(founder|cpo|cto|ceo|builder|engineer|developer)\b/i.test(rawCompany) 
    && !/\b(hiring|inc|ltd|pvt|solutions|tech|labs|studio)\b/i.test(rawCompany);
  const tooShort = rawCompany.length < 2;

  if (isExperience || isCandidateTitle || tooShort) return null;

  return {
    company: rawCompany,
    role: rawRole || 'Unknown Role'
  };
}

/**
 * Extracts the Company and Role from a Sent email to automatically create an application.
 * Uses a deterministic pipe-parser as a fast path, then falls back to LLM for unstructured emails.
 */
export async function extractCompanyAndRoleWithGemini(emailText) {
  // ── Fast Path: Deterministic pipe-delimited parsing ──
  // Extract subject line from the email text
  const subjectMatch = emailText.match(/Subject:\s*(.+?)(?:\n|$)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : '';

  if (subject) {
    const parsed = parseSubjectPipeFormat(subject);
    if (parsed && parsed.company !== 'Unknown Company') {
      console.log(`[extract] Fast-path: "${parsed.company}" / "${parsed.role}" from subject`);
      return parsed;
    }
  }

  // ── Slow Path: LLM extraction for unstructured emails ──
  try {
    const prompt = `Extract the Company Name and Role being applied to from this email. 
Output a JSON object with 'company' and 'role' properties.
If you cannot find the company, try to infer it from the domain of the email it was sent to, or output 'Unknown Company'.
If you cannot find the role, output 'Unknown Role'.

IMPORTANT RULES:
1. Do NOT extract the CANDIDATE's own title as the company name. 
   "Ex Founder & CPO", "Top Product Builder", "SaaS & AI/ML" — these are NOT company names.
2. The company name is the EMPLOYER being applied to (e.g., "Porter", "Flipkart", "Meesho").
3. In pipe-delimited subjects like "Applying for PM | Porter | 5+ | Ex Founder & CPO", 
   the COMPANY is the 2nd segment ("Porter"), NOT "Ex Founder & CPO".
4. Do NOT extract company names from social media, SaaS, marketing, or financial emails.

Email Content:
${Array.from(emailText).slice(0, 3000).join('')}

Return ONLY a JSON object with keys: company, role`;

    const result = await callGroq(
      [{ role: 'user', content: prompt }],
      { type: 'json_object' }
    );

    const parsed = JSON.parse(result);
    let company = parsed.company || 'Unknown Company';
    const role = parsed.role || 'Unknown Role';

    // Post-validation: reject common LLM hallucination patterns
    const candidateTitlePatterns = [
      /^ex[\s-]?founder/i, /^cpo$/i, /^cto$/i, /^ceo$/i,
      /founder\s*&\s*cpo/i, /top\s+product\s+builder/i,
      /saas\s*&?\s*ai/i, /immediate\s+joiner/i,
      /^product\s+builder/i, /^unknown/i
    ];
    if (candidateTitlePatterns.some(p => p.test(company.trim()))) {
      console.warn(`[extract] LLM returned candidate title "${company}" as company — rejecting`);
      company = 'Unknown Company';
    }

    return { company, role };
  } catch (err) {
    console.error("Groq Company Extraction Error:", err.message);
    return { company: 'Unknown Company', role: 'Unknown Role' };
  }
}
