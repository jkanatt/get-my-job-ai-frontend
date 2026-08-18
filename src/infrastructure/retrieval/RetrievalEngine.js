/**
 * RetrievalEngine.js — Unified Public API v5
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Get My Job Retrieval Engine v5 — 15-Signal Deterministic Ranking
 *
 * This is the single entry point for all retrieval operations.
 * It orchestrates:
 *   1. InvertedIndex (persistent BM25/TF-IDF)
 *   2. NGramTokenizer (structural tokenization)
 *   3. QueryParser (fuzzy matching, expansion)
 *   4. MultiSignalRanker v5 (15-signal composite scoring)
 *   5. CrossValidator (TF-IDF ↔ AI cross-validation)
 *
 * Key v5 upgrades:
 *   - Inherent Impact Score: uses project array index as user's own ranking
 *   - Domain Exclusion Gate: 95% penalty for cross-domain projects
 *   - 15 scoring signals vs 7 in v4
 *   - CrossValidator for parallel AI validation
 */

import { InvertedIndex } from './InvertedIndex.js';
import { tokenize, tokenizeDocument, tokenizeQuery } from './NGramTokenizer.js';
import { MultiSignalRanker } from './MultiSignalRanker.js';
import { QueryParser } from './QueryParser.js';
import { CrossValidator } from './CrossValidator.js';

