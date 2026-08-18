import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

let redis = null;
let aiRateLimit = null;
let standardRateLimit = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // 10 AI requests per minute
    aiRateLimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/ai',
    });

    // 100 requests per minute for standard APIs
    standardRateLimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/standard',
    });
  }
} catch (e) {
  console.warn('[RateLimiter] Upstash Redis not configured or failed to initialize:', e.message);
}

/**
 * Validates the rate limit for a given user ID or IP address.
 * @param {string} identifier - e.g., user.id or request IP
 * @param {string} type - 'ai' | 'standard'
 */
export async function checkRateLimit(identifier = 'anonymous', type = 'standard') {
  if (!redis) {
    // If Redis isn't configured, bypass rate limiting
    return { success: true };
  }

  const limiter = type === 'ai' ? aiRateLimit : standardRateLimit;
  if (!limiter) return { success: true };

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    return { success, limit, remaining, reset };
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);
    return { success: true }; // Fail open
  }
}

/**
 * Helper to generate a 429 response if limit is exceeded.
 */
export function rateLimitExceededResponse() {
  return NextResponse.json(
    { error: 'Too Many Requests', details: 'You have exceeded the rate limit. Please try again later.' },
    { status: 429 }
  );
}
