/**
 * Firebase Admin SDK initialization
 *
 * Credential priority order:
 * 1. FIREBASE_SERVICE_ACCOUNT_BASE64 — base64-encoded JSON of service account key
 * 2. FIREBASE_SERVICE_ACCOUNT_JSON   — raw JSON string of service account key
 * 3. FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL — individual env vars
 * 4. Compat Client SDK fallback (limited permissions — only works if Firestore rules allow)
 *
 * HOW TO SET UP (one-time):
 *  Go to Firebase Console → Project Settings → Service Accounts → "Generate new private key"
 *  Download the JSON, then run in Terminal:
 *    base64 -i serviceAccountKey.json | tr -d '\n'
 *  Paste the output as FIREBASE_SERVICE_ACCOUNT_BASE64 in .env.local
 */
import { getApps, getApp, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

function buildCredential() {
  // Option 1: base64-encoded full service account JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(json);
      return cert(serviceAccount);
    } catch (e) {
      console.error('❌ Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
    }
  }

  // Option 2: raw JSON string
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      return cert(serviceAccount);
    } catch (e) {
      console.error('❌ Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
    }
  }

  // Option 3: individual env vars
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    return cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    });
  }

  return null;
}

let app;
let adminDb;
let adminAuth;

if (getApps().length === 0) {
  const credential = buildCredential();

  if (credential) {
    try {
      app = initializeApp({
        credential,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      console.log('✅ Firebase Admin: Initialized with service account credentials.');
    } catch (e) {
      console.error('❌ Firebase Admin: Failed to initialize with credentials:', e.message);
      app = null;
    }
  }

  if (!app) {
    console.warn(
      '⚠️  Firebase Admin: No service account credentials found.\n' +
      '   Backend API routes will fail with "permission-denied".\n' +
      '   FIX: Go to Firebase Console → Project Settings → Service Accounts\n' +
      '        → Generate new private key → download JSON, then run:\n' +
      '          base64 -i ~/Downloads/<filename>.json | tr -d "\\n"\n' +
      '        Paste the output as FIREBASE_SERVICE_ACCOUNT_BASE64 in .env.local'
    );
    app = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
} else {
  app = getApp();
}

try {
  adminDb = getFirestore(app);
} catch (e) {
  console.error('❌ Firebase Admin: Could not get Firestore:', e.message);
  adminDb = null;
}

try {
  adminAuth = getAuth(app);
} catch (e) {
  console.error('❌ Firebase Admin: Could not get Auth:', e.message);
  adminAuth = null;
}

export { app as admin, adminDb, adminAuth };
