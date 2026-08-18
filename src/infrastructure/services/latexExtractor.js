/**
 * latexExtractor.js — Multi-Engine LaTeX Document Intelligence
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Engine 1: Native Regex Parser (LaTeX commands, patterns)
 * Engine 2: AI Assisted (via existing parseResumeWithLLM)
 * Engine 3: Reconciliation (merge, validate, deduplicate)
 *
 * Extracts: name, email, phone, location, linkedin, github, portfolio,
 *           experience[], education[], projects[], skills[], certifications[],
 *           awards[], publications[], languages[], interests[], metrics[]
 */

// ═══════════════════════════════════════════════════════════
// ENGINE 1: Native Regex Parser
// ═══════════════════════════════════════════════════════════

/**
 * Strip LaTeX commands and return clean text
 */
function stripLatex(tex) {
  return tex
    .replace(/\\\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\\\emph\{([^}]*)\}/g, '$1')
    .replace(/\\\\underline\{([^}]*)\}/g, '$1')
    .replace(/\\\\href\{([^}]*)\}\{([^}]*)\}/g, '$2 ($1)')
    .replace(/\\\\hlink\{([^}]*)\}\{([^}]*)\}/g, '$2 ($1)')
    .replace(/\\\\color\{[^}]*\}/g, '')
    .replace(/\\\\fontsize\{[^}]*\}\{[^}]*\}\\\\selectfont/g, '')
    .replace(/\\\\\w+\{/g, '{')
    .replace(/\{|\}/g, '')
    .replace(/\\\\/g, ' ')
    .replace(/\\enspace|\\textbullet|\\textbar|\\quad|\\par|\\noindent/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract contact information using regex patterns
 */
function extractContact(tex) {
  const result = {};
  
  // Email
  const emailMatch = tex.match(/mailto:([^\s}]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) result.email = emailMatch[1] || emailMatch[2];

  // Phone
  const phoneMatch = tex.match(/(\+?\d[\d\s,.-]{8,15}\d)/);
  if (phoneMatch) result.phone = phoneMatch[1].replace(/\\,/g, '').replace(/\s+/g, ' ').trim();

  // LinkedIn
  const linkedinMatch = tex.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  if (linkedinMatch) result.linkedin = `linkedin.com/in/${linkedinMatch[1]}`;

  // GitHub
  const githubMatch = tex.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
  if (githubMatch) result.github = `github.com/${githubMatch[1]}`;

  // Portfolio (generic URL in header area)
  const portfolioMatch = tex.match(/\\href\{(https?:\/\/[^}]+)\}[^}]*Portfolio/i);
  if (portfolioMatch) result.portfolio = portfolioMatch[1];

  // Location (common patterns)
  const locationMatch = tex.match(/([\w\s]+,\s*(?:India|USA|UK|Canada|Australia|Germany|Singapore|Dubai|Remote))/i);
  if (locationMatch) result.location = locationMatch[1].trim();

  return result;
}

/**
 * Extract name from LaTeX header
 */
function extractName(tex) {
  // Pattern 1: Large font name in header
  const nameMatch = tex.match(/\\fontsize\{2[0-9]pt\}.*?\\color\{white\}\s*([A-Z][A-Z\s.]+)/);
  if (nameMatch) return nameMatch[1].trim();
  
  // Pattern 2: \huge or \LARGE name
  const hugeMatch = tex.match(/\\(?:huge|LARGE|Huge)\s*\\?(?:bfseries\s*)?(?:\\color\{[^}]*\})?\s*([A-Z][A-Za-z\s.]+)/);
  if (hugeMatch) return hugeMatch[1].trim();

  // Pattern 3: Name in first \textbf or section
  const boldNameMatch = tex.match(/\\textbf\{([A-Z][A-Za-z\s.]{3,40})\}/);
  if (boldNameMatch) return boldNameMatch[1].trim();

  return '';
}

/**
 * Extract sections from LaTeX document
 */
function extractSections(tex) {
  const sections = {};
  // Split by \section{...}
  const sectionPattern = /\\section\{([^}]+)\}/gi;
  let match;
  const sectionStarts = [];

  while ((match = sectionPattern.exec(tex)) !== null) {
    sectionStarts.push({ name: match[1].trim(), index: match.index });
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i];
    const endIdx = i + 1 < sectionStarts.length ? sectionStarts[i + 1].index : tex.length;
    sections[start.name.toLowerCase().replace(/\s+/g, '_')] = tex.substring(start.index, endIdx);
  }

  return sections;
}

/**
 * Extract experience entries using Regex
 */
