/**
 * Shared MIME Message Builder
 * ════════════════════════════════════════════════════════════════════
 * Builds RFC 2822 compliant MIME messages for the Gmail API.
 * Used by both /api/apply and /api/emails/send routes.
 *
 * SECURITY: Sanitizes all header values to prevent CRLF injection
 * (email header injection attacks).
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * Sanitize a header value by stripping CR/LF characters.
 * Prevents email header injection where an attacker crafts a subject
 * like "Hello\r\nBcc: attacker@evil.com" to inject extra recipients.
 *
 * @param {string} value - Raw header value
 * @returns {string} Sanitized header value
 */
function sanitizeHeader(value) {
  if (!value) return '';
  return String(value).replace(/[\r\n]/g, '');
}

/**
 * Build a MIME message and encode as base64url for the Gmail API.
 *
 * @param {Object} params
 * @param {string} params.from - Sender email
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject (will be CRLF-sanitized)
 * @param {string} params.htmlBody - HTML body content
 * @param {string} [params.inReplyTo] - In-Reply-To header for threading
 * @param {string} [params.references] - References header for threading
 * @param {Array} [params.attachments] - Array of { name, type, content (base64) }
 * @returns {string} Base64url-encoded MIME message
 */
export function buildRawEmail({ from, to, subject, htmlBody, inReplyTo, references, attachments }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const hasAttachments = attachments && attachments.length > 0;

  // Sanitize all header values to prevent CRLF injection
  const safeFrom = sanitizeHeader(from);
  const safeTo = sanitizeHeader(to);
  const safeSubject = sanitizeHeader(subject);

  let message = '';
  message += `From: ${safeFrom}\r\n`;
  message += `To: ${safeTo}\r\n`;
  message += `Subject: ${safeSubject}\r\n`;
  message += `MIME-Version: 1.0\r\n`;

  if (inReplyTo) message += `In-Reply-To: ${sanitizeHeader(inReplyTo)}\r\n`;
  if (references) message += `References: ${sanitizeHeader(references)}\r\n`;

  if (hasAttachments) {
    message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/html; charset="UTF-8"\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += Buffer.from(htmlBody).toString('base64').replace(/(.{76})/g, '$1\r\n');
    message += `\r\n`;

    for (const att of attachments) {
      const content = att.content || '';
      const filename = (att.name || 'attachment').replace(/[\r\n"]/g, '');
      const mimeType = att.type || 'application/octet-stream';

      message += `--${boundary}\r\n`;
      message += `Content-Type: ${mimeType}; name="${filename}"\r\n`;
      message += `Content-Disposition: attachment; filename="${filename}"\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n\r\n`;
      message += content; // Already base64 from client
      message += `\r\n`;
    }
    message += `--${boundary}--\r\n`;
  } else {
    message += `Content-Type: text/html; charset="UTF-8"\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += Buffer.from(htmlBody).toString('base64').replace(/(.{76})/g, '$1\r\n');
  }

  return Buffer.from(message).toString('base64url');
}
