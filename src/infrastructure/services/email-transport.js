/**
 * Dual-Mode Email Transport
 * 
 * Provides a unified sendEmail() interface that works in both environments:
 * 
 *   1. PRODUCTION (Gmail API) — Uses OAuth2 tokens via getGoogleAuth/getGmailClient.
 *      This is the original path and remains completely untouched.
 * 
 *   2. LOCAL DEV (Nodemailer SMTP) — Uses Gmail SMTP with an App Password.
 *      No OAuth, no Firestore token lookup. Sends real emails to real inboxes.
 *      Activated automatically when Gmail API auth fails (GOOGLE_NOT_CONNECTED,
 *      RESOURCE_EXHAUSTED, or any auth error).
 * 
 * HOW TO SET UP LOCAL SMTP:
 *   1. Enable 2-Step Verification on your Google Account
 *   2. Go to https://myaccount.google.com/apppasswords
 *   3. Generate a new App Password for "Mail"
 *   4. Add to .env.local:
 *        GMAIL_USER=your-email@gmail.com
 *        GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
 */
import nodemailer from 'nodemailer';

// ─── SMTP Transport (Local Dev) ─────────────────────────────────────────────

let _smtpTransport = null;

/**
 * Creates or returns a cached Nodemailer SMTP transport.
 * Uses Gmail App Password if configured, otherwise falls back to a free Ethereal Email test account.
 */
async function getSmtpTransport() {
  if (_smtpTransport) return _smtpTransport;

  // SECURITY FIX: Credentials MUST come from environment variables only.
  // Never hardcode passwords in source code.
  const finalUser = (process.env.GMAIL_USER || '').replace(/^"|"$/g, '').trim();
  const finalPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/^"|"$/g, '').replace(/\s+/g, '').trim();

  if (finalUser && finalPass && finalPass.length >= 16) {
    _smtpTransport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: finalUser, pass: finalPass },
      pool: true,
    });

    try {
      await _smtpTransport.verify();
      console.log(`✅ SMTP Transport: Ready (Gmail: ${finalUser})`);
      return _smtpTransport;
    } catch (e) {
      console.warn(`⚠️  SMTP Transport: Gmail credentials failed (${e.message}). Falling back to Ethereal Email.`);
      _smtpTransport = null; // Clear bad transport
    }
  } else {
    console.warn('⚠️  SMTP Transport: GMAIL_USER or GMAIL_APP_PASSWORD not set. Set them in .env.local');
  }

  // Fallback: Ethereal Email for local testing (No config required!)
  if (!_smtpTransport) {
    console.log('⚠️  SMTP Transport: Using Ethereal Email (Local Mock SMTP) as fallback.');
    const testAccount = await nodemailer.createTestAccount();

    _smtpTransport = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log(`✅ SMTP Transport: Ethereal Email Ready (Mock SMTP)`);
  }

  return _smtpTransport;
}

/**
 * Send an email via SMTP (Nodemailer).
 */
export async function sendViaSMTP({ from, to, subject, htmlBody, inReplyTo, references, attachments }) {
  const transport = await getSmtpTransport();

  const mailOptions = {
    from: from || process.env.GMAIL_USER || '"Get My Job Local" <test@ethereal.email>',
    to,
    subject,
    html: htmlBody,
  };

  if (inReplyTo) mailOptions.inReplyTo = inReplyTo;
  if (references) mailOptions.references = references;

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments.map(att => ({
      filename: att.name || 'attachment',
      content: att.content,
      encoding: 'base64',
      contentType: att.type || 'application/octet-stream',
    }));
  }

  const info = await transport.sendMail(mailOptions);

  console.log(`✅ SMTP: Email sent to ${to} (messageId: ${info.messageId})`);

  // If using Ethereal, print the preview URL so the developer can see the sent email!
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`👀 Preview Email: ${previewUrl}`);
  }

  return {
    messageId: info.messageId || `smtp-${Date.now()}`,
    threadId: info.messageId || `smtp-thread-${Date.now()}`,
    previewUrl,
  };
}

// ─── Gmail API Transport (Production) ───────────────────────────────────────

/**
 * Send an email via Gmail API (existing production path).
 * This function wraps the existing gmail.users.messages.send call.
 * 
 * @param {Object} gmail - Authenticated Gmail API client from getGmailClient()
 * @param {string} raw - Base64url-encoded MIME message from buildRawEmail()
 * @param {string} [threadId] - Gmail thread ID for threading
 * @returns {Promise<{ messageId: string, threadId: string }>}
 */
export async function sendViaGmailAPI(gmail, raw, threadId) {
  const sendRes = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId: threadId || undefined },
  });

  return {
    messageId: sendRes.data.id,
    threadId: sendRes.data.threadId,
  };
}

/**
 * Returns true if SMTP transport is available.
 * Since we implemented Ethereal auto-fallback, SMTP is ALWAYS available.
 */
export function isSmtpAvailable() {
  return true; // Auto-fallback guarantees SMTP works locally
}

/**
 * Get the configured SMTP sender email.
 */
export function getSmtpSenderEmail() {
  return process.env.GMAIL_USER || null;
}

/**
 * Reset the cached SMTP transport.
 * Call this when credentials change (e.g., new App Password) to force re-creation.
 */
export function resetSmtpTransport() {
  if (_smtpTransport) {
    try { _smtpTransport.close(); } catch (e) { /* ignore */ }
  }
  _smtpTransport = null;
  console.log('🔄 SMTP Transport: Cache cleared. Next send will re-initialize.');
}

// ─── IMAP Transport (Local Dev - Drafts) ────────────────────────────────────

/**
 * Save an email as a draft via IMAP.
 */
export async function saveDraftViaIMAP({ from, to, subject, htmlBody, attachments }) {
  const { ImapFlow } = await import('imapflow');
  const MailComposer = (await import('nodemailer/lib/mail-composer/index.js')).default;

  const mailOptions = {
    from: from || process.env.GMAIL_USER || '"Get My Job Local" <test@ethereal.email>',
    to,
    subject,
    html: htmlBody,
  };

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments.map(att => ({
      filename: att.name || 'attachment',
      content: att.content,
      encoding: 'base64',
      contentType: att.type || 'application/octet-stream',
    }));
  }

  const mail = new MailComposer(mailOptions);
  const messageBuffer = await mail.compile().build();

  const finalUser = (process.env.GMAIL_USER || '').replace(/^"|"$/g, '').trim();
  const finalPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/^"|"$/g, '').replace(/\s+/g, '').trim();

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: finalUser, pass: finalPass },
    logger: false
  });

  await client.connect();
  await client.append('[Gmail]/Drafts', messageBuffer, ['\\Draft']);
  await client.logout();
  console.log(`✅ IMAP: Email saved to Drafts folder for ${to}`);
}
