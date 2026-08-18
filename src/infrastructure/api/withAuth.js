import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy-load Firebase admin — only when NOT using LocalStack
let _adminAuth = null;
let _adminDb = null;
let _firebaseLoaded = false;

async function getFirebaseAdmin() {
  if (_firebaseLoaded) return { adminAuth: _adminAuth, adminDb: _adminDb };
  _firebaseLoaded = true;
  try {
    const mod = await import('@/infrastructure/_legacy_firebase/admin');
    _adminAuth = mod.adminAuth;
    _adminDb = mod.adminDb;
  } catch (e) {
    console.warn('[withAuth] Firebase admin unavailable:', e.message);
  }
  return { adminAuth: _adminAuth, adminDb: _adminDb };
}

/**
 * Higher-order function to protect API routes with Firebase Auth.
 * Automatically injects the authenticated user and Firebase admin db.
 * 
 * @param {Function} handler - The async route handler function
 * @returns {Function} Next.js route handler
 */
export function withAuth(handler) {
  return async (request, context) => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Unauthorized', details: 'Missing or invalid Authorization header' },
          { status: 401 }
        );
      }

      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;

      if (process.env.ALLOW_MOCK_AUTH === 'true' && idToken === 'mock-token') {
        // SECURITY: Never allow mock auth in production
        if (process.env.NODE_ENV === 'production') {
          console.error('[SECURITY] ALLOW_MOCK_AUTH is enabled in production! Ignoring mock token.');
          return NextResponse.json(
            { error: 'Unauthorized', details: 'Mock auth disabled in production' },
            { status: 401 }
          );
        }
        decodedToken = {
          uid: 'HrK78g0hsLSG1lCvkscBMFT7v5z1',
          email: 'localdev@example.com',
          name: 'Local Developer'
        };
      } else {
        try {
          const { adminAuth } = await getFirebaseAdmin();
          if (!adminAuth) {
            return NextResponse.json(
              { error: 'Unauthorized', details: 'Auth service unavailable' },
              { status: 503 }
            );
          }
          decodedToken = await adminAuth.verifyIdToken(idToken);
          
          // ENFORCE EMAIL VERIFICATION
          if (!decodedToken.email_verified) {
            return NextResponse.json(
              { error: 'Forbidden', details: 'Email address must be verified.' },
              { status: 403 }
            );
          }
        } catch (authError) {
          return NextResponse.json(
            { error: 'Unauthorized', details: authError.message },
            { status: 401 }
          );
        }
      }

      // Format user object to match previous expectations where possible
      const user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        ...decodedToken,
      };

      // Inject user and the correct database client based on BACKEND_METHOD
      let supabaseClient;
      let dbClient;

      if (process.env.BACKEND_METHOD === 'localstack') {
        // Method 3: AWS DynamoDB via LocalStack
        const { DynamoDBAdapter, DynamoDBFirestoreCompat } = await import('@/infrastructure/database/dynamodb-adapter');
        supabaseClient = new DynamoDBAdapter();
        dbClient = new DynamoDBFirestoreCompat();
      } else {
        // Method 1 (Supabase) / Method 2 (Firebase) — original behavior
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        supabaseClient = createClient(supabaseUrl, supabaseKey);
        const { adminDb } = await getFirebaseAdmin();
        dbClient = adminDb;
      }

      const traceId = Math.random().toString(36).substring(7);
      console.log(`[API START] ${request.method} ${request.url} [TraceID: ${traceId}]`);
      const startTime = performance.now();

      const response = await handler(request, { ...context, user, supabase: supabaseClient, db: dbClient });

      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`[API END] ${request.method} ${request.url} - Status: ${response?.status} - Duration: ${duration}ms [TraceID: ${traceId}]`);

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
