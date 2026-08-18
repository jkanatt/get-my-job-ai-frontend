/**
 * In-memory rate limiter for API routes.
 * Uses a sliding window counter algorithm.
 * 
 * In production, replace with Redis-backed rate limiting.
 */

const rateLimitMap = new Map();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now - entry.windowStart > entry.windowMs * 2) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Rate limit check for a given identifier.
 * @param {string} identifier - Unique identifier (e.g., IP address, user ID)
 * @param {object} options - Configuration options
 * @param {number} options.maxRequests - Maximum requests per window (default: 60)
 * @param {number} options.windowMs - Window duration in ms (default: 60000 = 1 minute)
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function rateLimit(identifier, { maxRequests = 60, windowMs = 60000 } = {}) {
  const now = Date.now();
  const key = identifier;

  let entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 0, windowStart: now, windowMs };
    rateLimitMap.set(key, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.windowStart + windowMs,
  };
}

/**
 * Extract client identifier from request for rate limiting.
 */
export function getClientId(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'anonymous'
  );
}
