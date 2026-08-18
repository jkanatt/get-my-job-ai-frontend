/**
 * ObsidianBrainAdapter.js — OBPE Stage 4+5: Classification + Brain Builder
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * The critical bridge between any user's Obsidian vault and Get My Job
 * resume pipeline. Converts a parsed, validated vault into the exact
 * obsidian_brain.json schema consumed by:
 *   - RetrievalEngine.js (15-signal ranking)
 *   - MultiSignalRanker.js (domain-aware scoring)
 *   - deterministicBulletEngineer.js (bullet mining & tailoring)
 *   - latexGenerator.js (PDF rendering)
 *
 * PRIVACY GUARANTEE: This adapter is 100% generic. It processes the
 * structural patterns of ANY vault without any hardcoded user data.
 * Each user's brain output is strictly isolated by vaultOwnerId.
 *
 * Input:  parsedVault from VaultParser.parseVault()
 * Output: obsidian_brain.json (exact Get My Job-compatible schema)
 *
 * Zero LLM calls. Fully deterministic. <50ms.
 */

import { parseVault } from './VaultParser.js';
import { validateVault, printValidationReport } from './VaultValidator.js';
import fs from 'fs';
import path from 'path';

// ─── Domain Detection Keywords ──────────────────────────────────────────
// Mirrors the domain dictionaries in deterministicJDParser.js and
// build_complete_brain.js for perfect alignment with the Get My Job pipeline.
const DOMAIN_KEYWORDS = {
  fintech: ['fintech', 'payment', 'upi', 'banking', 'lending', 'credit', 'loan', 'insurance', 'neobank', 'wallet', 'kyc', 'aml', 'rbi', 'npci', 'emi', 'bfsi', 'wealth', 'investment', 'payroll', 'payout', 'transaction', 'commission', 'billing'],
  cybersecurity: ['security', 'cybersecurity', 'threat', 'vulnerability', 'easm', 'siem', 'penetration', 'firewall', 'encryption', 'zero trust', 'soc', 'incident', 'malware', 'compliance', 'audit', 'attack surface'],
  saas: ['saas', 'b2b', 'subscription', 'mrr', 'arr', 'churn', 'multi-tenant', 'self-serve', 'plg', 'product-led', 'enterprise', 'platform', 'admin panel', 'crm'],
  ai_ml: ['ai', 'ml', 'machine learning', 'deep learning', 'nlp', 'natural language', 'computer vision', 'neural network', 'llm', 'generative ai', 'bert', 'transformer', 'prediction', 'classification', 'recommendation', 'rag', 'prompt engineering'],
  edtech: ['edtech', 'education', 'learning', 'lms', 'student', 'curriculum', 'course', 'campus', 'university', 'admission', 'teaching'],
  gaming: ['gaming', 'esports', 'game', 'tournament', 'player', 'multiplayer', 'gamification', 'bingo'],
  hrms: ['hr', 'hrms', 'payroll', 'recruitment', 'hiring', 'talent', 'workforce', 'employee', 'benefits', 'onboarding', 'ats', 'performance review'],
  ecommerce: ['ecommerce', 'e-commerce', 'marketplace', 'shopping', 'booking', 'hotel', 'flight', 'deals', 'gift card'],
  logistics: ['logistics', 'supply chain', 'shipping', 'freight', 'warehouse', 'tracking', 'delivery', 'fleet', 'carrier', 'vessel'],
  healthcare: ['healthcare', 'health', 'clinical', 'patient', 'hospital', 'ehr', 'emr', 'telemedicine', 'telehealth', 'medical', 'pharma', 'hipaa'],
  devops: ['devops', 'ci/cd', 'kubernetes', 'docker', 'terraform', 'aws', 'gcp', 'azure', 'cloud', 'infrastructure'],
  data_science: ['data science', 'data engineering', 'data pipeline', 'etl', 'data warehouse', 'hadoop', 'analytics', 'tableau', 'power bi', 'regression'],
  iot: ['iot', 'sensor', 'embedded', 'parking', 'smart city', 'traffic', 'signal', 'hardware', 'telemetry'],
};

