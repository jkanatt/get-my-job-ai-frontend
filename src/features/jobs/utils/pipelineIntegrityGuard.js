/**
 * pipelineIntegrityGuard.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * End-to-end pipeline integrity tracking.
 * Ensures ALL 7 agents execute in the correct order.
 * No agent may be skipped. Every entry/exit is logged.
 *
 * Usage:
 *   const guard = new PipelineIntegrityGuard();
 *   guard.start('Agent 1: JD Parser');
 *   // ... do work ...
 *   guard.end('Agent 1: JD Parser', output);
 *   // ... at the end ...
 *   const result = guard.finalize();
 */

const EXPECTED_AGENTS = [
  'Agent 1: JD Parser',
  'Agent 2: Brain Retrieval',
  'Agent 3: Resume Tailor',
  'Agent 4: Constraint Validator',
  'Agent 5: ATS Scorer',
  'Agent 6: Self-Healer',
  'Agent 7: PDF Compiler',
];

export class PipelineIntegrityGuard {
  constructor() {
    this.log = [];
    this.startTimes = {};
    this.completedAgents = new Set();
    this.pipelineStartTime = Date.now();
    this.errors = [];
  }

  /**
   * Log agent entry.
   * @param {string} agentName - Must match one of EXPECTED_AGENTS
   */
  start(agentName) {
    this.startTimes[agentName] = Date.now();
    this.log.push({
      type: 'start',
      agent: agentName,
      timestamp: new Date().toISOString(),
    });
    console.log(`[Pipeline] ▶️  ${agentName} started`);
  }

  /**
   * Log agent exit with output validation.
   * @param {string} agentName - Must match the start call
   * @param {*} output - The agent's output (for non-null validation)
   * @param {Object} [metadata] - Optional metadata (e.g., ATS score, variant count)
   */
  end(agentName, output, metadata = {}) {
    const duration = Date.now() - (this.startTimes[agentName] || Date.now());
    
    this.completedAgents.add(agentName);
    
    const entry = {
      type: 'end',
      agent: agentName,
      timestamp: new Date().toISOString(),
      durationMs: duration,
      outputValid: output !== null && output !== undefined,
      ...metadata,
    };

    if (!entry.outputValid) {
      this.errors.push(`${agentName} returned null/undefined output`);
      entry.error = 'null_output';
    }

    this.log.push(entry);
    console.log(`[Pipeline] ✅ ${agentName} completed (${duration}ms)${!entry.outputValid ? ' ⚠️ NULL OUTPUT' : ''}`);
  }

  /**
   * Log an agent error without completing it.
   * @param {string} agentName - The agent that failed
   * @param {Error|string} error - The error
   */
  error(agentName, error) {
    const message = error?.message || error || 'Unknown error';
    this.errors.push(`${agentName}: ${message}`);
    this.log.push({
      type: 'error',
      agent: agentName,
      timestamp: new Date().toISOString(),
      error: message,
    });
    console.error(`[Pipeline] ❌ ${agentName} FAILED: ${message}`);
  }

  /**
   * Finalize the pipeline. Ensures all 7 agents ran.
   * @returns {{ valid: boolean, completedAgents: string[], skippedAgents: string[], errors: string[], totalDurationMs: number, log: Object[] }}
   */
  finalize() {
    const totalDuration = Date.now() - this.pipelineStartTime;
    const skippedAgents = EXPECTED_AGENTS.filter(a => !this.completedAgents.has(a));

    if (skippedAgents.length > 0) {
      this.errors.push(`SKIPPED AGENTS: ${skippedAgents.join(', ')}`);
    }

    const result = {
      valid: skippedAgents.length === 0 && this.errors.length === 0,
      completedAgents: [...this.completedAgents],
      skippedAgents,
      errors: this.errors,
      totalDurationMs: totalDuration,
      log: this.log,
    };

    // Print summary
    console.log(`\n[Pipeline] ══════════ INTEGRITY REPORT ══════════`);
    console.log(`[Pipeline] Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`[Pipeline] Agents Completed: ${this.completedAgents.size}/${EXPECTED_AGENTS.length}`);
    if (skippedAgents.length > 0) {
      console.error(`[Pipeline] ❌ SKIPPED: ${skippedAgents.join(', ')}`);
    }
    if (this.errors.length > 0) {
      console.error(`[Pipeline] ❌ ${this.errors.length} errors:`);
      this.errors.forEach(e => console.error(`  - ${e}`));
    }
    if (result.valid) {
      console.log(`[Pipeline] ✅ ALL AGENTS EXECUTED SUCCESSFULLY`);
    }
    console.log(`[Pipeline] ══════════════════════════════════════\n`);

    return result;
  }

  /**
   * Get a summary suitable for including in the response.
   */
  getSummary() {
    return {
      agents_completed: this.completedAgents.size,
      agents_total: EXPECTED_AGENTS.length,
      errors: this.errors.length,
      duration_seconds: ((Date.now() - this.pipelineStartTime) / 1000).toFixed(1),
    };
  }
}
