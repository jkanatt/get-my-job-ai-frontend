/**
 * CrossValidator.js — TF-IDF ↔ AI Cross-Validation Engine
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Get My Job Retrieval Engine v5
 *
 * Compares TF-IDF deterministic rankings with AI LLM rankings
 * and produces a confidence score + divergence report.
 *
 * Uses Kendall's Tau rank correlation coefficient:
 *   τ = (concordant - discordant) / (n * (n-1) / 2)
 *
 * Confidence Levels:
 *   HIGH:   τ > 0.6  — Rankings agree, both systems aligned
 *   MEDIUM: τ > 0.3  — Partial agreement, minor divergences
 *   LOW:    τ ≤ 0.3  — Significant divergence, flagged for review
 *
 * When AI is unavailable, TF-IDF is authoritative (confidence = HIGH_SOLO).
 */

export class CrossValidator {
  constructor(config = {}) {
    this.highThreshold = config.highThreshold ?? 0.6;
    this.mediumThreshold = config.mediumThreshold ?? 0.3;
    this.maxPositionDrift = config.maxPositionDrift ?? 2;
  }

  /**
   * Cross-validate TF-IDF rankings against AI rankings.
   *
   * @param {Array<Object>} tfidfRanked - Projects ranked by TF-IDF (15-signal)
   * @param {Array<Object>} aiRanked - Projects ranked by AI LLM (or null if unavailable)
   * @param {Object} [options]
   * @returns {Object} Validation result
   */
  validate(tfidfRanked, aiRanked, options = {}) {
    const { topK = 4 } = options;

    // If AI is unavailable, TF-IDF is authoritative
    if (!aiRanked || aiRanked.length === 0) {
      return {
        confidence: 'HIGH_SOLO',
        message: 'AI unavailable — TF-IDF is authoritative',
        tau: null,
        finalRanking: tfidfRanked.slice(0, topK),
        divergences: [],
        source: 'tfidf_only',
      };
    }

    // Extract project ID orderings
    const tfidfIds = tfidfRanked.slice(0, topK).map((p) => p.id || p.docId);
    const aiIds = aiRanked.slice(0, topK).map((p) => p.id || p.docId);

    // Compute Kendall's Tau
    const tau = this._kendallTau(tfidfIds, aiIds);

    // Find specific divergences
    const divergences = this._findDivergences(tfidfIds, aiIds);

    // Determine confidence level
    let confidence;
    if (tau >= this.highThreshold) {
      confidence = 'HIGH';
    } else if (tau >= this.mediumThreshold) {
      confidence = 'MEDIUM';
    } else {
      confidence = 'LOW';
    }

    // Decision: ALWAYS use TF-IDF as primary, but log divergences
    const result = {
      confidence,
      tau: Math.round(tau * 1000) / 1000,
      finalRanking: tfidfRanked.slice(0, topK),
      source: confidence === 'HIGH' ? 'tfidf_confirmed_by_ai' : 'tfidf_primary',
      divergences,
      message: this._buildMessage(confidence, tau, divergences),
    };

    // Special case: if AI top-1 differs from TF-IDF top-1 AND tau is very low,
    // add a warning but still use TF-IDF
    if (tfidfIds[0] !== aiIds[0] && tau < this.mediumThreshold) {
      result.warning = `AI ranks "${aiIds[0]}" as #1 but TF-IDF ranks "${tfidfIds[0]}". Using TF-IDF (deterministic).`;
    }

    return result;
  }

