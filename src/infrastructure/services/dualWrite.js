/**
 * Dual-Write Utility — Supabase + Firebase Admin
 * ════════════════════════════════════════════════════════════════════
 * Eliminates repetitive `if (adminDb) { ... }` blocks scattered across
 * 15+ route files. Provides a single function that writes to both
 * Supabase (primary) and Firebase Firestore (legacy dual-write).
 *
 * Firebase writes are non-blocking and non-fatal — if they fail, the
 * error is logged but the operation succeeds on Supabase alone.
 * ════════════════════════════════════════════════════════════════════
 */

let _adminDb = null;
let _checked = false;

/**
 * Lazily loads Firebase admin DB if not using LocalStack.
 * Caches the result so it's only loaded once.
 */
async function getAdminDb() {
  if (_checked) return _adminDb;
  _checked = true;

  if (process.env.BACKEND_METHOD === 'localstack') {
    return null;
  }

  try {
    const mod = await import('@/infrastructure/_legacy_firebase/admin');
    _adminDb = mod.adminDb;
  } catch (e) {
    console.warn('[dualWrite] Firebase admin not available:', e.message);
  }

  return _adminDb;
}

/**
 * Write a document to Firebase Firestore (set with merge).
 * Non-fatal — logs warnings but never throws.
 *
 * @param {string} collection - Firestore collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Data to write
 * @param {Object} [options] - { merge: true } by default
 */
export async function dualWriteSet(collection, docId, data, options = { merge: true }) {
  const adminDb = await getAdminDb();
  if (!adminDb) return;

  try {
    await adminDb.collection(collection).doc(docId).set(data, options);
  } catch (e) {
    console.warn(`[dualWrite] Firebase set ${collection}/${docId} failed:`, e.message);
  }
}

/**
 * Update a document in Firebase Firestore.
 * Non-fatal — logs warnings but never throws.
 *
 * @param {string} collection - Firestore collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Fields to update
 */
export async function dualWriteUpdate(collection, docId, data) {
  const adminDb = await getAdminDb();
  if (!adminDb) return;

  try {
    await adminDb.collection(collection).doc(docId).update(data);
  } catch (e) {
    console.warn(`[dualWrite] Firebase update ${collection}/${docId} failed:`, e.message);
  }
}

/**
 * Add a document to a Firebase Firestore collection (auto-generated ID).
 * Non-fatal — logs warnings but never throws.
 *
 * @param {string} collection - Firestore collection name
 * @param {Object} data - Data to write
 * @returns {string|null} The generated document ID, or null on failure
 */
export async function dualWriteAdd(collection, data) {
  const adminDb = await getAdminDb();
  if (!adminDb) return null;

  try {
    const ref = await adminDb.collection(collection).add(data);
    return ref.id || null;
  } catch (e) {
    console.warn(`[dualWrite] Firebase add to ${collection} failed:`, e.message);
    return null;
  }
}

/**
 * Read a document from Firebase Firestore.
 * Non-fatal — returns null on failure.
 *
 * @param {string} collection - Firestore collection name
 * @param {string} docId - Document ID
 * @returns {{ exists: boolean, data: Function }|null}
 */
export async function dualWriteGet(collection, docId) {
  const adminDb = await getAdminDb();
  if (!adminDb) return null;

  try {
    return await adminDb.collection(collection).doc(docId).get();
  } catch (e) {
    console.warn(`[dualWrite] Firebase get ${collection}/${docId} failed:`, e.message);
    return null;
  }
}
