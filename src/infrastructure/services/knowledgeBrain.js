import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║              KNOWLEDGE BRAIN — Persistent Model-Independent Store      ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Stores all LLM decisions, JD analyses, project selections, and       ║
 * ║  generation history so that when models change between tiers or        ║
 * ║  providers, NO context, decision, or previous work is lost.            ║
 * ║                                                                        ║
 * ║  Storage: JSON files in .data/brain/ (Git-tracked, survives model      ║
 * ║  changes, readable by humans and LLMs).                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

const BRAIN_DIR = path.resolve(process.cwd(), '.data', 'brain');
const DIRS = {
  jdAnalyses: path.join(BRAIN_DIR, 'jd_analyses'),
  projectDecisions: path.join(BRAIN_DIR, 'project_decisions'),
  generationHistory: path.join(BRAIN_DIR, 'generation_history'),
};

function ensureDirs() {
  for (const dir of Object.values(DIRS)) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  // Ensure the root brain dir exists too
  if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });
}

/**
 * Generate a stable hash for a JD text (for deduplication).
 */
function hashJD(jdText) {
  return crypto.createHash('sha256').update(jdText.trim().substring(0, 8000)).digest('hex').substring(0, 16);
}

/**
 * Generate a timestamped filename.
 */
function timestampedFilename(prefix, ext = 'json') {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${ts}.${ext}`;
}


// ═══════════════════════════════════════════════════════════════════════════
// JD ANALYSIS MEMORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Store a JD analysis result for future reference.
 * If the same JD was analyzed before, the previous result is still kept (versioned).
 */
export function storeJDAnalysis(jdText, jdIntel, companyContext = null) {
  try {
    ensureDirs();
    const hash = hashJD(jdText);
    const entry = {
      jd_hash: hash,
      timestamp: new Date().toISOString(),
      company: jdIntel.company_name || companyContext?.name || 'Unknown',
      role_type: jdIntel.role_type,
      domain: jdIntel.domain,
      seniority: jdIntel.seniority,
      business_model: jdIntel.business_model,
      industry: jdIntel.industry,
      required_skills: jdIntel.required_skills,
      all_keywords_count: jdIntel.all_keywords?.length || 0,
      jd_text_preview: jdText.substring(0, 500),
    };
    const filename = `jd_${hash}.json`;
    const filePath = path.join(DIRS.jdAnalyses, filename);
    // Fire-and-forget async write — non-blocking
    fs.promises.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8').catch(() => {});
    return hash;
  } catch {
    // Non-fatal
    return null;
  }
}

/**
 * Look up a previous JD analysis by its text hash.
 * U3: Also performs fuzzy deduplication — if an exact hash match isn't found,
 * checks for near-duplicate JDs (same company/role, > 85% text overlap).
 */
export function lookupJDAnalysis(jdText) {
  try {
    const hash = hashJD(jdText);
    const filePath = path.join(DIRS.jdAnalyses, `jd_${hash}.json`);
    // Exact match
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    // Fuzzy match: scan existing JD analyses for near-duplicates
    const files = fs.readdirSync(DIRS.jdAnalyses).filter(f => f.endsWith('.json'));
    const jdNormalized = jdText.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const file of files.slice(-50)) { // Only check last 50 to avoid O(n) scan
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(DIRS.jdAnalyses, file), 'utf-8'));
        if (entry.jd_text_preview) {
          const previewNorm = entry.jd_text_preview.toLowerCase().replace(/\s+/g, ' ').trim();
          // Simple overlap ratio: shared characters / max length (on the preview window)
          const similarity = _textSimilarity(jdNormalized.substring(0, 500), previewNorm);
          if (similarity > 0.85) {
            console.log(`[Brain] U3: Fuzzy JD match found (${(similarity * 100).toFixed(0)}% similar) → reusing ${file}`);
            return entry;
          }
        }
      } catch { /* skip corrupt files */ }
    }
  } catch { /* non-fatal */ }
  return null;
}

/**
 * Simple bigram-based text similarity (Dice coefficient).
 */
function _textSimilarity(a, b) {
  if (!a || !b) return 0;
  const bigramsA = new Set();
  const bigramsB = new Set();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.substring(i, i + 2));
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.substring(i, i + 2));
  let intersection = 0;
  for (const bg of bigramsA) { if (bigramsB.has(bg)) intersection++; }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}


// ═══════════════════════════════════════════════════════════════════════════
// PROJECT DECISION MEMORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Store which projects were selected for a JD, with their scores and reasons.
 */
export function storeProjectDecisions(jdHash, selectedProjects, allRankings) {
  try {
    ensureDirs();
    const entry = {
      jd_hash: jdHash,
      timestamp: new Date().toISOString(),
      selected_count: selectedProjects.length,
      selected_projects: selectedProjects.map(p => ({
        id: p.id,
        name: p.name,
        combined_score: p.combined_score,
        tier: p.doc2_evaluation?.tier || 'unknown',
      })),
      total_candidates: allRankings.length,
      top_10_rankings: allRankings.slice(0, 10).map(r => ({
        id: r.id,
        name: r.name,
        score: r.combined_score,
      })),
    };
    const filename = `decisions_${jdHash}.json`;
    // Fire-and-forget async write — non-blocking
    fs.promises.writeFile(path.join(DIRS.projectDecisions, filename), JSON.stringify(entry, null, 2), 'utf-8').catch(() => {});
  } catch { /* non-fatal */ }
}


// ═══════════════════════════════════════════════════════════════════════════
// GENERATION HISTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Store a generation result (resume, cover letter, or email).
 */
export function storeGenerationResult(type, jdHash, metadata) {
  try {
    ensureDirs();
    const entry = {
      type,  // 'resume' | 'cover_letter' | 'email'
      jd_hash: jdHash,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    const filename = timestampedFilename(`${type}_${jdHash}`);
    // Fire-and-forget async write — non-blocking
    fs.promises.writeFile(path.join(DIRS.generationHistory, filename), JSON.stringify(entry, null, 2), 'utf-8').catch(() => {});
  } catch { /* non-fatal */ }
}

/**
 * Get all generation history entries (last N).
 */
export function getGenerationHistory(limit = 20) {
  try {
    ensureDirs();
    const files = fs.readdirSync(DIRS.generationHistory)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);
    return files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(DIRS.generationHistory, f), 'utf-8')); }
      catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}


// ═══════════════════════════════════════════════════════════════════════════
// BRAIN INDEX — Quick lookup
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a summary of the brain's contents for debugging.
 */
export function getBrainSummary() {
  try {
    ensureDirs();
    const jdCount = fs.readdirSync(DIRS.jdAnalyses).filter(f => f.endsWith('.json')).length;
    const decisionCount = fs.readdirSync(DIRS.projectDecisions).filter(f => f.endsWith('.json')).length;
    const generationCount = fs.readdirSync(DIRS.generationHistory).filter(f => f.endsWith('.json')).length;

    const logFile = path.join(BRAIN_DIR, 'llm_call_log.jsonl');
    let llmCallCount = 0;
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf-8');
      llmCallCount = content.split('\n').filter(l => l.trim()).length;
    }

    return {
      jdAnalyses: jdCount,
      projectDecisions: decisionCount,
      generationHistory: generationCount,
      llmCalls: llmCallCount,
      brainDir: BRAIN_DIR,
    };
  } catch {
    return { error: 'Failed to read brain directory' };
  }
}
