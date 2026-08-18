/**
 * Retry Policy — Exponential Backoff + Circuit Breaker
 * ═══════════════════════════════════════════════════════════════════════
 * Per-source rate limiting and resilience:
 *   - Token bucket rate limiter
 *   - Exponential backoff: 1s → 2s → 4s → 8s → 16s (max 3 retries)
 *   - Circuit breaker: 5 consecutive failures → disable source for 30 min
 *   - Source health tracking
 */

// ─── Circuit Breaker State ─────────────────────────────────────────────

const circuitState = new Map(); // sourceId → { failures, lastFailure, openUntil }

const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Execute a function with retry + circuit breaker protection.
 *
 * @param {string} sourceId - Unique source identifier
 * @param {Function} fn - Async function to execute
 * @param {object} options - Configuration
 * @param {number} options.maxRetries - Max retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @returns {Promise<any>} Result of fn()
 */
export async function withRetry(sourceId, fn, options = {}) {
  const { maxRetries = MAX_RETRIES, baseDelay = BASE_DELAY_MS } = options;

  // Check circuit breaker
  if (isCircuitOpen(sourceId)) {
    const state = circuitState.get(sourceId);
    const remainingMs = state.openUntil - Date.now();
    console.warn(`[RetryPolicy] Circuit OPEN for ${sourceId} — skipping (${Math.round(remainingMs / 1000)}s remaining)`);
    throw new Error(`Circuit breaker open for ${sourceId}`);
  }

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      // Reset circuit breaker on success
      recordSuccess(sourceId);
      return result;
    } catch (err) {
      lastError = err;

      // Don't retry on 4xx errors (except 429 rate limit)
      if (err.response?.status >= 400 && err.response?.status < 500 && err.response?.status !== 429) {
        recordFailure(sourceId);
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
        console.log(`[RetryPolicy] ${sourceId} attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // All retries exhausted
  recordFailure(sourceId);
  throw lastError;
}

/**
 * Check if circuit breaker is open for a source.
 */
function isCircuitOpen(sourceId) {
  const state = circuitState.get(sourceId);
  if (!state) return false;

  if (state.openUntil && Date.now() < state.openUntil) {
    return true; // Still in open state
  }

  // Half-open: circuit was open but cooldown expired, allow one attempt
  if (state.openUntil && Date.now() >= state.openUntil) {
    state.openUntil = null; // Reset to half-open
    state.failures = 0;
  }

  return false;
}

/**
 * Record a successful execution — reset circuit breaker.
 */
function recordSuccess(sourceId) {
  circuitState.set(sourceId, {
    failures: 0,
    lastSuccess: Date.now(),
    lastFailure: null,
    openUntil: null,
  });
}

/**
 * Record a failure — potentially trip the circuit breaker.
 */
function recordFailure(sourceId) {
  const state = circuitState.get(sourceId) || { failures: 0 };
  state.failures = (state.failures || 0) + 1;
  state.lastFailure = Date.now();

  if (state.failures >= FAILURE_THRESHOLD) {
    state.openUntil = Date.now() + OPEN_DURATION_MS;
    console.error(`[RetryPolicy] Circuit TRIPPED for ${sourceId} — disabled for 30 minutes (${state.failures} consecutive failures)`);
  }

  circuitState.set(sourceId, state);
}

/**
 * Get health status for all tracked sources.
 *
 * @returns {object[]} Array of source health records
 */
export function getSourceHealth() {
  const health = [];
  for (const [sourceId, state] of circuitState) {
    health.push({
      sourceId,
      status: isCircuitOpen(sourceId) ? 'OPEN' : state.failures > 0 ? 'DEGRADED' : 'HEALTHY',
      consecutiveFailures: state.failures || 0,
      lastSuccess: state.lastSuccess ? new Date(state.lastSuccess).toISOString() : null,
      lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null,
      circuitOpensAt: state.openUntil ? new Date(state.openUntil).toISOString() : null,
    });
  }
  return health;
}

/**
 * Reset circuit breaker for a specific source (manual override).
 */
export function resetCircuit(sourceId) {
  circuitState.delete(sourceId);
  console.log(`[RetryPolicy] Circuit reset for ${sourceId}`);
}

/**
 * Reset all circuit breakers.
 */
export function resetAllCircuits() {
  circuitState.clear();
  console.log('[RetryPolicy] All circuits reset');
}

// ─── Rate Limiter (Token Bucket) ───────────────────────────────────────

const rateLimitState = new Map(); // sourceId → { tokens, lastRefill, maxTokens, refillRate }

/**
 * Configure rate limiting for a source.
 *
 * @param {string} sourceId - Source identifier
 * @param {number} maxTokens - Max burst capacity
 * @param {number} refillRatePerSecond - Tokens restored per second
 */
export function configureRateLimit(sourceId, maxTokens, refillRatePerSecond) {
  rateLimitState.set(sourceId, {
    tokens: maxTokens,
    lastRefill: Date.now(),
    maxTokens,
    refillRate: refillRatePerSecond,
  });
}

/**
 * Wait for a rate limit token before proceeding.
 *
 * @param {string} sourceId - Source identifier
 * @returns {Promise<void>} Resolves when a token is available
 */
export async function acquireToken(sourceId) {
  const state = rateLimitState.get(sourceId);
  if (!state) return; // No rate limit configured

  // Refill tokens based on elapsed time
  const now = Date.now();
  const elapsed = (now - state.lastRefill) / 1000;
  state.tokens = Math.min(state.maxTokens, state.tokens + elapsed * state.refillRate);
  state.lastRefill = now;

  // Wait if no tokens available
  if (state.tokens < 1) {
    const waitMs = ((1 - state.tokens) / state.refillRate) * 1000;
    await new Promise(r => setTimeout(r, waitMs));
    state.tokens = 0;
  } else {
    state.tokens -= 1;
  }
}
