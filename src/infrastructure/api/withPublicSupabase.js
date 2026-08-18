import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Lightweight wrapper for public-read API routes (no auth required).
 * Uses service_role to bypass RLS for read-only intelligence queries.
 * 
 * For write operations (scrape triggers, etc.), use withAuth instead.
 */
export function withPublicSupabase(handler) {
  return async (request, context) => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json(
          { error: 'Database configuration missing' },
          { status: 503 }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const traceId = Math.random().toString(36).substring(7);
      console.log(`[API] ${request.method} ${request.url} [TraceID: ${traceId}]`);
      const startTime = performance.now();

      const response = await handler(request, { ...context, supabase });

      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`[API] Done - ${response?.status} - ${duration}ms [TraceID: ${traceId}]`);

      return response;
    } catch (error) {
      const isDev = process.env.NODE_ENV === 'development';
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          details: isDev ? error.message : 'An unexpected error occurred',
          ...(isDev && { stack: error.stack }),
        },
        { status: 500 }
      );
    }
  };
}