export class RetrievalEngine {
  /**
   * @param {Object} config
   * @param {Object} config.brain - The user's Obsidian Brain (projects, experience, etc.)
   * @param {Object} [config.rlhfWeights] - Historical RLHF weights for projects/keywords
   * @param {boolean} [config.debug=false] - Enable explainability traces
   */
  constructor(config = {}) {
    this.brain = config.brain || {};
    this.rlhfWeights = config.rlhfWeights || null;
    this.debug = config.debug ?? false;

    // Initialize sub-engines
    this.index = new InvertedIndex({
      bm25_k1: 1.2,
      bm25_b: 0.75,
    });
    this.ranker = new MultiSignalRanker({
      freshnessHalfLifeDays: 180,
      domainBoostFactor: 3.0,
      minScoreThreshold: 0.0,
      domainMismatchPenalty: 0.05, // 95% penalty for cross-domain
    });
    this.queryParser = new QueryParser({
      maxFuzzyDistance: 2,
      expandSynonyms: true,
      expandAcronyms: true,
    });
    this.crossValidator = new CrossValidator({
      highThreshold: 0.6,
      mediumThreshold: 0.3,
      maxPositionDrift: 2,
    });

    // Pre-computed impact scores (index-based)
    this._impactMap = new Map();

    // Trace storage
    this._lastTrace = null;
    this._lastValidation = null;

    // Auto-index the brain if provided
    if (this.brain.projects || this.brain.experience_detailed) {
      this._indexBrain();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Rank all projects against a Job Description.
   * This is the primary retrieval method used by the ATS pipeline.
   *
   * @param {string} jdText - Raw JD text
   * @param {Object} jdIntel - Structured JD intelligence
   * @param {Object} [options]
   * @param {number} [options.topK=50]
   * @returns {Array<Object>} Ranked projects with combined_score
   */
  rankProjects(jdText, jdIntel, options = {}) {
    const { topK = 50 } = options;
    const startTime = Date.now();

    // Step 1: Parse the query
    const parsedQuery = this.queryParser.parse(jdText, jdIntel);

    // Step 2: Retrieve candidates from the inverted index
    const indexResults = this.index.search(parsedQuery.tokens, {
      scorer: 'bm25',
      topK: Math.min(topK * 2, 100),
    });

    // Step 3: Enrich candidates with full project data (filter out experience docs)
    const candidates = indexResults
      .filter((r) => !r.docId.startsWith('exp_'))
      .map((r) => ({
        docId: r.docId,
        l1Score: r.score,
        termScores: r.termScores,
        doc: this._getProjectById(r.docId),
        meta: r.meta,
        inherentImpact: this._impactMap.get(r.docId) ?? 50,
      }))
      .filter((c) => c.doc !== null);

    // Also include projects that weren't in the index results
    const indexedIds = new Set(candidates.map((c) => c.docId));
    const projects = this.brain.projects || [];
    for (const project of projects) {
      if (!indexedIds.has(project.id)) {
        candidates.push({
          docId: project.id,
          l1Score: 0,
          termScores: {},
          doc: project,
          meta: null,
          inherentImpact: this._impactMap.get(project.id) ?? 50,
        });
      }
    }

    // Step 4: 15-signal reranking (with domain index passed to ranker)
    const ranked = this.ranker.rank(
      candidates,
      {
        roleType: parsedQuery.metadata.roleType || jdIntel?.role_type,
        domain: parsedQuery.metadata.domain || jdIntel?.domain,
        jdText,
        rlhfWeights: this.rlhfWeights,
        domainIndex: this.brain.domain_index || {},
        projects: this.brain.projects || [],
      },
      { topK, debug: this.debug }
    );

    // Sort by composite score
    ranked.sort((a, b) => b.combined_score - a.combined_score);

    // Store trace
    const elapsed = Date.now() - startTime;
    this._lastTrace = {
      query_type: 'rankProjects',
      engine_version: 'v5',
      signals: 15,
      jd_summary: {
        role: parsedQuery.metadata.roleType,
        domain: parsedQuery.metadata.domain,
        token_count: parsedQuery.tokens.length,
        expansion_count: parsedQuery.metadata.expansionCount,
      },
      candidates_evaluated: candidates.length,
      results_returned: ranked.length,
      latency_ms: elapsed,
      ranking_trace: this.debug ? ranked.slice(0, 10) : undefined,
    };

    // Return with full project data attached
    return ranked.slice(0, topK)
      .map((r) => ({
        ...(r.doc || {}),
        combined_score: r.combined_score,
        _breakdown: r.breakdown,
      }))
      .filter((r) => r.id);
  }

  /**
   * Rank projects with AI cross-validation.
   * TF-IDF ranks first, AI validates in parallel, results are cross-checked.
   *
   * @param {string} jdText
   * @param {Object} jdIntel
   * @param {Array<Object>|null} aiRanked - AI rankings (or null if unavailable)
   * @param {Object} [options]
   * @returns {Object} { projects, validation }
   */
  rankWithValidation(jdText, jdIntel, aiRanked, options = {}) {
    const { topK = 4 } = options;

    // Step 1: TF-IDF ranking (primary — always runs)
    const tfidfRanked = this.rankProjects(jdText, jdIntel, { topK });

    // Step 2: Cross-validate with AI (if available)
    const validation = this.crossValidator.validate(tfidfRanked, aiRanked, { topK });

    // Step 3: Deep validation (zero-AI heuristic checks)
    const deepCheck = this.crossValidator.deepValidate(
      validation.finalRanking, jdIntel, this.brain
    );

    this._lastValidation = { ...validation, deepCheck };

    return {
      projects: validation.finalRanking,
      validation: {
        confidence: validation.confidence,
        tau: validation.tau,
        source: validation.source,
        message: validation.message,
        warning: validation.warning,
        divergences: validation.divergences,
        deepCheck,
      },
    };
  }

  /**
   * Rank experience entries against a JD.
   */
  rankExperience(jdText, jdIntel, options = {}) {
    const { topK = 10 } = options;

    const parsedQuery = this.queryParser.parse(jdText, jdIntel);

    const experience = this.brain.experience_detailed || [];
    const candidates = experience.map((exp) => {
      const expText = [
        exp.role || '',
        exp.company || '',
        exp.description || '',
        ...(exp.achievements || []),
        ...(exp.tags || []),
      ].join(' ');

      const tokens = tokenize(expText, { stem: true });
      let l1Score = 0;
      for (const qt of parsedQuery.tokens) {
        if (tokens.includes(qt)) l1Score += 1;
      }

      return {
        docId: `exp_${(exp.company || '').toLowerCase().replace(/\s+/g, '_')}`,
        l1Score,
        termScores: {},
        doc: exp,
        meta: null,
        inherentImpact: 50, // Experience doesn't use impact ranking
      };
    });

    return this.ranker.rank(
      candidates,
      {
        roleType: parsedQuery.metadata.roleType || jdIntel?.role_type,
        domain: parsedQuery.metadata.domain || jdIntel?.domain,
        jdText,
        rlhfWeights: this.rlhfWeights,
        domainIndex: this.brain.domain_index || {},
      },
      { topK, debug: this.debug }
    );
  }

  /**
   * Free-text search across the entire brain.
   */
  search(query, options = {}) {
    const { topK = 10 } = options;
    const queryTokens = tokenizeQuery(query);
    return this.index.search(queryTokens, { scorer: 'bm25', topK });
  }

  /**
   * Get the last retrieval trace for debugging/explainability.
   */
  getTrace() {
    return this._lastTrace;
  }

  /**
   * Get the last cross-validation result.
   */
  getLastValidation() {
    return this._lastValidation;
  }

  /**
   * Get index statistics.
   */
  getStats() {
    return this.index.getStats();
  }

  /**
   * Rebuild the index from scratch (e.g., after brain update).
   */
  rebuildIndex() {
    this.index = new InvertedIndex({ bm25_k1: 1.2, bm25_b: 0.75 });
    this._impactMap.clear();
    this._indexBrain();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Internal: Brain Indexing
  // ═══════════════════════════════════════════════════════════════════════

  _indexBrain() {
    const projects = this.brain.projects || [];
    const experience = this.brain.experience_detailed || [];
    const totalProjects = projects.length;
    // ── Compute Inherent Impact Scores (S1) ──
    // PRIMARY: Uses Document 2 evaluation_score (curated 0–100 quality assessment).
    // FALLBACK: Exponential decay by array index for projects missing evaluation_score.
    for (let i = 0; i < totalProjects; i++) {
      const project = projects[i];
      // Fallback ID if missing
      if (!project.id) {
        project.id = project.name ? project.name.toLowerCase().replace(/\s+/g, '_') : `proj_${i}`;
      }

      let impactScore;
      if (typeof project.evaluation_score === 'number' && project.evaluation_score > 0) {
        // Document 2 curated score — authoritative source of truth
        impactScore = project.evaluation_score;
      } else {
        // Fallback: Exponential decay by position
        const lambda = totalProjects > 1 ? Math.log(100) / (totalProjects - 1) : 0;
        impactScore = totalProjects > 1 ? 100 * Math.exp(-lambda * i) : 100;
      }

      this._impactMap.set(project.id, Math.round(impactScore * 100) / 100);
    }

    // Index each project with field-level tokenization
    for (const project of projects) {
      const fieldTokens = tokenizeDocument(project, { stem: true });
      this.index.addDocumentWithFields(project.id, fieldTokens, {
        type: 'project',
        name: project.name,
        domains: project.domains || [],
      });
    }

    // Index each experience entry
    for (const exp of experience) {
      const expId = `exp_${(exp.company || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const fieldTokens = {
        title: tokenize(exp.role || '', { stem: false }),
        subtitle: tokenize(exp.company || '', { stem: false }),
        bullets: tokenize((exp.achievements || []).join(' '), { stem: true }),
        tags: (exp.tags || []).map((t) => t.toLowerCase()),
      };
      this.index.addDocumentWithFields(expId, fieldTokens, {
        type: 'experience',
        company: exp.company,
        role: exp.role,
      });
    }

    if (this.debug) {
      const stats = this.index.getStats();
      console.log(`[RetrievalEngine v5] Indexed ${stats.documentCount} documents, ${stats.uniqueTerms} unique terms, ~${stats.memoryEstimateKB}KB`);
      console.log(`[RetrievalEngine v5] Impact scores: ${this._impactMap.size} projects computed`);
    }
  }

  _getProjectById(projectId) {
    return (this.brain.projects || []).find((p) => p.id === projectId) || null;
  }
}
