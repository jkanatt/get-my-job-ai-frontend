/**
 * Cron Scheduler — Tiered Intelligence Pipeline Execution
 * ═══════════════════════════════════════════════════════════════════════
 * Manages 5 schedule tiers with different frequencies:
 *
 *   Every 30 min: RSS + GDELT (fast, free, high-volume)
 *   Every 2 hours: Job-company linking
 *   Every 6 hours: Full pipeline (RSS + GDELT + SEC EDGAR + NewsAPI + Web)
 *   Every 24 hours: Company website corroboration pass
 *   Weekly: Startup India DPIIT enrichment
 */

import cron from 'node-cron';
import {
  runQuickPipeline,
  runFullPipeline,
  linkCompaniesToJobs,
  runCorroborationPass,
  runDPIITEnrichment,
  getPipelineHealth,
} from './IntelligencePipeline.js';

let scheduledTasks = [];
let lastRunStats = {};

/**
 * Schedule the intelligence pipeline with configurable tiered intervals.
 *
 * @param {object} options
 * @param {string} options.quickInterval - Cron for RSS+GDELT runs (default: every 30 min)
 * @param {string} options.fullInterval - Cron for full pipeline runs (default: every 6 hours)
 * @param {string} options.jobLinkInterval - Cron for company-job linking (default: every 2 hours)
 * @param {string} options.corroborationInterval - Cron for company website checks (default: daily at 3am)
 * @param {string} options.enrichmentInterval - Cron for DPIIT enrichment (default: Sunday 4am)
 */
