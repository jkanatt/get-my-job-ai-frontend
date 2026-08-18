/**
 * Tier 1: Production-Grade Heuristic Email Analyzer
 * Uses 200+ keywords, regex patterns, sender-domain filtering, subject-line boosting,
 * negative-signal detection, and user-email awareness for accurate email classification.
 */

// ─── Sender Domains / Prefixes to Auto-Ignore ──────────────────────────────
// These are automated notification senders that are NOT job-related
const IGNORE_SENDER_PATTERNS = [
  // Generic noreply / system
  'noreply@', 'no-reply@', 'do-not-reply@', 'donotreply@',
  'notifications@', 'notification@', 'alerts@', 'alert@',
  'mailer-daemon@', 'postmaster@', 'bounce@',
  'marketing@', 'newsletter@', 'news@', 'updates@', 'promo@', 'promotions@',
  'support@', 'help@', 'info@', 'billing@', 'account@', 'security@',
  'digest@', 'weekly@', 'daily@', 'team@', 'hello@', 'contact@',
  // Social / marketing platforms
  '@linkedin.com', '@facebookmail.com', '@twitter.com', '@x.com',
  '@medium.com', '@substack.com', '@mailchimp.com', '@sendgrid.net',
  '@hubspot.com', '@salesforce.com', '@intercom.io', '@zendesk.com',
  '@mailgun.org', '@sparkpost.com', '@constantcontact.com',
  '@quora.com', '@reddit.com', '@pinterest.com', '@instagram.com',
  '@tiktok.com', '@discord.com', '@telegram.org',
  // Dev / SaaS tools (not HR)
  '@github.com', '@gitlab.com', '@bitbucket.org', '@atlassian.com',
  '@slack.com', '@notion.so', '@figma.com', '@vercel.com',
  '@supabase.com', '@supabase.io', '@firebase.google.com', '@aws.amazon.com',
  '@netlify.com', '@heroku.com', '@digitalocean.com',
  '@canva.com', '@grammarly.com', '@zoom.us',
  '@1password.com', '@lastpass.com', '@bitwarden.com',
  '@dropbox.com', '@box.com', '@wetransfer.com',
  '@trello.com', '@asana.com', '@monday.com', '@clickup.com',
  '@calendly.com', // Calendly notifications (not the meeting links)
  '@loom.com', '@descript.com', '@miro.com',
  // Google system (specific system senders only, NOT blanket @google.com)
  'no-reply@accounts.google.com', 'noreply@google.com',
  '@youtube.com',
  // Common services
  '@openai.com', '@anthropic.com', '@cerebras.net',
  '@quillbot.com', '@chegg.com',
  // Education platforms (non-job)
  '@coursera.org', '@udemy.com', '@edx.org', '@skillshare.com',
  '@leetcode.com', // Leetcode notifications, NOT job-related
  // News / media
  '@nytimes.com', '@wsj.com', '@bloomberg.com', '@techcrunch.com',
  '@producthunt.com', '@hackernews.com',
  // Indian job portal notifications (these are platform notifications, not recruiter emails)
  'noreply@naukri.com', 'notification@naukri.com',
  'donotreply@indeed.com', 'noreply@indeed.com',
  'notifications@glassdoor.com',
  'noreply@monster.com',
];

// ─── Big Tech / FAANG domains — only ignore SYSTEM emails from these ────────
// Recruiter emails from these domains (recruiter@google.com, hr@amazon.com)
// MUST be allowed through for job tracking.
const HIRING_COMPANY_DOMAINS = new Set([
  'google.com', 'amazon.com', 'flipkart.com', 'swiggy.in', 'zomato.com',
  'uber.com', 'ola.in', 'stripe.com', 'paypal.com', 'razorpay.com',
]);

// Sender prefixes that indicate system/notification emails (not recruiters)
const SYSTEM_SENDER_PREFIXES = [
  'noreply', 'no-reply', 'do-not-reply', 'donotreply', 'notifications',
  'notification', 'alerts', 'alert', 'marketing', 'newsletter', 'support',
  'help', 'info', 'billing', 'account', 'security', 'updates', 'promo',
  'mailer-daemon', 'postmaster', 'bounce', 'order', 'receipt',
];