export function extractExperience(tex) {
  const entries = [];
  
  // Pattern: \expheader{Company}{| Role}{Tenure}{Location}
  const expPattern = /\\expheader\{([^}]*)\}\{[|]?\s*([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g;
  let match;

  while ((match = expPattern.exec(tex)) !== null) {
    const entry = {
      company: stripLatex(match[1]),
      title: stripLatex(match[2]),
      tenure: stripLatex(match[3]),
      location: stripLatex(match[4]),
      bullets: []
    };

    // Extract bullets after this header until next \expheader or \section
    const afterHeader = tex.substring(match.index + match[0].length);
    const bulletSection = afterHeader.split(/\\expheader|\\section/)[0];
    const bulletPattern = /\\item\s+(.+?)(?=\\item|\\end\{|$)/gs;
    let bulletMatch;
    while ((bulletMatch = bulletPattern.exec(bulletSection)) !== null) {
      const bullet = stripLatex(bulletMatch[1]).trim();
      if (bullet.length > 10) entry.bullets.push(bullet);
    }

    entries.push(entry);
  }

  // Fallback: subsection-based experience
  if (entries.length === 0) {
    const subPattern = /\\subsection\*?\{([^}]+)\}([\s\S]*?)(?=\\subsection|\\section|\\end\{document\})/g;
    while ((match = subPattern.exec(tex)) !== null) {
      const heading = stripLatex(match[1]);
      const body = match[2];
      if (/\d{4}/.test(body) && /\\item/.test(body)) {
        const entry = { company: heading, title: '', tenure: '', location: '', bullets: [] };
        const dateMatch = body.match(/(\w+\s*\d{4}\s*(?:to|–|-)\s*(?:\w+\s*\d{4}|Present))/i);
        if (dateMatch) entry.tenure = stripLatex(dateMatch[1]);
        const bulletPattern2 = /\\item\s+(.+?)(?=\\item|\\end\{|$)/gs;
        let bm;
        while ((bm = bulletPattern2.exec(body)) !== null) {
          const b = stripLatex(bm[1]).trim();
          if (b.length > 10) entry.bullets.push(b);
        }
        entries.push(entry);
      }
    }
  }

  return entries;
}

/**
 * Extract education entries
 */
function extractEducation(tex) {
  const entries = [];
  const sections = extractSections(tex);
  const eduSection = sections.education || '';

  if (!eduSection) return entries;

  // Pattern: \subsection{Institution} + degree + years
  const subPattern = /\\subsection\{([^}]+)\}([\s\S]*?)(?=\\subsection|\\section|\\end\{|$)/g;
  let match;
  while ((match = subPattern.exec(eduSection)) !== null) {
    const institution = stripLatex(match[1]);
    const body = stripLatex(match[2]);
    const yearMatch = body.match(/(\d{4}\s*(?:to|–|-)\s*\d{4}|\d{4})/);
    const degreeMatch = body.match(/^([^0-9]+)/);
    entries.push({
      institution,
      degree: degreeMatch ? degreeMatch[1].trim() : '',
      years: yearMatch ? yearMatch[1] : '',
      location: ''
    });
  }

  return entries;
}

/**
 * Extract skills from LaTeX
 */
function extractSkills(tex) {
  const skills = [];
  
  // Pattern: \skilltag{Skill1 \textbullet{} Skill2 ...}
  const skilltagPattern = /\\skilltag\{([^}]+)\}/g;
  let match;
  while ((match = skilltagPattern.exec(tex)) !== null) {
    const skillStr = stripLatex(match[1]);
    skillStr.split(/[•·|]/).forEach(s => {
      const clean = s.trim();
      if (clean.length > 1) skills.push(clean);
    });
  }

  return [...new Set(skills)];
}

/**
 * Extract projects from LaTeX
 */
function extractProjects(tex) {
  const projects = [];
  
  // Pattern: \projheader{Name}{| Subtitle | Link}
  const projPattern = /\\projheader\{([^}]*)\}\{([^}]*)\}/g;
  let match;
  while ((match = projPattern.exec(tex)) !== null) {
    const project = {
      name: stripLatex(match[1]),
      subtitle: stripLatex(match[2]).replace(/^\|\s*/, ''),
      bullets: [],
      link: ''
    };

    // Extract link
    const linkMatch = match[1].match(/\\href\{([^}]+)\}/);
    if (linkMatch) project.link = linkMatch[1];

    // Extract bullets
    const afterHeader = tex.substring(match.index + match[0].length);
    const bulletSection = afterHeader.split(/\\projheader|\\section|\\end\{minipage\}/)[0];
    const bulletPattern = /\\item\s+(.+?)(?=\\item|\\end\{|$)/gs;
    let bm;
    while ((bm = bulletPattern.exec(bulletSection)) !== null) {
      const b = stripLatex(bm[1]).trim();
      if (b.length > 10) project.bullets.push(b);
    }

    projects.push(project);
  }

  return projects;
}

/**
 * Extract metrics and quantified achievements
 */
function extractMetrics(tex) {
  const metrics = [];
  const cleanText = stripLatex(tex);
  
  const metricPattern = /(\d+[%xX+]|\d+[KkMm]\+|\$[\d,.]+[KkMm]?|\d+\+?\s*(?:users|downloads|employees|teams|products|launches|years))/gi;
  let match;
  while ((match = metricPattern.exec(cleanText)) !== null) {
    metrics.push(match[1].trim());
  }

  return [...new Set(metrics)];
}