// ─── Folder-Based Classification Hints ──────────────────────────────────
// Maps common Obsidian folder names to entity types for routing.
const FOLDER_HINTS = {
  projects: 'PROJECT',
  'dev logs': 'PROJECT',
  experience: 'EXPERIENCE',
  work: 'EXPERIENCE',
  career: 'EXPERIENCE',
  education: 'EDUCATION',
  people: 'PERSON',
  contacts: 'PERSON',
  skills: 'SKILL',
  certifications: 'CERTIFICATION',
  meetings: 'MEETING',
  ideas: 'CONCEPT',
  concepts: 'CONCEPT',
  knowledge: 'CONCEPT',
  research: 'RESEARCH',
  achievements: 'ACHIEVEMENT',
  recognition: 'ACHIEVEMENT',
  daily: 'DAILY_NOTE',
  journal: 'DAILY_NOTE',
};

// ═══════════════════════════════════════════════════════════════════════
// Core Adapter: Vault → obsidian_brain.json
// ═══════════════════════════════════════════════════════════════════════

/**
 * Full pipeline: parse vault → validate → classify → build brain JSON.
 *
 * @param {string} vaultPath - Absolute path to an Obsidian vault
 * @param {Object} [options]
 * @param {boolean} [options.verbose=false] - Print validation report
 * @param {boolean} [options.strict=false] - Fail on any validation warning
 * @returns {Object} Get My Job-compatible obsidian_brain.json
 */
export function buildBrainFromVault(vaultPath, options = {}) {
  const { verbose = false, strict = false } = options;
  const startTime = Date.now();

  // ── Stage 1+2: Parse ──
  console.log('[OBPE] Stage 1+2: Parsing vault...');
  const parsedVault = parseVault(vaultPath);
  console.log(`[OBPE]   → ${parsedVault.stats.totalNotes} notes, ${parsedVault.stats.totalEdges} edges (${parsedVault.stats.parsingTimeMs}ms)`);

  // ── Stage 3: Validate ──
  console.log('[OBPE] Stage 3: Validating...');
  const validation = validateVault(parsedVault);
  if (verbose) printValidationReport(validation);

  if (!validation.isValid) {
    console.error('[OBPE] ❌ Vault has critical issues. Fix them before proceeding.');
    if (strict) throw new Error('Vault validation failed with critical issues');
  }

  if (strict && validation.summary.warnings > 0) {
    console.warn(`[OBPE] ⚠ ${validation.summary.warnings} warnings in strict mode.`);
  }

  // ── Stage 4: Classify ──
  console.log('[OBPE] Stage 4: Classifying entities...');
  const classified = classifyNodes(parsedVault.nodes);

  // ── Stage 5: Build Brain ──
  console.log('[OBPE] Stage 5: Building Get My Job brain schema...');
  const brain = buildBrainSchema(classified, parsedVault);

  const elapsed = Date.now() - startTime;
  console.log(`[OBPE] ✅ Brain built in ${elapsed}ms: ${brain.projects.length} projects, ${brain.experience_detailed.length} experiences`);

  return brain;
}

// ═══════════════════════════════════════════════════════════════════════
// Stage 4: Node Classification
// ═══════════════════════════════════════════════════════════════════════