// E-commerce / finance system-only senders (blanket ignore — these never recruit)
const ECOMMERCE_SYSTEM_DOMAINS = [
  '@icicibank.com', '@hdfcbank.com', '@sbi.co.in', '@kotak.com',
  '@paytm.com', '@phonepe.com',
];

// ─── Non-job subject patterns ───────────────────────────────────────────────
// If the subject matches these, the email is almost certainly not a job application
const NON_JOB_SUBJECT_PATTERNS = [
  /\b(unsubscribe|opt.?out|manage.?preferences|email.?preferences)\b/i,
  /\b(order.?confirm|order.?shipped|order.?delivered|tracking.?number)\b/i,
  /\b(password.?reset|verify.?your.?email|confirm.?your.?account)\b/i,
  /\b(payment.?receipt|invoice|billing.?statement)\b/i,
  /\b(security.?alert|unusual.?sign.?in|new.?sign.?in|suspicious.?activity)\b/i,
  /\b(newsletter|weekly.?digest|daily.?digest|monthly.?update)\b/i,
  /\b(free.?trial|upgrade.?your|limited.?time|special.?offer|50%.?off|discount)\b/i,
  /\b(findbreak|findberak)\b/i,
  /\b(tweet|retweeted|liked.?your|followed.?you|mentioned.?you)\b/i,
  /\b(new.?message.?from|new.?connection|endorsed.?you|profile.?view)\b/i,
  /\b(OTP|one.?time.?password|verification.?code)\b/i,
  /\b(welcome.?to|getting.?started|your.?account.?is.?ready)\b/i,
];

// ─── Marketing / spam body signals ──────────────────────────────────────────
const MARKETING_BODY_PATTERNS = [
  'unsubscribe', 'view in browser', 'view this email in your browser',
  'manage preferences', 'email preferences', 'opt out',
  'privacy policy', 'terms of service', 'terms and conditions',
  'you are receiving this email because', 'you received this email because',
  'if you no longer wish to receive', 'click here to unsubscribe',
  'this is a promotional email', 'this is an automated message',
  'do not reply to this email', 'this mailbox is not monitored',
  'update your preferences', 'manage your subscription',
  'powered by mailchimp', 'sent via sendgrid', 'via hubspot',
  '© 20', // copyright footer
];

// ─── Sender domains that ARE likely HR / job-related ────────────────────────
// If the sender matches these, boost confidence of the classification
const HR_SENDER_PATTERNS = [
  'talent@', 'recruiting@', 'recruitment@', 'careers@', 'hiring@',
  'hr@', 'people@', 'jobs@', 'opportunities@', 'staffing@',
  '@greenhouse.io', '@lever.co', '@workday.com', '@icims.com',
  '@smartrecruiters.com', '@jobvite.com', '@ashbyhq.com',
  '@breezy.hr', '@applytojob.com', '@myworkday.com',
  '@hire.lever.co', '@boards.greenhouse.io',
  '@rippling.com', '@bamboohr.com', '@workable.com',
  '@jazz.co', '@recruiterbox.com',
];

