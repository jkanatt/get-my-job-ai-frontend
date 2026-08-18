import { ImapFlow } from 'imapflow';
import mailparser from 'mailparser';
const { simpleParser } = mailparser;

function getConfig(userEmail, appPassword) {
  return {
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: userEmail.replace(/^"|"$/g, ''),
      pass: appPassword.replace(/^"|"$/g, '').replace(/\s+/g, ''),
    },
    logger: false,
  };
}

async function withClient(userEmail, appPassword, fn) {
  const client = new ImapFlow(getConfig(userEmail, appPassword));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/**
 * Fetches lightweight metadata for ALL emails in [Gmail]/All Mail.
 * When sinceDate is provided, only fetches emails after that date (IMAP SINCE search).
 * Falls back to full mailbox fetch when sinceDate is not provided.
 *
 * @param {string} userEmail
 * @param {string} appPassword
 * @param {string} [sinceDate] - ISO date string (e.g., '2025-07-01T00:00:00Z')
 */
export async function fetchAllEmailMetadata(userEmail, appPassword, sinceDate) {
  return withClient(userEmail, appPassword, async (client) => {
    const lock = await client.getMailboxLock('[Gmail]/All Mail');
    try {
      const messages = [];

      // Use SINCE search to only fetch new emails when possible
      let fetchRange = '1:*';
      if (sinceDate) {
        try {
          const searchDate = new Date(sinceDate);
          // IMAP SINCE search returns UIDs of messages after the given date
          const uids = await client.search({ since: searchDate });
          if (uids && uids.length > 0) {
            fetchRange = uids;
          } else {
            // No new emails since the last sync
            return [];
          }
        } catch (searchErr) {
          console.warn('[imap] SINCE search failed, falling back to full fetch:', searchErr.message);
          // Fall through to full fetch
        }
      }

      for await (const msg of client.fetch(fetchRange, { uid: true, emailId: true, threadId: true })) {
        const gmailId = msg.emailId || String(msg.uid);
        const threadId = msg.threadId || gmailId;

        messages.push({
          uid: msg.uid,
          gmail_id: gmailId,
          thread_id: threadId,
        });
      }

      messages.sort((a, b) => b.uid - a.uid);
      return messages;
    } finally {
      lock.release();
    }
  });
}

function collectAttachmentParts(node, acc = []) {
  if (!node) return acc;

  const disposition = node.disposition?.toLowerCase();
  const dispositionFilename = node.dispositionParameters?.filename;
  const paramFilename = node.parameters?.name;
  const filename = dispositionFilename || paramFilename;

  const isAttachment = !!filename || disposition === 'attachment' || disposition === 'inline';

  if (isAttachment && node.part) {
    let cid = node.id ? node.id.replace(/[<>]/g, '') : null;
    acc.push({
      partId: node.part,
      filename: (filename || `attachment-${node.part}`).replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\x00/g, ''),
      contentType: `${node.type}/${node.subtype}`.toLowerCase(),
      size: node.size ?? 0,
      path: '', // No longer using Supabase storage
      cid: cid
    });
  }

  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      collectAttachmentParts(child, acc);
    }
  }

  return acc;
}

/**
 * Determines the email type/folder from Gmail labels.
 * 
 * Gmail can assign MULTIPLE labels to a single email (e.g. both \Sent and \Inbox
 * on a reply within a conversation). We use a priority system:
 *   - If it has \Inbox → it's inbox (even if also \Sent)
 *   - If it has \Sent (and NOT \Inbox) → it's sent
 *   - If it has \Draft → it's draft
 *   - If it has \Trash → it's trash
 *   - Otherwise → archive
 */
function resolveEmailType(labelsSet) {
  const hasInbox = labelsSet.has('\\Inbox');
  const hasSent = labelsSet.has('\\Sent');
  const hasDraft = labelsSet.has('\\Draft');
  const hasTrash = labelsSet.has('\\Trash');

  if (hasTrash) return 'trash';
  if (hasDraft) return 'draft';
  // CRITICAL: Inbox takes priority over Sent because Gmail marks replies in
  // conversations with both labels. The user wants to see these in their inbox.
  if (hasInbox) return 'inbox';
  if (hasSent) return 'sent';
  return 'archive';
}

/**
 * Fetches the full parsed email bodies for a specific list of UIDs.
 * Uses a SINGLE IMAP connection for ALL UIDs to avoid repeated connect/disconnect overhead.
 */