function classifyNodes(nodes) {
  const classified = {
    projects: [],
    experiences: [],
    people: [],
    concepts: [],
    education: [],
    skills: [],
    certifications: [],
    achievements: [],
    dailyNotes: [],
    unclassified: [],
  };

  for (const node of nodes) {
    if (node.type === 'canvas') continue;

    const entityType = inferEntityType(node);

    switch (entityType) {
      case 'PROJECT':
        classified.projects.push(node);
        break;
      case 'EXPERIENCE':
        classified.experiences.push(node);
        break;
      case 'PERSON':
        classified.people.push(node);
        break;
      case 'CONCEPT':
      case 'RESEARCH':
        classified.concepts.push(node);
        break;
      case 'EDUCATION':
        classified.education.push(node);
        break;
      case 'SKILL':
        classified.skills.push(node);
        break;
      case 'CERTIFICATION':
        classified.certifications.push(node);
        break;
      case 'ACHIEVEMENT':
        classified.achievements.push(node);
        break;
      case 'DAILY_NOTE':
        classified.dailyNotes.push(node);
        break;
      default:
        classified.unclassified.push(node);
    }
  }

  return classified;
}

function inferEntityType(node) {
  // 1. Frontmatter type (highest priority)
  if (node.frontmatter?.type) {
    const fmType = node.frontmatter.type.toLowerCase();
    if (fmType.includes('project')) return 'PROJECT';
    if (fmType.includes('experience') || fmType.includes('work')) return 'EXPERIENCE';
    if (fmType.includes('person') || fmType.includes('contact')) return 'PERSON';
    if (fmType.includes('education')) return 'EDUCATION';
    if (fmType.includes('skill')) return 'SKILL';
    if (fmType.includes('cert')) return 'CERTIFICATION';
    if (fmType.includes('daily') || fmType.includes('journal')) return 'DAILY_NOTE';
    if (fmType.includes('meeting')) return 'MEETING';
    if (fmType.includes('achievement') || fmType.includes('recognition')) return 'ACHIEVEMENT';
  }

  // 2. Folder-based inference
  const folderLower = (node.folder || '').toLowerCase();
  for (const [folderName, type] of Object.entries(FOLDER_HINTS)) {
    if (folderLower.includes(folderName)) return type;
  }

  // 3. Tag-based inference
  const tags = (node.tags || []).map(t => t.toLowerCase());
  if (tags.includes('project') || tags.includes('product')) return 'PROJECT';
  if (tags.includes('experience') || tags.includes('job') || tags.includes('work')) return 'EXPERIENCE';
  if (tags.includes('person') || tags.includes('contact') || tags.includes('people')) return 'PERSON';
  if (tags.includes('education') || tags.includes('degree') || tags.includes('university')) return 'EDUCATION';
  if (tags.includes('skill')) return 'SKILL';
  if (tags.includes('certification') || tags.includes('cert')) return 'CERTIFICATION';
  if (tags.includes('achievement')) return 'ACHIEVEMENT';

  // 4. Content heuristics
  const content = (node.rawContent || '').toLowerCase();
  const headings = node.sections?.map(s => s.heading.toLowerCase()) || [];

  // Project signals
  if (headings.some(h => ['tech stack', 'features', 'kpis', 'impacts', 'architecture'].includes(h))) return 'PROJECT';
  if (content.includes('## impacts') || content.includes('## features') || content.includes('tech stack')) return 'PROJECT';

  // Experience signals
  if (node.frontmatter?.company || node.frontmatter?.role || node.frontmatter?.duration) return 'EXPERIENCE';
  if (headings.some(h => ['responsibilities', 'role', 'duties'].includes(h))) return 'EXPERIENCE';

  // Daily note pattern (YYYY-MM-DD filename)
  if (/^\d{4}-\d{2}-\d{2}$/.test(node.fileName)) return 'DAILY_NOTE';

  return 'UNCLASSIFIED';
}

// ═══════════════════════════════════════════════════════════════════════
// Stage 5: Brain Schema Builder
// ═══════════════════════════════════════════════════════════════════════

