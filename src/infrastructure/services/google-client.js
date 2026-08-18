/**
 * Unified Google API Client Factory
 * 
 * Single source of truth for creating authenticated Google API clients.
 * Handles token refresh, caching, and scope validation.
 * 
 * Usage:
 *   import { getGoogleAuth, getGmailClient, getCalendarClient, getPeopleClient } from '@/infrastructure/services/google-client';
 *   
 *   const auth = await getGoogleAuth(supabase, userId);
 *   const gmail = getGmailClient(auth);
 *   await gmail.users.messages.list({ userId: 'me' });
 */
import { google } from 'googleapis';

/**
 * Creates an authenticated OAuth2 client for a given user.
 * Reads refresh token from user_settings, handles automatic token refresh,
 * and persists new access tokens back to the database.
 * 
 * @param {Object} supabase - Authenticated Supabase client (with RLS context)
 * @param {string} userId - The user's UUID
 * @returns {google.auth.OAuth2} Configured OAuth2 client
 * @throws {Error} If Google account is not connected
 */
export async function getGoogleAuth(supabase, userId) {
  let settings = null;

  // Strategy 1 (fastest): Direct doc lookup by UID.
  // The OAuth callback stores settings in a doc keyed by UID directly.
  if (supabase.db) {
    try {
      const docSnap = await supabase.db.collection('user_settings').doc(userId).get();
      if (docSnap.exists) {
        const docData = docSnap.data();
        if (docData?.google_refresh_token) {
          settings = docData;
        }
      }
    } catch (e) {
      console.warn('getGoogleAuth: Direct doc lookup failed, trying query...', e.message);
    }
  }

  // Strategy 2 (fallback): Query by user_id field.
  if (!settings?.google_refresh_token) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('google_refresh_token, google_access_token, google_token_expires_at, google_email')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data?.google_refresh_token) {
        settings = data;
      }
    } catch (e) {
      console.warn('getGoogleAuth: Query-based lookup failed:', e.message);
    }
  }

  if (!settings?.google_refresh_token) {
    const err = new Error('Google account not connected. Please connect your Google account in Integrations.');
    err.code = 'GOOGLE_NOT_CONNECTED';
    throw err;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: settings.google_refresh_token,
    access_token: settings.google_access_token || undefined,
    expiry_date: settings.google_token_expires_at
      ? new Date(settings.google_token_expires_at).getTime()
      : 0,
  });

  // Listen for automatic token refresh events and persist new tokens
  oauth2Client.on('tokens', async (tokens) => {
    const updates = {};
    if (tokens.access_token) updates.google_access_token = tokens.access_token;
    if (tokens.expiry_date) updates.google_token_expires_at = new Date(tokens.expiry_date).toISOString();
    // Google rarely re-issues refresh tokens, but if it does, save it
    if (tokens.refresh_token) updates.google_refresh_token = tokens.refresh_token;

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', userId);
    }
  });

  return oauth2Client;
}

/**
 * Convenience: Get a Gmail API client for a user.
 */
export function getGmailClient(auth) {
  return google.gmail({ version: 'v1', auth });
}

/**
 * Convenience: Get a Calendar API client for a user.
 */
export function getCalendarClient(auth) {
  return google.calendar({ version: 'v3', auth });
}

/**
 * Convenience: Get a People (Contacts) API client for a user.
 */
export function getPeopleClient(auth) {
  return google.people({ version: 'v1', auth });
}

/**
 * Check if user has Google connected. Returns { connected, email } without throwing.
 */
export async function checkGoogleConnection(supabase, userId) {
  const { data: settings } = await supabase
    .from('user_settings')
    .select('google_refresh_token, google_email, google_connected_at, google_scopes')
    .eq('user_id', userId)
    .single();

  return {
    connected: !!settings?.google_refresh_token,
    email: settings?.google_email || null,
    connectedAt: settings?.google_connected_at || null,
    scopes: settings?.google_scopes || [],
  };
}

/**
 * Revoke Google tokens for a user and clear them from the database.
 */
export async function revokeGoogleTokens(supabase, userId) {
  const { data: settings } = await supabase
    .from('user_settings')
    .select('google_refresh_token, google_access_token')
    .eq('user_id', userId)
    .single();

  if (settings?.google_refresh_token) {
    try {
      // Revoke the token at Google's endpoint
      await fetch(`https://oauth2.googleapis.com/revoke?token=${settings.google_refresh_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (e) {
      console.warn('Google token revocation failed (may already be revoked):', e.message);
    }
  }

  // Clear all Google-related fields
  await supabase
    .from('user_settings')
    .update({
      google_refresh_token: null,
      google_access_token: null,
      google_token_expires_at: null,
      google_email: null,
      google_scopes: null,
      google_connected_at: null,
      google_profile_picture: null,
      sync_enabled: false,
    })
    .eq('user_id', userId);
}

/**
 * The standard set of Google OAuth scopes requested at login (Option A — Upfront).
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts.readonly',
];

/**
 * Create a raw RFC 2822 email message for Gmail API.
 * Returns a base64url-encoded string.
 */
export function createRawEmail({ from, to, subject, htmlBody }) {
  const boundary = `boundary_${Date.now()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(htmlBody).toString('base64'),
    ``,
    `--${boundary}--`,
  ];
  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
}
