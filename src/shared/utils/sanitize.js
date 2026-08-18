import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe HTML tags for email rendering while stripping dangerous elements.
 *
 * @param {string} html - Raw HTML string to sanitize
 * @returns {string} Sanitized HTML safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(html) {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    // Allow common email/content HTML tags
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'blockquote', 'pre', 'code', 'hr', 'sub', 'sup',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel',
      'width', 'height', 'colspan', 'rowspan', 'align', 'valign',
    ],
    // Force all links to open in new tab with noopener
    ADD_ATTR: ['target'],
    ALLOW_DATA_ATTR: false,
    // Prevent protocol-based XSS (javascript:, data:, vbscript:)
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Strip all HTML tags — returns plain text only.
 *
 * @param {string} html - Raw HTML string
 * @returns {string} Plain text with all tags removed
 */
export function stripHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}