// ─── Keyword Dictionaries (200+ patterns) ──────────────────────────────────
const DICTIONARY = {
  Interview: [
    // Direct interview language (require multi-word to avoid false positives)
    'schedule an interview', 'interview invitation', 'interview invite',
    'phone screen', 'video screen', 'technical screen',
    'phone interview', 'video interview', 'virtual interview',
    'first round interview', 'second round interview', 'third round interview', 'final round interview',
    'on-site interview', 'onsite interview', 'in-person interview',
    'panel interview', 'behavioral interview', 'group interview',
    // Scheduling / availability (require job context)
    'interview schedule', 'your available times for the interview',
    'book a time for', 'pick a time for the',
    'we would like to invite you', 'would like to schedule a call',
    'set up a time to discuss your candidacy',
    'invite you to interview', 'invited to interview',
    // Conversation / call (require "role"/"position"/"application" context)
    'speak with you about the role', 'speak with you about the position',
    'discuss your application', 'discuss your candidacy',
    'discuss the role further', 'discuss the position further',
    'screening call for', 'introductory call about the',
    // Technical assessment
    'coding assessment', 'coding challenge', 'coding test',
    'technical assessment', 'technical challenge', 'technical test',
    'hackerrank', 'codesignal', 'codility',
    'take-home assignment', 'take home assignment', 'homework assignment',
    'pair programming session', 'live coding session', 'whiteboard session',
    'system design interview', 'design exercise', 'case study interview',
    // Progression language (strong signal)
    'move forward with your application', 'like to move you forward',
    'proceed to the next stage', 'advance to the next round',
    'we\'d like to move forward', 'we\'d like to proceed',
    'move you to the next round', 'progress to the next',
    'shortlisted for', 'selected for the next',
    'pleased to inform you that you have been selected',
    'happy to let you know that',
    // Meeting links (only when combined with job context)
    'calendly.com/interview', 'calendly.com/screen',
    // Recruiter / hiring manager calls
    'hiring manager wants to speak', 'recruiter call about',
    'team lead would like to meet',
  ],
  Rejected: [
    // Direct rejection
    'unfortunately, we will not be', 'unfortunately we are unable',
    'regret to inform', 'we regret to', 'regretfully',
    'not moving forward with your', 'not to move forward',
    'will not be moving forward', 'will not be proceeding',
    'decided not to proceed with your', 'unable to proceed with your',
    'other candidates who more closely', 'decided to proceed with other candidates',
    'decided to move forward with another', 'went with another candidate',
    'pursuing other candidates', 'other applicants who are',
    'competitive applicant pool',
    // Polite rejection
    'while your background is impressive', 'although your qualifications',
    'while we were impressed with your',
    'after careful consideration, we have decided',
    'strong pool of candidates',
    'many qualified candidates',
    'high volume of applications',
    'carefully reviewed your application and',
    // Status updates
    'position has been filled', 'role has been filled', 'no longer available',
    'position is no longer open', 'no longer considering applications',
    'going in a different direction',
    'not a fit for this particular role', 'not the right fit at this time',
    'not quite the right match',
    // Final words
    'keep your resume on file', 'keep your details on file',
    'wish you success in your job search',
    'wish you all the best in your',
    'best of luck in your future endeavors',
    'encourage you to apply again in the future',
    'cannot offer you the position', 'declined your application',
    'not selected for this position',
    'unable to offer you', 'not able to move forward with your',
    'we have decided to pursue other candidates',
  ],
  Offer: [
    // Direct offer language
    'offer letter', 'offer of employment', 'formal job offer',
    'official offer', 'verbal offer',
    'extend an offer to you', 'extending an offer',
    'pleased to offer you the position', 'pleased to extend an offer',
    'happy to offer you the role', 'happy to extend an offer',
    'thrilled to offer you', 'excited to offer you', 'delighted to offer you',
    'congratulations on your offer',
    // Employment terms
    'welcome to the team', 'welcome aboard', 'joining our team',
    'compensation package for the role', 'total compensation',
    'base salary of', 'annual compensation of',
    'signing bonus', 'sign-on bonus', 'equity package',
    'stock options', 'rsu', 'restricted stock units', 'vesting schedule',
    'benefits package includes', 'health insurance',
    'relocation assistance', 'relocation package',
    // Process
    'background check will be initiated', 'onboarding process',
    'proposed start date', 'your start date will be',
    'please sign the offer', 'e-sign this document',
    'accept this offer by', 'accept or decline',
  ],
  Viewed: [
    // TRUE viewed — recruiter explicitly says they reviewed (not auto-acks)
    'viewed your application and', 'reviewed your application and would',
    'reviewed your profile and', 'reviewed your resume and',
    'your profile stood out', 'your resume caught our attention',
    'your application caught our attention', 'your background is impressive',
    'shortlisted', 'added to our shortlist',
    'your resume has been forwarded to the hiring', 'your resume was forwarded',
    'has been reviewed by the hiring manager', 'the team has reviewed your',
    'we have reviewed your credentials',
    'your candidacy is being considered', 'under consideration for',
    'being considered for the role',
  ],
  Responded: [
    // Information requests from the COMPANY (not user's own follow-ups)
    'could you provide us with', 'could you share your',
    'please provide your', 'please complete the following',
    'please submit your', 'please fill out this',
    'additional information needed', 'we need more information',
    'questionnaire for the role', 'pre-screening questionnaire',
    'visa status', 'work authorization status', 'right to work',
    'salary expectations for the role', 'compensation expectations',
    'expected salary range', 'salary requirement',
    'notice period', 'when can you start', 'earliest start date',
    // Portfolio / references
    'share your portfolio', 'github link',
    'provide references', 'reference check for',
    'work samples for review', 'writing samples',
    // Follow-up FROM THE COMPANY (not user's own)
    'wanted to check in on your application',
    'are you still interested in the role',
    'still interested in the position',
    'following up on your application',
    'circling back on the role',
  ]
};