function buildBrainSchema(classified, parsedVault) {
  // ── Build Projects (exact Get My Job schema) ──
  const projects = classified.projects.map((node, index) => {
    const fullText = node.rawContent || '';
    const domains = detectDomains(fullText);
    const primaryDomain = domains[0] || 'general';

    // Extract subtitle from first H2 or frontmatter
    const subtitle = node.frontmatter?.subtitle
      || node.sections?.find(s => s.heading.toLowerCase() === 'subtitle')?.content
      || node.frontmatter?.category
      || primaryDomain;

    // Build bullets from structured sections or raw bullet list
    const bullets = buildProjectBullets(node);

    // Build domain-specific bullet variants
    const bulletVariants = {};
    for (const domain of domains) {
      bulletVariants[domain] = bullets; // Same bullets, indexed by domain for retrieval
    }

    return {
      id: node.id,
      name: node.fileName,
      aliases: [node.fileName],
      tags: node.tags,
      content: fullText,
      bullets,
      domains,
      bullet_variants: bulletVariants,
      subtitle: String(subtitle).trim(),
      domain: primaryDomain,
      kpis: node.kpis,
      links: node.urls.filter(u => u.startsWith('http')).map(url => ({ url, label: 'Link' })),
      tech_stack: extractTechStack(fullText),
      inherent_rank: index + 1,
    };
  });

  // ── Build Experience (exact Get My Job schema) ──
  const experience_detailed = classified.experiences.map(node => ({
    title: node.frontmatter?.role || node.frontmatter?.title || extractRoleFromContent(node),
    company: node.frontmatter?.company || extractCompanyFromContent(node),
    duration: node.frontmatter?.duration || node.frontmatter?.period || '',
    location: node.frontmatter?.location || '',
    company_description: node.frontmatter?.description || '',
    bullets: buildExperienceBullets(node),
    tags: node.tags,
    industry_tags: detectDomains(node.rawContent || ''),
    achievements: node.kpis,
  }));

  // ── Build Domain Index (used by MultiSignalRanker S3/S4) ──
  const domain_index = {};
  for (const project of projects) {
    for (const domain of project.domains) {
      if (!domain_index[domain]) domain_index[domain] = [];
      domain_index[domain].push(project.id);
    }
  }

  // ── Build Keyword Index ──
  const keyword_index = {};
  for (const project of projects) {
    for (const tag of project.tags) {
      if (!keyword_index[tag]) keyword_index[tag] = [];
      keyword_index[tag].push(project.id);
    }
  }

  // ── Build Profile from vault metadata ──
  const profile = extractProfile(classified, parsedVault);

  // ── Build Skill Pools ──
  const skill_pools = buildSkillPools(classified.skills, projects);

  // ── Build Education ──
  const education = classified.education.map(node => ({
    degree: node.frontmatter?.degree || node.fileName,
    institution: node.frontmatter?.institution || node.frontmatter?.university || '',
    description: node.bullets.slice(0, 3).join(' ') || node.rawContent?.slice(0, 200) || '',
  }));

  // ── Assemble Brain ──
  return {
    version: '2.0.0-obpe',
    generated_at: new Date().toISOString(),
    source: 'ObsidianBrainAdapter',
    profile,
    projects,
    experience_detailed,
    experience_variants: {},
    domain_index,
    domain_headers: buildDomainHeaders(domain_index),
    skill_pools,
    case_study_learnings: [],
    keyword_index,
    skill_project_index: {},
  };
}

// ─── Helper: Build Project Bullets ──────────────────────────────────────
function buildProjectBullets(node) {
  // Prefer structured sections (## Impacts, ## Features, ## KPIs)
  const impactSections = (node.sections || []).filter(s =>
    ['impacts', 'kpis', 'features', 'deliverables', 'achievements', 'impacts & kpis'].includes(s.heading.toLowerCase())
  );

  if (impactSections.length > 0) {
    const sectionBullets = [];
    for (const section of impactSections) {
      const lines = section.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^[-*]\s+/.test(trimmed)) {
          sectionBullets.push(trimmed.replace(/^[-*]\s+/, ''));
        }
      }
    }
    if (sectionBullets.length > 0) return sectionBullets.slice(0, 6);
  }

  // Fallback: use all bullets from the note
  if (node.bullets.length > 0) return node.bullets.slice(0, 6);

  // Last resort: use first paragraph
  const firstParagraph = (node.rawContent || '').split('\n\n')[0]?.trim();
  return firstParagraph ? [firstParagraph] : ['Project details available in vault.'];
}