export async function fetchEmailsByUids(userEmail, appPassword, uids) {
  if (!uids || uids.length === 0) return [];

  return withClient(userEmail, appPassword, async (client) => {
    const lock = await client.getMailboxLock('[Gmail]/All Mail');
    try {
      const parsedEmails = [];
      const sequence = uids.join(',');

      for await (const msg of client.fetch(sequence, {
        uid: true,
        emailId: true,
        source: true,
        bodyStructure: true,
        labels: true,
        threadId: true
      }, { uid: true })) {

        const mail = await simpleParser(msg.source);

        const labelsSet = msg.labels || new Set();
        const type = resolveEmailType(labelsSet);
        const isStarred = labelsSet.has('\\Starred') || labelsSet.has('\\Flagged');

        const gmailId = msg.emailId || String(msg.uid);
        const threadId = msg.threadId || gmailId;
        const finalGmailId = gmailId;
        const attachments = collectAttachmentParts(msg.bodyStructure);
        const cleanStr = (s, maxLen = 0) => {
          if (!s) return '';
          let str = String(s).replace(/\x00/g, '');
          if (maxLen > 0 && str.length > maxLen) {
            str = str.substring(0, maxLen);
            if (/[\uD800-\uDBFF]$/.test(str)) str = str.slice(0, -1);
          }
          return typeof str.toWellFormed === 'function' ? str.toWellFormed() : str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
        };

        let bodyHtml = cleanStr(mail.html || mail.textAsHtml || mail.text || '', 100000);

        // Replace inline cid: references with our attachment API URL
        for (const att of attachments) {
          if (att.cid) {
            const partParam = att.partId != null ? encodeURIComponent(att.partId) : 'fallback';
            const attachmentUrl = `/api/attachments?messageId=${encodeURIComponent(finalGmailId)}&partId=${partParam}&filename=${encodeURIComponent(att.filename || '')}`;
            bodyHtml = bodyHtml.replace(new RegExp(`cid:${att.cid}`, 'gi'), attachmentUrl);
          }
        }

        // Extract display names and addresses separately
        const fromName = cleanStr(mail.from?.value[0]?.name || '').trim();
        const fromAddr = cleanStr(mail.from?.value[0]?.address || '').trim();
        const toName = cleanStr(mail.to?.value[0]?.name || '').trim();
        const toAddr = cleanStr(mail.to?.value[0]?.address || '').trim();

        // Format as "Display Name <email>" when name is available for recruiter name parsing
        const formattedFrom = fromName ? `"${fromName}" <${fromAddr}>` : fromAddr;
        const formattedTo = toName ? `"${toName}" <${toAddr}>` : toAddr;

        parsedEmails.push({
          gmail_id: finalGmailId,
          thread_id: threadId || finalGmailId,
          message_id: cleanStr(mail.messageId || finalGmailId),
          subject: cleanStr(mail.subject || 'No Subject', 500),
          from_email: cleanStr(formattedFrom, 500),
          to_email: cleanStr(formattedTo, 500),
          body_html: cleanStr(bodyHtml, 100000),
          preview: cleanStr((mail.text ? mail.text : bodyHtml.replace(/<[^>]*>?/gm, ' ')).replace(/\s+/g, ' ').trim(), 200),
          type,
          is_starred: isStarred,
          created_at: mail.date ? mail.date.toISOString() : new Date().toISOString(),
          metadata: {
            attachments,
            uid: msg.uid,
            from_name: fromName || null,
            to_name: toName || null,
            from_address: fromAddr,
            to_address: toAddr
          }
        });
      }

      return parsedEmails;
    } finally {
      lock.release();
    }
  });
}

/**
 * Fetch ONE attachment's raw decoded bytes as a stream, by exact UID + part id.
 */
export async function getAttachmentStream(userEmail, appPassword, emailUid, partId) {
  return withClient(userEmail, appPassword, async (client) => {
    const lock = await client.getMailboxLock('[Gmail]/All Mail');
    try {
      const { meta, content } = await client.download(String(emailUid), partId, { uid: true });
      const chunks = [];
      for await (const chunk of content) chunks.push(chunk);
      return { buffer: Buffer.concat(chunks), meta };
    } finally {
      lock.release();
    }
  });
}

/**
 * Fetch the latest OTP from the inbox.
 */
export async function fetchLatestOTP(userEmail, timeoutMs = 60000) {
  // Placeholder implementation for fetching OTPs.
  console.log(`[imap-client] Fetching OTP for ${userEmail}...`);
  return "123456";
}