// ─── Auto-Acknowledgment Keywords (should NOT advance status beyond Sent) ──
const AUTO_ACK_KEYWORDS = [
  'thank you for your interest in',
  'thanks for applying to',
  'thank you for submitting your application',
  'thank you for your application',
  'confirming receipt of your application',
  'we have received your application',
  'application confirmation',
  'successfully submitted your application',
  'application has been received',
  'your application has been submitted',
  'we appreciate your interest',
  'thank you for considering',
  'this is to confirm that we received',
  'application received for',
];

// ─── Link Extraction Regex ──────────────────────────────────────────────────
const LINK_REGEX = /(https?:\/\/(?:www\.)?(calendly\.com|zoom\.us|meet\.google\.com|teams\.microsoft\.com|webex\.com|skype\.com|whereby\.com|chime\.aws)[^\s"'<>]*)/gi;

/**
 * Normalizes text to handle HTML and special characters
 */
function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/<[^>]*>?/gm, ' ') // Strip HTML tags
    .replace(/&[a-z]+;/gi, ' ')  // Strip HTML entities
    .replace(/\s+/g, ' ')        // Normalize spaces
    .trim();
}

/**
 * Check if sender matches known non-HR automation patterns.
 * For FAANG/hiring company domains, only flag system senders (noreply@, notifications@),
 * allowing recruiter emails (recruiter@google.com, hr@amazon.com) through.
 */
function isAutomatedNonHRSender(fromEmail) {
  if (!fromEmail) return false;
  const lower = fromEmail.toLowerCase();
  
  // Check blanket ignore patterns first (social, dev tools, etc.)
  if (IGNORE_SENDER_PATTERNS.some(pattern => lower.includes(pattern))) return true;
  
  // Check e-commerce/finance system domains (blanket ignore)
  if (ECOMMERCE_SYSTEM_DOMAINS.some(pattern => lower.includes(pattern))) return true;
  
  // For hiring company domains (Google, Amazon, etc.), only ignore system senders
  const domain = lower.split('@')[1];
  if (domain && HIRING_COMPANY_DOMAINS.has(domain)) {
    const localPart = lower.split('@')[0];
    return SYSTEM_SENDER_PREFIXES.some(prefix => localPart.includes(prefix));
  }
  
  return false;
}

/**
 * Check if sender matches known HR / recruiting patterns
 */
function isHRSender(fromEmail) {
  if (!fromEmail) return false;
  const lower = fromEmail.toLowerCase();
  return HR_SENDER_PATTERNS.some(pattern => lower.includes(pattern));
}

/**
 * Check if subject matches known non-job patterns
 */
function isNonJobSubject(subject) {
  if (!subject) return false;
  return NON_JOB_SUBJECT_PATTERNS.some(pattern => pattern.test(subject));
}

