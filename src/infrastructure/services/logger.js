/**
 * L3: Standardized Logging Utilities
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Provides consistent log formatting across all Get My Job services.
 * 
 * Format: [Get My Job:{SERVICE}] {LEVEL} {message} ({latencyMs}ms)
 * 
 * Usage:
 *   import { createLogger } from '@/infrastructure/services/logger';
 *   const log = createLogger('Agent3B');
 *   log.info('Bullet generation complete', { count: 5, latencyMs: 1200 });
 *   log.warn('Missing keywords', { keywords: ['Python', 'SQL'] });
 *   log.error('LLM timeout', error);
 */

/**
 * Create a scoped logger for a specific service/agent.
 * @param {string} serviceName - The service identifier (e.g., 'GlobalLLM', 'Agent3B', 'Brain')
 * @returns {Object} Logger with info/warn/error/debug methods
 */
export function createLogger(serviceName) {
  const prefix = `[Get My Job:${serviceName}]`;

  return {
    info(message, data = null) {
      const suffix = data ? ` ${_formatData(data)}` : '';
      console.log(`${prefix} ✅ ${message}${suffix}`);
    },

    warn(message, data = null) {
      const suffix = data ? ` ${_formatData(data)}` : '';
      console.warn(`${prefix} ⚠️ ${message}${suffix}`);
    },

    error(message, errorOrData = null) {
      if (errorOrData instanceof Error) {
        console.error(`${prefix} ❌ ${message}: ${errorOrData.message}`);
      } else {
        const suffix = errorOrData ? ` ${_formatData(errorOrData)}` : '';
        console.error(`${prefix} ❌ ${message}${suffix}`);
      }
    },

    debug(message, data = null) {
      if (process.env.NODE_ENV === 'development' || process.env.GETMYJOB_DEBUG === 'true') {
        const suffix = data ? ` ${_formatData(data)}` : '';
        console.log(`${prefix} 🔍 ${message}${suffix}`);
      }
    },

    /**
     * Timed execution — wraps an async function and logs its duration.
     * @param {string} label - What's being timed
     * @param {Function} fn - Async function to execute
     * @returns {Promise<*>} The function's return value
     */
    async timed(label, fn) {
      const start = Date.now();
      try {
        const result = await fn();
        const ms = Date.now() - start;
        console.log(`${prefix} ⏱️ ${label} completed (${ms}ms)`);
        return result;
      } catch (err) {
        const ms = Date.now() - start;
        console.error(`${prefix} ⏱️ ${label} failed after ${ms}ms: ${err.message}`);
        throw err;
      }
    },
  };
}

/**
 * Format data object into a compact log string.
 */
function _formatData(data) {
  if (typeof data === 'string') return data;
  try {
    const entries = Object.entries(data)
      .map(([k, v]) => {
        if (typeof v === 'number') return `${k}=${v}`;
        if (typeof v === 'string') return `${k}="${v.substring(0, 80)}"`;
        if (Array.isArray(v)) return `${k}=[${v.length}]`;
        return `${k}=${JSON.stringify(v).substring(0, 60)}`;
      });
    return `(${entries.join(', ')})`;
  } catch {
    return String(data);
  }
}