  /**
   * Deep validation check — runs multiple heuristic checks beyond Kendall's Tau.
   * This is the "powerful validation check logic" that works without AI.
   *
   * @param {Array<Object>} ranked - The final ranked projects
   * @param {Object} jdIntel - JD intelligence
   * @param {Object} brain - The user's brain
   * @returns {Object} Deep validation result
   */
  deepValidate(ranked, jdIntel, brain) {
    const checks = [];
    const topK = ranked.slice(0, 4);

    // ── Check 1: Domain Coherence ──
    // All top-4 projects should be from the same domain as the JD
    const jdDomain = jdIntel?.domain || '';
    if (jdDomain) {
      const domainIndex = brain?.domain_index || {};
      const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const jdNorm = normalize(jdDomain);

      const domainProjectIds = new Set();
      for (const [key, ids] of Object.entries(domainIndex)) {
        const keyNorm = normalize(key);
        if (keyNorm.includes(jdNorm) || jdNorm.includes(keyNorm)) {
          (ids || []).forEach((id) => domainProjectIds.add(id));
        }
      }

      const otherDomainIds = new Set();
      for (const [key, ids] of Object.entries(domainIndex)) {
        const keyNorm = normalize(key);
        const isMatch = keyNorm.includes(jdNorm) || jdNorm.includes(keyNorm);
        if (!isMatch) {
          (ids || []).forEach((id) => otherDomainIds.add(id));
        }
      }

      const violations = topK.filter(
        (p) => otherDomainIds.has(p.id) && !domainProjectIds.has(p.id)
      );

      checks.push({
        name: 'DOMAIN_COHERENCE',
        pass: violations.length === 0,
        details: violations.length > 0
          ? `${violations.length} cross-domain projects in top 4: ${violations.map((v) => v.id).join(', ')}`
          : 'All top-4 projects are domain-coherent',
        severity: violations.length > 0 ? 'CRITICAL' : 'OK',
      });
    }

    // ── Check 2: Keyword Saturation ──
    // At least 50% of JD must-have keywords should appear across top-4
    const mustHave = jdIntel?.semantic_map?.must_have || jdIntel?.all_keywords?.slice(0, 10) || [];
    if (mustHave.length > 0) {
      const topText = topK.map((p) => [p.name, p.subtitle, ...(p.bullets || [])].join(' ')).join(' ').toLowerCase();
      const covered = mustHave.filter((kw) => topText.includes(kw.toLowerCase()));
      const coverage = covered.length / mustHave.length;

      checks.push({
        name: 'KEYWORD_SATURATION',
        pass: coverage >= 0.4,
        details: `${Math.round(coverage * 100)}% of must-have keywords covered by top-4 projects (${covered.length}/${mustHave.length})`,
        severity: coverage < 0.3 ? 'WARNING' : 'OK',
      });
    }

    // ── Check 3: Impact Distribution ──
    // Top-4 shouldn't all be low-impact projects
    const scores = topK.map((p) => p.combined_score || 0);
    const avgScore = scores.reduce((s, v) => s + v, 0) / (scores.length || 1);
    const maxScore = Math.max(...scores, 0);

    checks.push({
      name: 'IMPACT_DISTRIBUTION',
      pass: maxScore > 5,
      details: `Top-4 avg score: ${avgScore.toFixed(1)}, max: ${maxScore.toFixed(1)}`,
      severity: maxScore <= 2 ? 'WARNING' : 'OK',
    });

    // ── Check 4: Technology Match ──
    // At least one top-4 project should share technology with JD
    const jdKeywords = (jdIntel?.all_keywords || []).map((k) => k.toLowerCase());
    const topTech = topK.flatMap((p) => (p.technologies || []).map((t) => t.toLowerCase()));
    const techOverlap = jdKeywords.filter((k) => topTech.includes(k));

    checks.push({
      name: 'TECHNOLOGY_MATCH',
      pass: techOverlap.length > 0 || topTech.length === 0,
      details: techOverlap.length > 0
        ? `${techOverlap.length} shared technologies: ${techOverlap.slice(0, 5).join(', ')}`
        : 'No direct technology overlap detected (may use implicit matching)',
      severity: techOverlap.length === 0 && topTech.length > 0 ? 'WARNING' : 'OK',
    });

    // ── Check 5: Diversity Check ──
    // Avoid selecting all projects from same subdomain
    const projectDomains = topK.map((p) => (p.domains || []).join(','));
    const uniqueDomains = new Set(projectDomains.filter((d) => d));

    checks.push({
      name: 'DIVERSITY',
      pass: true, // Informational only
      details: `${uniqueDomains.size} unique domain categories across top-4`,
      severity: 'INFO',
    });

    // ── Aggregate Result ──
    const criticalFails = checks.filter((c) => c.severity === 'CRITICAL' && !c.pass);
    const warnings = checks.filter((c) => c.severity === 'WARNING' && !c.pass);

    return {
      pass: criticalFails.length === 0,
      checks,
      summary: {
        total: checks.length,
        passed: checks.filter((c) => c.pass).length,
        critical_failures: criticalFails.length,
        warnings: warnings.length,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Internal Helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Kendall's Tau rank correlation coefficient.
   * Compares two orderings of the same set of items.
   *
   * @param {string[]} ranking1
   * @param {string[]} ranking2
   * @returns {number} τ in [-1, 1]
   */
  _kendallTau(ranking1, ranking2) {
    // Build position maps
    const pos1 = new Map();
    const pos2 = new Map();
    ranking1.forEach((id, i) => pos1.set(id, i));
    ranking2.forEach((id, i) => pos2.set(id, i));

    // Only compare items that appear in BOTH rankings
    const common = ranking1.filter((id) => pos2.has(id));
    const n = common.length;
    if (n < 2) return 0;

    let concordant = 0;
    let discordant = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const r1_i = pos1.get(common[i]);
        const r1_j = pos1.get(common[j]);
        const r2_i = pos2.get(common[i]);
        const r2_j = pos2.get(common[j]);

        if ((r1_i - r1_j) * (r2_i - r2_j) > 0) {
          concordant++;
        } else if ((r1_i - r1_j) * (r2_i - r2_j) < 0) {
          discordant++;
        }
        // ties don't count
      }
    }

    const pairs = (n * (n - 1)) / 2;
    return pairs > 0 ? (concordant - discordant) / pairs : 0;
  }

  /**
   * Find specific position divergences between two rankings.
   */
  _findDivergences(tfidfIds, aiIds) {
    const divergences = [];

    for (let i = 0; i < tfidfIds.length; i++) {
      const aiPos = aiIds.indexOf(tfidfIds[i]);
      if (aiPos === -1) {
        divergences.push({
          project: tfidfIds[i],
          tfidf_position: i + 1,
          ai_position: 'not_in_top_k',
          drift: 'absent',
        });
      } else if (Math.abs(i - aiPos) > this.maxPositionDrift) {
        divergences.push({
          project: tfidfIds[i],
          tfidf_position: i + 1,
          ai_position: aiPos + 1,
          drift: Math.abs(i - aiPos),
        });
      }
    }

    return divergences;
  }

  _buildMessage(confidence, tau, divergences) {
    if (confidence === 'HIGH') {
      return `Rankings strongly correlated (τ=${tau.toFixed(2)}). TF-IDF confirmed by AI.`;
    }
    if (confidence === 'MEDIUM') {
      return `Partial agreement (τ=${tau.toFixed(2)}). ${divergences.length} divergences detected. Using TF-IDF as primary.`;
    }
    return `Significant divergence (τ=${tau.toFixed(2)}). ${divergences.length} position conflicts. Using TF-IDF (deterministic) — review recommended.`;
  }
}
