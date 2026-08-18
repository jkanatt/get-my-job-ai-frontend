import fs from 'fs';
import path from 'path';

/**
 * U2: Response Quality Scorer
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Scores each LLM response on structural and content quality,
 * feeding the results back into the Knowledge Brain for
 * provider quality trend analysis.
 *
 * Scoring Dimensions:
 *   1. JSON Validity (for json_object responses)
 *   2. Content Density (ratio of useful content to filler)
 *   3. Instruction Compliance (does the response follow the schema?)
 *   4. Latency-Adjusted Score (faster = better at same quality)
 */

const QUALITY_LOG_DIR = path.join(process.cwd(), '.data', 'brain');
const QUALITY_LOG_FILE = path.join(QUALITY_LOG_DIR, 'quality_scores.jsonl');

/**
 * Score a completed LLM response on multiple quality dimensions.
 * @param {Object} completion - The OpenAI-format completion object
 * @param {string} taskType - The task classification
 * @param {Object} opts - Additional context
 * @returns {Object} { overallScore, dimensions, provider, model }
 */
export function scoreResponseQuality(completion, taskType, opts = {}) {
  const content = completion?.choices?.[0]?.message?.content || '';
  const meta = completion?._meta || {};
  const dimensions = {};
  let totalWeight = 0;
  let weightedSum = 0;

  // Dimension 1: Content Presence (weight: 2)
  const contentPresence = content.length > 10 ? 1.0 : content.length > 0 ? 0.5 : 0.0;
  dimensions.contentPresence = contentPresence;
  weightedSum += contentPresence * 2;
  totalWeight += 2;

  // Dimension 2: JSON Validity (weight: 3, only for JSON tasks)
  if (opts.expectJson || opts.response_format?.type === 'json_object') {
    let jsonScore = 0;
    try {
      const parsed = JSON.parse(content);
      jsonScore = 1.0;
      // Bonus: check if the parsed object has expected keys
      if (opts.expectedKeys && Array.isArray(opts.expectedKeys)) {
        const foundKeys = opts.expectedKeys.filter(k => k in parsed).length;
        jsonScore = foundKeys / opts.expectedKeys.length;
      }
    } catch {
      jsonScore = 0.0;
    }
    dimensions.jsonValidity = jsonScore;
    weightedSum += jsonScore * 3;
    totalWeight += 3;
  }

  // Dimension 3: Content Density (weight: 2)
  // Measures ratio of substantive content vs. filler/whitespace
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const fillerWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'that', 'this', 'it'];
  const fillerCount = words.filter(w => fillerWords.includes(w.toLowerCase())).length;
  const densityRatio = words.length > 0 ? 1 - (fillerCount / words.length) : 0;
  dimensions.contentDensity = Math.min(1.0, densityRatio * 1.5); // Scale up since most content has ~15% filler
  weightedSum += dimensions.contentDensity * 2;
  totalWeight += 2;

  // Dimension 4: Latency Score (weight: 1)
  // Under 5s = 1.0, under 15s = 0.7, under 30s = 0.4, over 30s = 0.2
  const latency = meta.latencyMs || opts.latencyMs || 30000;
  const latencyScore = latency < 5000 ? 1.0 : latency < 15000 ? 0.7 : latency < 30000 ? 0.4 : 0.2;
  dimensions.latencyScore = latencyScore;
  weightedSum += latencyScore * 1;
  totalWeight += 1;

  // Dimension 5: Response Size Appropriateness (weight: 1)
  // Too small (< 50 bytes) or too large (> 50KB) = lower quality
  const bytes = meta.responseBytes || Buffer.byteLength(content, 'utf-8');
  let sizeScore = 1.0;
  if (bytes < 50) sizeScore = 0.3;
  else if (bytes > 50000) sizeScore = 0.6;
  dimensions.sizeAppropriate = sizeScore;
  weightedSum += sizeScore * 1;
  totalWeight += 1;

  const overallScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

  const result = {
    timestamp: new Date().toISOString(),
    taskType,
    provider: meta.provider || 'unknown',
    model: meta.model || 'unknown',
    tier: meta.tier || 0,
    overallScore,
    dimensions,
    latencyMs: meta.latencyMs || 0,
    responseBytes: bytes,
  };

  // Persist to JSONL log (fire-and-forget)
  try {
    fs.mkdirSync(QUALITY_LOG_DIR, { recursive: true });
    fs.promises.appendFile(QUALITY_LOG_FILE, JSON.stringify(result) + '\n').catch(() => {});
  } catch { /* non-fatal */ }

  return result;
}

/**
 * Get quality score summary for the last N entries.
 * Useful for the /api/admin/llm-stats dashboard.
 */
export function getQualitySummary(limit = 50) {
  try {
    if (!fs.existsSync(QUALITY_LOG_FILE)) return { avgScore: 0, entries: 0 };
    const lines = fs.readFileSync(QUALITY_LOG_FILE, 'utf-8')
      .split('\n')
      .filter(l => l.trim())
      .slice(-limit);
    const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    if (entries.length === 0) return { avgScore: 0, entries: 0 };

    const avgScore = entries.reduce((s, e) => s + e.overallScore, 0) / entries.length;
    const byProvider = {};
    for (const e of entries) {
      if (!byProvider[e.provider]) byProvider[e.provider] = { sum: 0, count: 0 };
      byProvider[e.provider].sum += e.overallScore;
      byProvider[e.provider].count += 1;
    }
    const providerAvgs = {};
    for (const [p, d] of Object.entries(byProvider)) {
      providerAvgs[p] = Math.round((d.sum / d.count) * 100) / 100;
    }

    return {
      avgScore: Math.round(avgScore * 100) / 100,
      entries: entries.length,
      providerAvgs,
    };
  } catch { return { avgScore: 0, entries: 0 }; }
}