export function startScheduler(options = {}) {
  const {
    quickInterval = '*/30 * * * *',         // Every 30 minutes
    fullInterval = '0 */6 * * *',            // Every 6 hours
    jobLinkInterval = '0 */2 * * *',         // Every 2 hours
    corroborationInterval = '0 3 * * *',     // Daily at 3:00 AM
    enrichmentInterval = '0 4 * * 0',        // Weekly: Sunday at 4:00 AM
  } = options;

  // Stop any existing schedules
  stopScheduler();

  console.log('[Scheduler] ═══ Intelligence Scheduler Starting ═══');
  console.log('[Scheduler] Tier 1 — Quick pipeline (RSS + GDELT): ', quickInterval);
  console.log('[Scheduler] Tier 2 — Job linking:                  ', jobLinkInterval);
  console.log('[Scheduler] Tier 3 — Full pipeline (all sources):  ', fullInterval);
  console.log('[Scheduler] Tier 4 — Company website corroboration:', corroborationInterval);
  console.log('[Scheduler] Tier 5 — DPIIT enrichment (weekly):    ', enrichmentInterval);

  // ── Tier 1: Quick pipeline — RSS + GDELT (fastest, free) ──────────
  const quickTask = cron.schedule(quickInterval, async () => {
    console.log('[Scheduler] ▸ Tier 1: Running quick pipeline (RSS + GDELT)...');
    try {
      const stats = await runQuickPipeline();
      lastRunStats.quick = { ...stats, tier: 1, lastRun: new Date().toISOString() };
      console.log(`[Scheduler] ✓ Quick: ${stats.rawItemsCollected} items, ${stats.fundingRoundsStored} fundings`);
    } catch (error) {
      console.error('[Scheduler] ✗ Quick pipeline error:', error.message);
      lastRunStats.quick = { error: error.message, lastRun: new Date().toISOString() };
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── Tier 2: Job linking — Connect companies to existing jobs ──────
  const linkTask = cron.schedule(jobLinkInterval, async () => {
    console.log('[Scheduler] ▸ Tier 2: Running job-company linking...');
    try {
      const result = await linkCompaniesToJobs();
      lastRunStats.jobLink = { ...result, tier: 2, lastRun: new Date().toISOString() };
      console.log(`[Scheduler] ✓ Linked ${result.linked} jobs to companies`);
    } catch (error) {
      console.error('[Scheduler] ✗ Job linking error:', error.message);
      lastRunStats.jobLink = { error: error.message, lastRun: new Date().toISOString() };
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── Tier 3: Full pipeline — All sources including SEC EDGAR + NewsAPI ──
  const fullTask = cron.schedule(fullInterval, async () => {
    console.log('[Scheduler] ▸ Tier 3: Running full pipeline (RSS + API + Web + EDGAR + GDELT + NewsAPI)...');
    try {
      const stats = await runFullPipeline();
      lastRunStats.full = { ...stats, tier: 3, lastRun: new Date().toISOString() };
      console.log(`[Scheduler] ✓ Full: ${stats.rawItemsCollected} items, ${stats.fundingRoundsStored} fundings`);
    } catch (error) {
      console.error('[Scheduler] ✗ Full pipeline error:', error.message);
      lastRunStats.full = { error: error.message, lastRun: new Date().toISOString() };
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── Tier 4: Company website corroboration — Upgrades verification ──
  const corroborationTask = cron.schedule(corroborationInterval, async () => {
    console.log('[Scheduler] ▸ Tier 4: Running company website corroboration pass...');
    try {
      const result = await runCorroborationPass();
      lastRunStats.corroboration = { ...result, tier: 4, lastRun: new Date().toISOString() };
      console.log(`[Scheduler] ✓ Corroboration: ${result.corroborated || 0} events upgraded`);
    } catch (error) {
      console.error('[Scheduler] ✗ Corroboration error:', error.message);
      lastRunStats.corroboration = { error: error.message, lastRun: new Date().toISOString() };
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── Tier 5: DPIIT enrichment — Indian company metadata ────────────
  const enrichmentTask = cron.schedule(enrichmentInterval, async () => {
    console.log('[Scheduler] ▸ Tier 5: Running Startup India DPIIT enrichment...');
    try {
      const result = await runDPIITEnrichment();
      lastRunStats.enrichment = { ...result, tier: 5, lastRun: new Date().toISOString() };
      console.log(`[Scheduler] ✓ DPIIT: ${result.enriched} companies enriched`);
    } catch (error) {
      console.error('[Scheduler] ✗ DPIIT enrichment error:', error.message);
      lastRunStats.enrichment = { error: error.message, lastRun: new Date().toISOString() };
    }
  }, { timezone: 'Asia/Kolkata' });

  scheduledTasks = [
    { task: quickTask, name: 'quick-pipeline', tier: 1, interval: quickInterval },
    { task: linkTask, name: 'job-linking', tier: 2, interval: jobLinkInterval },
    { task: fullTask, name: 'full-pipeline', tier: 3, interval: fullInterval },
    { task: corroborationTask, name: 'corroboration', tier: 4, interval: corroborationInterval },
    { task: enrichmentTask, name: 'dpiit-enrichment', tier: 5, interval: enrichmentInterval },
  ];

  console.log(`[Scheduler] ✓ ${scheduledTasks.length} tasks scheduled successfully`);

  return {
    stop: stopScheduler,
    tasks: scheduledTasks.length,
    status: getSchedulerStatus,
  };
}

/**
 * Stop all scheduled tasks.
 */
export function stopScheduler() {
  for (const entry of scheduledTasks) {
    try {
      (entry.task || entry).stop();
    } catch {
      // Ignore errors during stop
    }
  }
  scheduledTasks = [];
  console.log('[Scheduler] All tasks stopped');
}

/**
 * Get comprehensive scheduler status including last run stats and source health.
 */
export function getSchedulerStatus() {
  return {
    running: scheduledTasks.length > 0,
    taskCount: scheduledTasks.length,
    tasks: scheduledTasks.map(entry => ({
      name: entry.name,
      tier: entry.tier,
      interval: entry.interval,
      lastRun: lastRunStats[entry.name.replace('-pipeline', '').replace('-', '')]?.lastRun || null,
    })),
    lastRunStats,
    pipelineHealth: getPipelineHealth(),
  };
}

/**
 * Auto-start scheduler if ENABLE_INTELLIGENCE_SCHEDULER is set.
 * Call this during server startup.
 */
export function autoStartIfEnabled() {
  if (process.env.ENABLE_INTELLIGENCE_SCHEDULER === 'true') {
    console.log('[Scheduler] Auto-starting via ENABLE_INTELLIGENCE_SCHEDULER=true');
    return startScheduler();
  }
  console.log('[Scheduler] Scheduler disabled (set ENABLE_INTELLIGENCE_SCHEDULER=true to enable)');
  return null;
}
