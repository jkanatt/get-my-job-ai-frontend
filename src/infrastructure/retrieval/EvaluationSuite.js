/**
 * EvaluationSuite.js — Offline Retrieval Quality Evaluation
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Phase 2, Step 5 of the Get My Job Retrieval Engine v4 Blueprint.
 *
 * Computes standard IR metrics:
 *   - Precision@K
 *   - Recall@K
 *   - MRR (Mean Reciprocal Rank)
 *   - NDCG (Normalized Discounted Cumulative Gain)
 *
 * Also enforces negative constraints:
 *   - "must_not_include" ensures domain-mismatched projects never appear
 */

export class EvaluationSuite {
  /**
   * @param {Array<TestCase>} testSuite - Array of test cases
   *
   * TestCase shape:
   * {
   *   name: 'Fintech PM role',
   *   jdText: 'Looking for a PM with UPI experience...',
   *   jdIntel: { role_type: 'pm', domain: 'fintech', ... },
   *   expected_topK: ['paydash_ai', 'wallet_pro', ...],
   *   must_not_include: ['findbreak_easm', 'gaming_platform'],
   *   k: 4
   * }
   */
  constructor(testSuite = []) {
    this.testSuite = testSuite;
  }

  /**
   * Run the full evaluation suite against a retrieval engine.
   *
   * @param {Object} engine - A RetrievalEngine instance (must have .rankProjects())
   * @returns {EvaluationReport}
   */
  evaluate(engine) {
    const results = [];
    const violations = [];

    for (const testCase of this.testSuite) {
      const k = testCase.k || 4;

      // Run retrieval
      const ranked = engine.rankProjects(testCase.jdText, testCase.jdIntel, { topK: k });
      const topKIds = ranked.map((r) => r.id || r.docId);

      // Precision@K
      const hits = topKIds.filter((id) => testCase.expected_topK.includes(id));
      const precision = hits.length / k;

      // Recall@K
      const recall = hits.length / testCase.expected_topK.length;

      // MRR (first relevant result's reciprocal rank)
      const firstHitIdx = topKIds.findIndex((id) => testCase.expected_topK.includes(id));
      const mrr = firstHitIdx >= 0 ? 1 / (firstHitIdx + 1) : 0;

      // NDCG@K
      const ndcg = this._computeNDCG(topKIds, testCase.expected_topK, k);

      // Negative constraint check
      const negativeViolations = [];
      for (const badId of testCase.must_not_include || []) {
        if (topKIds.includes(badId)) {
          negativeViolations.push({
            testCase: testCase.name,
            violatedBy: badId,
            position: topKIds.indexOf(badId) + 1,
          });
        }
      }

      if (negativeViolations.length > 0) {
        violations.push(...negativeViolations);
      }

      results.push({
        name: testCase.name,
        precision,
        recall,
        mrr,
        ndcg,
        topKReturned: topKIds,
        expected: testCase.expected_topK,
        negativeViolations: negativeViolations.length,
      });
    }

    // Aggregate metrics
    const n = results.length || 1;
    const report = {
      testCaseCount: results.length,
      aggregateMetrics: {
        mean_precision_at_k: results.reduce((s, r) => s + r.precision, 0) / n,
        mean_recall_at_k: results.reduce((s, r) => s + r.recall, 0) / n,
        mean_mrr: results.reduce((s, r) => s + r.mrr, 0) / n,
        mean_ndcg: results.reduce((s, r) => s + r.ndcg, 0) / n,
      },
      violations,
      violationCount: violations.length,
      passed: violations.length === 0,
      perTestCase: results,
    };

    return report;
  }

  /**
   * Pretty-print evaluation report to console.
   */
  static printReport(report) {
    console.log('\n' + '═'.repeat(60));
    console.log('  RETRIEVAL ENGINE EVALUATION REPORT');
    console.log('═'.repeat(60));

    console.log(`\n  Test Cases: ${report.testCaseCount}`);
    console.log(`  Status: ${report.passed ? '✅ ALL PASSED' : '❌ VIOLATIONS DETECTED'}`);

    console.log('\n  Aggregate Metrics:');
    console.log(`    Precision@K:  ${(report.aggregateMetrics.mean_precision_at_k * 100).toFixed(1)}%`);
    console.log(`    Recall@K:     ${(report.aggregateMetrics.mean_recall_at_k * 100).toFixed(1)}%`);
    console.log(`    MRR:          ${report.aggregateMetrics.mean_mrr.toFixed(3)}`);
    console.log(`    NDCG:         ${report.aggregateMetrics.mean_ndcg.toFixed(3)}`);

    if (report.violations.length > 0) {
      console.log('\n  ⚠️  NEGATIVE CONSTRAINT VIOLATIONS:');
      for (const v of report.violations) {
        console.log(`    ❌ [${v.testCase}] "${v.violatedBy}" appeared at position ${v.position}`);
      }
    }

    console.log('\n  Per-Test Results:');
    for (const tc of report.perTestCase) {
      const status = tc.negativeViolations === 0 ? '✅' : '❌';
      console.log(`    ${status} ${tc.name} — P: ${(tc.precision * 100).toFixed(0)}% R: ${(tc.recall * 100).toFixed(0)}% MRR: ${tc.mrr.toFixed(2)} → [${tc.topKReturned.join(', ')}]`);
    }

    console.log('\n' + '═'.repeat(60));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Internal
  // ═══════════════════════════════════════════════════════════════════════

  _computeNDCG(rankedIds, relevantIds, k) {
    // DCG
    let dcg = 0;
    for (let i = 0; i < Math.min(rankedIds.length, k); i++) {
      const relevance = relevantIds.includes(rankedIds[i]) ? 1 : 0;
      dcg += relevance / Math.log2(i + 2); // i+2 because log2(1) = 0
    }

    // Ideal DCG (all relevant docs at top)
    let idcg = 0;
    for (let i = 0; i < Math.min(relevantIds.length, k); i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    return idcg > 0 ? dcg / idcg : 0;
  }
}
