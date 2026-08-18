/**
 * Application History Tracker
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Records every application sent through the Get My Job pipeline.
 * Stores metadata, status, and response tracking for analytics.
 *
 * Storage: .data/application_history.json
 * Format: Array of ApplicationEntry objects
 */

import fs from 'fs';
import path from 'path';

const HISTORY_DIR = path.join(process.cwd(), '.data');
const HISTORY_FILE = path.join(HISTORY_DIR, 'application_history.json');

/**
 * @typedef {Object} ApplicationEntry
 * @property {string} id - Unique application ID (timestamp-based)
 * @property {string} company - Company name
 * @property {string} role - Role title
 * @property {string} domain - Job domain
 * @property {string} recruiter_email - Recruiter email
 * @property {string} recruiter_name - Recruiter name
 * @property {string} timestamp - ISO timestamp
 * @property {string} status - 'sent' | 'opened' | 'replied' | 'rejected' | 'interview' | 'offer'
 * @property {number} ats_score - ATS validation score
 * @property {string[]} projects_used - Project IDs used in the application
 * @property {string} resume_path - Path to generated resume PDF
 * @property {string} cover_letter_path - Path to generated cover letter
 * @property {Object} metrics - Pipeline performance metrics
 */

function ensureDir() {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

/**
 * Load application history from disk
 * @returns {ApplicationEntry[]}
 */
export function loadHistory() {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Save application history to disk
 * @param {ApplicationEntry[]} history
 */
function saveHistory(history) {
  ensureDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

/**
 * Record a new application
 * @param {Partial<ApplicationEntry>} entry
 * @returns {ApplicationEntry} The recorded entry with generated ID
 */
export function recordApplication(entry) {
  const history = loadHistory();

  const record = {
    id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    company: entry.company || 'Unknown',
    role: entry.role || 'Unknown',
    domain: entry.domain || 'general',
    recruiter_email: entry.recruiter_email || '',
    recruiter_name: entry.recruiter_name || 'Hiring Manager',
    timestamp: new Date().toISOString(),
    status: 'sent',
    ats_score: entry.ats_score || null,
    projects_used: entry.projects_used || [],
    resume_path: entry.resume_path || null,
    cover_letter_path: entry.cover_letter_path || null,
    email_template_id: entry.email_template_id || 1,
    metrics: {
      pipeline_duration_ms: entry.metrics?.pipeline_duration_ms || null,
      llm_calls: entry.metrics?.llm_calls || null,
      provider_used: entry.metrics?.provider_used || null,
      keyword_coverage: entry.metrics?.keyword_coverage || null,
    },
    notes: entry.notes || '',
  };

  history.push(record);
  saveHistory(history);

  console.log(`📋 Application recorded: ${record.id} → ${record.company} (${record.role})`);
  return record;
}

/**
 * Update an existing application's status
 * @param {string} id - Application ID
 * @param {string} status - New status
 * @param {string} [notes] - Optional notes
 */
export function updateApplicationStatus(id, status, notes) {
  const history = loadHistory();
  const entry = history.find(e => e.id === id);

  if (!entry) {
    console.warn(`⚠️ Application ${id} not found in history`);
    return null;
  }

  entry.status = status;
  entry.updated_at = new Date().toISOString();
  if (notes) entry.notes = (entry.notes ? entry.notes + '\n' : '') + notes;

  saveHistory(history);
  console.log(`✅ Updated ${id}: status → ${status}`);
  return entry;
}

/**
 * Check if we've already applied to a company+role combo
 * @param {string} company
 * @param {string} role
 * @returns {ApplicationEntry|null}
 */
export function checkDuplicateApplication(company, role) {
  const history = loadHistory();
  const companyLower = company.toLowerCase();
  const roleLower = role.toLowerCase();

  return history.find(e =>
    e.company.toLowerCase() === companyLower &&
    e.role.toLowerCase() === roleLower &&
    e.status !== 'rejected'
  ) || null;
}

/**
 * Get application statistics
 * @returns {Object} Stats summary
 */
export function getApplicationStats() {
  const history = loadHistory();

  const stats = {
    total: history.length,
    by_status: {},
    by_domain: {},
    by_company: {},
    avg_ats_score: 0,
    last_30_days: 0,
    last_7_days: 0,
  };

  const now = Date.now();
  const day30 = 30 * 24 * 60 * 60 * 1000;
  const day7 = 7 * 24 * 60 * 60 * 1000;
  let atsSum = 0;
  let atsCount = 0;

  for (const entry of history) {
    // By status
    stats.by_status[entry.status] = (stats.by_status[entry.status] || 0) + 1;

    // By domain
    stats.by_domain[entry.domain] = (stats.by_domain[entry.domain] || 0) + 1;

    // By company
    stats.by_company[entry.company] = (stats.by_company[entry.company] || 0) + 1;

    // ATS score
    if (entry.ats_score) {
      atsSum += entry.ats_score;
      atsCount++;
    }

    // Time-based
    const entryTime = new Date(entry.timestamp).getTime();
    if (now - entryTime < day30) stats.last_30_days++;
    if (now - entryTime < day7) stats.last_7_days++;
  }

  stats.avg_ats_score = atsCount > 0 ? Math.round(atsSum / atsCount) : 0;

  return stats;
}