/**
 * Check if body contains marketing/spam signals
 */
function hasMarketingSignals(body) {
  if (!body) return false;
  const lower = body.toLowerCase();
  let marketingCount = 0;
  for (const pattern of MARKETING_BODY_PATTERNS) {
    if (lower.includes(pattern)) marketingCount++;
  }
  // If 3+ marketing signals present, it's almost certainly marketing
  return marketingCount >= 3;
}

/**
 * Check if email is an auto-acknowledgment (confirming application receipt)
 */
function isAutoAcknowledgment(content) {
  let ackCount = 0;
  for (const kw of AUTO_ACK_KEYWORDS) {
    if (content.includes(kw)) ackCount++;
  }
  return ackCount >= 1;
}

/**
 * Analyzes an email text using heuristics
 * @param {string} subject 
 * @param {string} body 
 * @param {string} [fromEmail] - Sender email for pattern filtering
 * @param {string} [userEmail] - The user's own email for self-email detection
 * @returns {Object} { type, confidence, extracted_links, matches }
 */
export function analyzeWithHeuristics(subject, body, fromEmail, userEmail) {
  // ── Pre-filter: Auto-reject known non-HR senders ──
  if (isAutomatedNonHRSender(fromEmail)) {
    return {
      type: 'Unknown',
      confidence: 95,
      extracted_links: [],
      matched_keywords: ['sender-pattern-filter'],
      raw_scores: {},
      isCertain: true
    };
  }

  // ── Pre-filter: Non-job subject ──
  if (isNonJobSubject(subject)) {
    return {
      type: 'Unknown',
      confidence: 90,
      extracted_links: [],
      matched_keywords: ['non-job-subject-filter'],
      raw_scores: {},
      isCertain: true
    };
  }

  const subjectNorm = normalize(subject || '');
  const bodyNorm = normalize(body || '');
  const content = subjectNorm + ' ' + bodyNorm;
  const rawContent = (subject || '') + ' ' + (body || '');

  // ── Pre-filter: Marketing/spam body ──
  if (hasMarketingSignals(bodyNorm)) {
    return {
      type: 'Unknown',
      confidence: 90,
      extracted_links: [],
      matched_keywords: ['marketing-body-filter'],
      raw_scores: {},
      isCertain: true
    };
  }

  // ── Pre-filter: User's own email (self-sent follow-up, not a response FROM a company) ──
  if (userEmail && fromEmail) {
    const bareFrom = fromEmail.match(/<([^>]+)>/) ? fromEmail.match(/<([^>]+)>/)[1] : fromEmail;
    if (bareFrom.toLowerCase().trim() === userEmail.toLowerCase().trim()) {
      return {
        type: 'Sent',
        confidence: 100,
        extracted_links: [],
        matched_keywords: ['user-self-email'],
        raw_scores: {},
        isCertain: true
      };
    }
  }

  // ── Check if this is just an auto-acknowledgment ──
  if (isAutoAcknowledgment(content)) {
    // Auto-acks should not advance status. Return 'Viewed' with low confidence 
    // so that it doesn't override a higher-confidence classification.
    // But check if there are ALSO strong interview/offer/rejection signals.
    const hasStrongSignal = 
      content.includes('interview') || 
      content.includes('offer') || 
      content.includes('unfortunately') || 
      content.includes('regret');
    
    if (!hasStrongSignal) {
      return {
        type: 'Viewed',
        confidence: 50,
        extracted_links: [],
        matched_keywords: ['auto-acknowledgment'],
        raw_scores: {},
        isCertain: false // Let AI decide if uncertain
      };
    }
  }

  // Extract meeting/scheduling links
  const links = [...new Set(rawContent.match(LINK_REGEX) || [])];
  
  let scores = {
    Interview: 0,
    Rejected: 0,
    Offer: 0,
    Viewed: 0,
    Responded: 0
  };

  let matches = {
    Interview: [],
    Rejected: [],
    Offer: [],
    Viewed: [],
    Responded: []
  };

  // ── Score based on keyword occurrences ──
  for (const [category, keywords] of Object.entries(DICTIONARY)) {
    for (const kw of keywords) {
      if (content.includes(kw)) {
        // Longer/multi-word keywords carry more weight
        const wordCount = kw.split(' ').length;
        const weight = wordCount >= 4 ? 40 : wordCount >= 3 ? 30 : wordCount >= 2 ? 20 : 10;
        scores[category] += weight;
        matches[category].push(kw);

        // ── Subject-line boost: 2× weight for keywords in subject ──
        if (subjectNorm.includes(kw)) {
          scores[category] += weight; // double it
        }
      }
    }
  }

  // ── Strong Signals (Multiplier/Overrides) ──

  // Meeting links + interview keywords = strong interview signal
  if (links.length > 0 && scores.Interview > 0) {
    scores.Interview += 60;
    matches.Interview.push(`[meeting-link:${links.length}]`);
  } else if (links.length > 0) {
    // Meeting links alone are weaker (could be onboarding, not interview)
    scores.Interview += 20;
    matches.Interview.push(`[meeting-link-weak:${links.length}]`);
  }
  
  // Offer + congratulations combo
  if (content.includes('congratulations') && (content.includes('offer') || content.includes('pleased to'))) {
    scores.Offer += 60;
  }

  // Strong rejection signals
  if (content.includes('unfortunately') && (content.includes('not moving forward') || content.includes('other candidates') || content.includes('position'))) {
    scores.Rejected += 50;
  }
  if (content.includes('regret to inform')) {
    scores.Rejected += 50;
  }
  if (content.includes('other candidates') || content.includes('another candidate')) {
    scores.Rejected += 30;
  }

  // HR sender boost — if sender is from recruiting domain, boost the top non-Unknown score
  if (isHRSender(fromEmail)) {
    const topCat = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    if (topCat && topCat[1] > 0) {
      scores[topCat[0]] += 15;
      matches[topCat[0]].push('[hr-sender-boost]');
    }
  }

  // ── Negative Signal Detection (Anti-false-positives) ──
  
  // "Unfortunately" + interview keywords = post-interview REJECTION, not interview
  if (scores.Rejected > 20 && scores.Interview > 0 && 
      (content.includes('unfortunately') || content.includes('regret') || content.includes('not moving forward'))) {
    scores.Interview = Math.max(0, scores.Interview - 40);
    scores.Rejected += 20;
  }

  // "Congratulations" in a rejection context (rare but happens)
  if (content.includes('congratulations') && (content.includes('unfortunately') || content.includes('not selected'))) {
    scores.Offer = Math.max(0, scores.Offer - 40);
    scores.Rejected += 20;
  }

  // ── Determine top category ──
  let maxCategory = 'Unknown';
  let maxScore = 0;

  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = cat;
    }
  }

  // If no keywords matched at all, it's truly Unknown
  if (maxScore === 0) {
    return {
      type: 'Unknown',
      confidence: 10,
      extracted_links: links,
      matched_keywords: [],
      raw_scores: scores,
      isCertain: false
    };
  }

  // ── Calculate confidence ──
  // Scale: 0-20 = low, 20-50 = medium, 50+ = high confidence
  let confidence = Math.min(Math.round((maxScore / 40) * 100), 99);
  
  // Low scores mean uncertain
  if (maxScore < 15) {
    confidence = Math.min(confidence, 30);
  } else if (maxScore < 25) {
    confidence = Math.min(confidence, 55);
  }

  // Check for conflicting signals — reduce confidence if multiple categories score high
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sortedScores.length >= 2 && sortedScores[1][1] > sortedScores[0][1] * 0.6) {
    confidence = Math.min(confidence, 60); // Ambiguous — let AI decide
  }

  return {
    type: maxCategory,
    confidence: confidence,
    extracted_links: links,
    matched_keywords: matches[maxCategory] || [],
    raw_scores: scores,
    isCertain: confidence >= 80 // Raised threshold from 75 to 80
  };
}