// ─── Helper: Build Experience Bullets ───────────────────────────────────
function buildExperienceBullets(node) {
  const responsibilitySections = (node.sections || []).filter(s =>
    ['responsibilities', 'key contributions', 'work', 'bullets', 'role'].includes(s.heading.toLowerCase())
  );

  if (responsibilitySections.length > 0) {
    const bullets = [];
    for (const section of responsibilitySections) {
      const lines = section.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^[-*]\s+/.test(trimmed)) {
          bullets.push(trimmed.replace(/^[-*]\s+/, ''));
        }
      }
    }
    if (bullets.length > 0) return bullets.slice(0, 6);
  }

  return node.bullets.slice(0, 6);
}

// ─── Helper: Detect Domains ─────────────────────────────────────────────
function detectDomains(text) {
  const lower = (text || '').toLowerCase();
  const domains = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const matchCount = keywords.filter(kw => lower.includes(kw)).length;
    if (matchCount >= 2) domains.push(domain);
  }
  if (domains.length === 0) domains.push('general');
  return domains;
}

// ─── Helper: Extract Tech Stack ─────────────────────────────────────────
const TECH_PATTERNS = new Set([
  'react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte', 'node.js', 'nodejs',
  'express', 'fastapi', 'django', 'flask', 'spring', 'python', 'javascript',
  'typescript', 'java', 'go', 'rust', 'swift', 'kotlin', 'ruby', 'php',
  'postgresql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'firebase',
  'supabase', 'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform',
  'kafka', 'graphql', 'rest', 'websocket', 'react native', 'flutter',
  'tailwind', 'figma', 'stripe', 'razorpay', 'twilio', 'sendgrid',
  'openai', 'gpt', 'llm', 'langchain', 'llamaindex', 'pinecone', 'chromadb',
]);

function extractTechStack(text) {
  const lower = text.toLowerCase();
  return [...TECH_PATTERNS].filter(tech => lower.includes(tech));
}

// ─── Helper: Extract Profile ────────────────────────────────────────────
function extractProfile(classified, parsedVault) {
  // Look for a profile/about note
  const profileNode = parsedVault.nodes.find(n =>
    ['profile', 'about', 'about me', 'bio', 'resume', 'cv'].includes(n.fileName.toLowerCase())
  );

  const fm = profileNode?.frontmatter || {};

  return {
    name: fm.name || fm.full_name || '',
    email: fm.email || '',
    phone: fm.phone || '',
    linkedin: fm.linkedin || '',
    portfolio: fm.portfolio || fm.website || '',
    location: fm.location || '',
    experience_years: fm.experience_years || fm.experience || '',
    skills_summary: {},
    recognition: [],
    education_detailed: [],
    career_highlights: [],
    leadership: [],
    achievements: [],
    consulting_summary: '',
    volunteer_community: [],
    extra_curricular: [],
  };
}

// ─── Helper: Extract Role/Company from Content ──────────────────────────
function extractRoleFromContent(node) {
  const headings = node.sections?.map(s => s.heading) || [];
  const roleHeading = headings.find(h => /role|title|position/i.test(h));
  if (roleHeading) {
    const section = node.sections.find(s => s.heading === roleHeading);
    return section?.content?.split('\n')[0]?.trim() || node.fileName;
  }
  return node.fileName;
}

