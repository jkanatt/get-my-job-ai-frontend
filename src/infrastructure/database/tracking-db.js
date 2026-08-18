/**
 * Tracking DB Helper
 * ──────────────────
 * Provides the correct database interface for routes that bypass withAuth
 * and access the database directly (tracking pixel, click tracking, arbiter).
 *
 * Under LocalStack mode → returns DynamoDBFirestoreCompat (mimics Firestore admin API)
 * Under Firebase mode  → returns the real Firestore adminDb (original behavior)
 */

export async function getTrackingDb() {
  if (process.env.BACKEND_METHOD === 'localstack') {
    const { DynamoDBFirestoreCompat } = await import('./dynamodb-adapter.js');
    return new DynamoDBFirestoreCompat();
  }

  // Default: return the real Firestore admin SDK
  const { adminDb } = await import('@/infrastructure/_legacy_firebase/admin');
  return adminDb;
}