/**
 * Extract all links from LaTeX
 */
function extractLinks(tex) {
  const links = [];
  const linkPattern = /\\href\{([^}]+)\}\{([^}]*)\}/g;
  let match;
  while ((match = linkPattern.exec(tex)) !== null) {
    links.push({ url: match[1], text: stripLatex(match[2]) });
  }

  const hlinkPattern = /\\hlink\{([^}]+)\}\{([^}]*)\}/g;
  while ((match = hlinkPattern.exec(tex)) !== null) {
    links.push({ url: match[1], text: stripLatex(match[2]) });
  }

  return links;
}

// ═══════════════════════════════════════════════════════════
// ENGINE 1: MAIN REGEX EXTRACTION
// ═══════════════════════════════════════════════════════════
export function regexExtractFromLatex(tex) {
  const name = extractName(tex);
  const contact = extractContact(tex);
  const experience = extractExperience(tex);
  const education = extractEducation(tex);
  const skills = extractSkills(tex);
  const projects = extractProjects(tex);
  const metrics = extractMetrics(tex);
  const links = extractLinks(tex);

  // Derive first_name / last_name from name
  const nameParts = name.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    _engine: 'regex',
    first_name: firstName,
    last_name: lastName,
    name,
    ...contact,
    experience,
    education,
    skills,
    projects,
    metrics,
    links,
    _confidence: {
      name: name ? 0.9 : 0,
      email: contact.email ? 0.95 : 0,
      phone: contact.phone ? 0.85 : 0,
      experience: experience.length > 0 ? 0.8 : 0,
      education: education.length > 0 ? 0.85 : 0,
      skills: skills.length > 0 ? 0.9 : 0,
      projects: projects.length > 0 ? 0.8 : 0
    }
  };
}

// ═══════════════════════════════════════════════════════════
// ENGINE 3: RECONCILIATION
// ═══════════════════════════════════════════════════════════

/**
 * Merge results from regex engine and AI engine.
 * AI wins for structured fields; regex wins for contact info.
 * Both contribute unique entries to arrays.
 */
export function reconcileExtractions(regexResult, aiResult) {
  const merged = {
    _engine: 'reconciled',
    
    // Contact: regex is more reliable for pattern-matching
    first_name: regexResult.first_name || aiResult?.first_name || '',
    last_name: regexResult.last_name || aiResult?.last_name || '',
    name: regexResult.name || aiResult?.name || '',
    email: regexResult.email || aiResult?.email || '',
    phone: regexResult.phone || aiResult?.phone || '',
    location: regexResult.location || aiResult?.location || '',
    linkedin: regexResult.linkedin || aiResult?.linkedin || '',
    github: regexResult.github || aiResult?.github || '',
    portfolio: regexResult.portfolio || aiResult?.portfolio || '',
    title: aiResult?.title || '',

    // Arrays: merge unique entries
    experience: mergeArrays(
      regexResult.experience || [],
      aiResult?.experience || [],
      'company'
    ),
    education: mergeArrays(
      regexResult.education || [],
      aiResult?.education || [],
      'institution'
    ),
    skills: [...new Set([
      ...(regexResult.skills || []),
      ...(aiResult?.skills || [])
    ])],
    projects: mergeArrays(
      regexResult.projects || [],
      aiResult?.projects || [],
      'name'
    ),

    // Extras from regex
    metrics: regexResult.metrics || [],
    links: regexResult.links || [],

    // AI extras
    languages: aiResult?.languages || [],
    certifications: aiResult?.certifications || [],
    awards: aiResult?.awards || [],

    _confidence: regexResult._confidence || {}
  };

  return merged;
}

/**
 * Merge two arrays by a key field, preferring entries with more data
 */
function mergeArrays(arr1, arr2, keyField) {
  const map = new Map();
  
  for (const item of arr1) {
    const key = (item[keyField] || '').toLowerCase().trim();
    if (key) map.set(key, item);
  }

  for (const item of arr2) {
    const key = (item[keyField] || '').toLowerCase().trim();
    if (!key) continue;
    
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      // Merge: prefer the entry with more bullets/data
      const existingBullets = existing.bullets?.length || 0;
      const newBullets = item.bullets?.length || 0;
      if (newBullets > existingBullets) {
        map.set(key, { ...existing, ...item });
      } else {
        map.set(key, { ...item, ...existing });
      }
    }
  }

  return Array.from(map.values());
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT: Full extraction pipeline
// ═══════════════════════════════════════════════════════════

/**
 * Full multi-engine extraction from LaTeX source.
 * @param {string} tex - Raw LaTeX source code
 * @param {object} [aiResult] - Optional AI-parsed result to reconcile with
 * @returns {object} Reconciled profile object
 */
export function extractFromLatex(tex, aiResult = null) {
  const regexResult = regexExtractFromLatex(tex);
  
  if (aiResult) {
    return reconcileExtractions(regexResult, aiResult);
  }

  return regexResult;
}

export { stripLatex, extractLinks, extractMetrics };