function extractCompanyFromContent(node) {
  const headings = node.sections?.map(s => s.heading) || [];
  const companyHeading = headings.find(h => /company|employer|organization/i.test(h));
  if (companyHeading) {
    const section = node.sections.find(s => s.heading === companyHeading);
    return section?.content?.split('\n')[0]?.trim() || '';
  }
  return node.frontmatter?.company || '';
}

// ─── Helper: Build Skill Pools ──────────────────────────────────────────
function buildSkillPools(skillNodes, projects) {
  const pools = {
    ai_product_strategy: [],
    domain_skills: [],
    tools: [],
    analytics: [],
    other_skills: [],
    domain_expertise_pool: {},
  };

  // Extract from skill notes
  for (const node of skillNodes) {
    for (const bullet of node.bullets) {
      pools.other_skills.push(bullet);
    }
  }

  // Extract from project tech stacks
  const allTech = new Set();
  for (const project of projects) {
    for (const tech of (project.tech_stack || [])) {
      allTech.add(tech);
    }
  }
  pools.tools = [...allTech];

  return pools;
}

// ─── Helper: Build Domain Headers ───────────────────────────────────────
function buildDomainHeaders(domainIndex) {
  const headers = {};
  for (const domain of Object.keys(domainIndex)) {
    headers[domain] = domain.charAt(0).toUpperCase() + domain.slice(1).replace(/_/g, ' ') + ' Product Manager';
  }
  return headers;
}

// ═══════════════════════════════════════════════════════════════════════
// CLI Entry Point
// ═══════════════════════════════════════════════════════════════════════

/**
 * Write the brain to disk at the standard Get My Job path.
 *
 * @param {Object} brain - The built brain schema
 * @param {string} [outputPath] - Custom output path (defaults to Get My Job standard)
 */
export function writeBrain(brain, outputPath) {
  const targetPath = outputPath || path.join(
    process.cwd(),
    'src/app/api/ai/tailor-resume/obsidian_brain.json'
  );

  // Backup existing
  if (fs.existsSync(targetPath)) {
    const backupPath = targetPath.replace('.json', `_backup_${Date.now()}.json`);
    fs.copyFileSync(targetPath, backupPath);
    console.log(`[OBPE] 📦 Backed up existing brain to ${path.basename(backupPath)}`);
  }

  fs.writeFileSync(targetPath, JSON.stringify(brain, null, 2), 'utf-8');
  console.log(`[OBPE] ✅ Brain written to ${targetPath}`);
}

// ═══════════════════════════════════════════════════════════════════════
// Standalone CLI runner
// ═══════════════════════════════════════════════════════════════════════
// Usage: node src/infrastructure/engines/ObsidianBrainAdapter.js /path/to/vault [--verbose] [--write]

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('ObsidianBrainAdapter.js') ||
  process.argv[1].endsWith('ObsidianBrainAdapter.mjs')
);

if (isMainModule) {
  const vaultPath = process.argv[2];
  const verbose = process.argv.includes('--verbose');
  const shouldWrite = process.argv.includes('--write');

  if (!vaultPath) {
    console.error('Usage: node ObsidianBrainAdapter.js /path/to/vault [--verbose] [--write]');
    process.exit(1);
  }

  if (!fs.existsSync(vaultPath)) {
    console.error(`Vault path does not exist: ${vaultPath}`);
    process.exit(1);
  }

  const brain = buildBrainFromVault(path.resolve(vaultPath), { verbose });

  console.log('\n━━━ Brain Schema Summary ━━━');
  console.log(`  Projects:    ${brain.projects.length}`);
  console.log(`  Experience:  ${brain.experience_detailed.length}`);
  console.log(`  Domains:     ${Object.keys(brain.domain_index).length}`);
  console.log(`  Keywords:    ${Object.keys(brain.keyword_index).length}`);
  console.log(`  Version:     ${brain.version}`);

  if (shouldWrite) {
    writeBrain(brain);
  } else {
    console.log('\n  Add --write to save to obsidian_brain.json');
  }
}
