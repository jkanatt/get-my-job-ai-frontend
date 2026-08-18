import { analyzeWithHeuristics } from './heuristic.js';
import { analyzeWithGemini, extractCompanyAndRoleWithGemini } from './gemini.js';

// ─── Non-job company names that should NEVER create applications ────────────
const BLACKLISTED_COMPANIES = new Set([
  'twitter', 'x', 'loom', 'findbreak', 'findberak', 'chegg', 'linkedin',
  'descript', 'quillbot', 'coolietest', 'google', 'facebook', 'meta',
  'instagram', 'whatsapp', 'youtube', 'github', 'gitlab', 'slack',
  'notion', 'figma', 'vercel', 'supabase', 'firebase', 'stripe',
  'paypal', 'amazon', 'flipkart', 'swiggy', 'zomato', 'uber', 'ola',
  'netflix', 'spotify', 'apple', 'microsoft', 'zoom', 'canva',
  'grammarly', 'openai', 'anthropic', 'cerebras', 'konami',
  'unknown company', 'unknown', 'n/a', 'na', '',
]);

// ─── Non-job sender domains ─────────────────────────────────────────────────
const NON_JOB_DOMAINS = new Set([
  'linkedin.com', 'facebookmail.com', 'twitter.com', 'x.com',
  'google.com', 'accounts.google.com', 'youtube.com',
  'github.com', 'gitlab.com', 'bitbucket.org',
  'supabase.com', 'supabase.io', 'vercel.com', 'netlify.com',
  'stripe.com', 'paypal.com', 'razorpay.com',
  'slack.com', 'notion.so', 'figma.com', 'canva.com',
  'medium.com', 'substack.com', 'quora.com', 'reddit.com',
  'openai.com', 'anthropic.com', 'cerebras.net',
  'loom.com', 'descript.com', 'chegg.com', 'quillbot.com',
  'mailchimp.com', 'sendgrid.net', 'hubspot.com',
  'coursera.org', 'udemy.com', 'edx.org',
  'producthunt.com',
]);

/**
 * Powerful Dual-Tier Email Analysis Engine
 * Combines fast Heuristic keyword matching with deep Groq AI semantic analysis.
 * Now includes user-email awareness and non-job pre-filtering.
 */
export class EmailAnalysisEngine {
  /**
   * Analyzes an email and categorizes it as one of:
   * 'Sent', 'Viewed', 'Responded', 'Interview', 'Rejected', 'Offer', 'Unknown'
   * 
   * @param {Object} email 
   * @param {string} email.subject
   * @param {string} email.body
   * @param {string} email.fromEmail
   * @param {string} email.type - Optional, e.g. 'outbox' for sent emails
   * @param {string} email.userEmail - The user's own email for self-detection
   * @returns {Promise<Object>} The analysis result including confidence and reason
   */
  static async analyze(email) {
    const { subject, body, fromEmail, type, userEmail } = email;

    // Fast Path: Check if it's an outgoing email
    if (type === 'outbox' || type === 'Sent' || type === 'sent') {
      return {
        type: 'Sent',
        confidence: 100,
        engine_used: 'fast-path',
        reason: 'Email exists in outbox',
        extracted_links: []
      };
    }

    // Fast Path: Self-detection — if from the user's own email
    if (userEmail && fromEmail) {
      const bareFrom = (fromEmail.match(/<([^>]+)>/) || [null, fromEmail])[1];
      if (bareFrom.toLowerCase().trim() === userEmail.toLowerCase().trim()) {
        return {
          type: 'Sent',
          confidence: 100,
          engine_used: 'fast-path',
          reason: 'Email sent by the user',
          extracted_links: []
        };
      }
    }

    // Fast Path: Non-job sender domain
    if (fromEmail) {
      const bareFrom = (fromEmail.match(/<([^>]+)>/) || [null, fromEmail])[1];
      const domain = bareFrom.split('@')[1]?.toLowerCase();
      if (domain && NON_JOB_DOMAINS.has(domain)) {
        return {
          type: 'Unknown',
          confidence: 95,
          engine_used: 'fast-path',
          reason: `Non-job sender domain: ${domain}`,
          extracted_links: []
        };
      }
    }

    // Fast Path: Check if it's from known automated non-HR systems
    const ignoreList = ['no-reply@accounts.google.com', 'noreply@email.openai.com', 'welcome@supabase.com'];
    if (fromEmail && ignoreList.some(s => fromEmail.toLowerCase().includes(s))) {
      return {
        type: 'Unknown',
        confidence: 100,
        engine_used: 'fast-path',
        reason: 'Automated system email',
        extracted_links: []
      };
    }

    // Tier 1: Run Heuristic Engine (now with sender-pattern + user-email awareness)
    const heuristicResult = analyzeWithHeuristics(subject, body, fromEmail, userEmail);
    
    // If the heuristic engine is highly confident (≥ 80%), return its result to save AI costs
    if (heuristicResult.isCertain && heuristicResult.type !== 'Unknown') {
      return {
        type: heuristicResult.type,
        confidence: heuristicResult.confidence,
        engine_used: 'tier1-heuristic',
        reason: `Matched high-confidence keywords: ${heuristicResult.matched_keywords.join(', ')}`,
        extracted_links: heuristicResult.extracted_links
      };
    }

    // Tier 2: Fallback to Groq for deep semantic analysis
    // We only reach here if the email is highly ambiguous or lacks strong keywords
    const geminiResult = await analyzeWithGemini(subject, body, fromEmail, userEmail);
    
    // Merge any links found by heuristics that AI might have missed
    const allLinks = [...new Set([...(geminiResult.extracted_links || []), ...(heuristicResult.extracted_links || [])])];

    return {
      type: geminiResult.type,
      confidence: geminiResult.confidence,
      engine_used: 'tier2-gemini',
      reason: geminiResult.reason,
      extracted_links: allLinks
    };
  }

  /**
   * Extracts Company and Role from a Sent email to automatically track applications.
   * @param {string} emailText 
   */
  static async extractCompanyAndRole(emailText) {
    return await extractCompanyAndRoleWithGemini(emailText);
  }

  /**
   * Checks if a company name is blacklisted (non-job company).
   * @param {string} company
   * @returns {boolean}
   */
  static isBlacklistedCompany(company) {
    if (!company) return true;
    return BLACKLISTED_COMPANIES.has(company.toLowerCase().trim());
  }

  /**
   * Checks if a sender domain is a known non-job domain.
   * @param {string} email
   * @returns {boolean}
   */
  static isNonJobDomain(email) {
    if (!email) return false;
    const bare = (email.match(/<([^>]+)>/) || [null, email])[1];
    const domain = bare.split('@')[1]?.toLowerCase();
    return domain ? NON_JOB_DOMAINS.has(domain) : false;
  }
}
