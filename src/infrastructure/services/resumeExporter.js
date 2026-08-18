/**
 * Multi-Format Resume Exporter
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Exports tailored resume data into multiple formats:
 *   1. JSON (structured data)
 *   2. Plain Text (ATS-friendly, copy-paste ready)
 *   3. Markdown (GitHub/portfolio ready)
 *   4. HTML (web-ready with inline styles)
 *   5. DOCX-ready XML (Word-compatible)
 *
 * Usage:
 *   import { exportResume } from '@/infrastructure/services/resumeExporter';
 *   const { text, markdown, html } = exportResume(tailoredData, 'all');
 */

import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// JSON Export (already native, just clean)
// ═══════════════════════════════════════════════════════════════════════════

export function exportToJSON(data) {
  return JSON.stringify(data, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// Plain Text Export (ATS-friendly)
// ═══════════════════════════════════════════════════════════════════════════

export function exportToPlainText(data) {
  const lines = [];
  const profile = data.header || {};

  // Header
  lines.push(profile.name || 'CANDIDATE NAME');
  lines.push('='.repeat(60));
  if (profile.email) lines.push(`Email: ${profile.email}`);
  if (profile.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile.linkedin) lines.push(`LinkedIn: ${profile.linkedin}`);
  if (profile.location) lines.push(`Location: ${profile.location}`);
  lines.push('');

  // Summary
  if (data.summary) {
    lines.push('PROFESSIONAL SUMMARY');
    lines.push('-'.repeat(40));
    const summaryText = typeof data.summary === 'string'
      ? data.summary
      : Object.values(data.summary).join(' ');
    lines.push(cleanLatex(summaryText));
    lines.push('');
  }

  // Skills
  if (data.skills) {
    lines.push('SKILLS');
    lines.push('-'.repeat(40));
    for (const [category, skills] of Object.entries(data.skills)) {
      const skillStr = Array.isArray(skills) ? skills.join(', ') : skills;
      lines.push(`${formatCategoryName(category)}: ${cleanLatex(skillStr)}`);
    }
    lines.push('');
  }

  // Experience
  if (data.experience) {
    lines.push('PROFESSIONAL EXPERIENCE');
    lines.push('-'.repeat(40));
    for (const [, exp] of Object.entries(data.experience)) {
      if (typeof exp !== 'object') continue;
      const title = exp.title || exp.role || '';
      const company = exp.company || '';
      const duration = exp.duration || '';
      lines.push(`${cleanLatex(title)} | ${cleanLatex(company)} | ${duration}`);
      const bullets = exp.bullets || exp.achievements || [];
      if (Array.isArray(bullets)) {
        for (const bullet of bullets) {
          lines.push(`  • ${cleanLatex(bullet)}`);
        }
      } else if (typeof bullets === 'object') {
        for (const b of Object.values(bullets)) {
          if (typeof b === 'string') lines.push(`  • ${cleanLatex(b)}`);
        }
      }
      lines.push('');
    }
  }

  // Projects
  if (data.key_projects) {
    lines.push('KEY PROJECTS');
    lines.push('-'.repeat(40));
    for (const proj of data.key_projects) {
      lines.push(`${cleanLatex(proj.name)} — ${cleanLatex(proj.subtitle || '')}`);
      for (const bullet of (proj.bullets || [])) {
        lines.push(`  • ${cleanLatex(bullet)}`);
      }
      lines.push('');
    }
  }

  // Page 2 skills
  if (data.page2) {
    if (data.page2.other_skills) {
      lines.push('ADDITIONAL SKILLS');
      lines.push('-'.repeat(40));
      lines.push(cleanLatex(Array.isArray(data.page2.other_skills) ? data.page2.other_skills.join(', ') : data.page2.other_skills));
      lines.push('');
    }
    if (data.page2.domain_expertise) {
      lines.push('DOMAIN EXPERTISE');
      lines.push('-'.repeat(40));
      lines.push(cleanLatex(Array.isArray(data.page2.domain_expertise) ? data.page2.domain_expertise.join(', ') : data.page2.domain_expertise));
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Markdown Export
// ═══════════════════════════════════════════════════════════════════════════

export function exportToMarkdown(data) {
  const lines = [];
  const profile = data.header || {};

  lines.push(`# ${profile.name || 'Resume'}`);
  lines.push('');
  const contactParts = [];
  if (profile.email) contactParts.push(`📧 ${profile.email}`);
  if (profile.phone) contactParts.push(`📱 ${profile.phone}`);
  if (profile.linkedin) contactParts.push(`🔗 [LinkedIn](${profile.linkedin})`);
  if (profile.location) contactParts.push(`📍 ${profile.location}`);
  if (contactParts.length) lines.push(contactParts.join(' | '));
  lines.push('');

  // Summary
  if (data.summary) {
    lines.push('## Professional Summary');
    lines.push('');
    const summaryText = typeof data.summary === 'string'
      ? data.summary
      : Object.values(data.summary).join(' ');
    lines.push(cleanLatex(summaryText));
    lines.push('');
  }

  // Skills
  if (data.skills) {
    lines.push('## Skills');
    lines.push('');
    lines.push('| Category | Skills |');
    lines.push('|----------|--------|');
    for (const [category, skills] of Object.entries(data.skills)) {
      const skillStr = Array.isArray(skills) ? skills.join(', ') : skills;
      lines.push(`| **${formatCategoryName(category)}** | ${cleanLatex(skillStr)} |`);
    }
    lines.push('');
  }

  // Experience
  if (data.experience) {
    lines.push('## Experience');
    lines.push('');
    for (const [, exp] of Object.entries(data.experience)) {
      if (typeof exp !== 'object') continue;
      lines.push(`### ${cleanLatex(exp.title || exp.role || '')} — ${cleanLatex(exp.company || '')}`);
      lines.push(`*${exp.duration || ''}*`);
      lines.push('');
      const bullets = exp.bullets || exp.achievements || [];
      if (Array.isArray(bullets)) {
        for (const b of bullets) lines.push(`- ${cleanLatex(b)}`);
      } else if (typeof bullets === 'object') {
        for (const b of Object.values(bullets)) {
          if (typeof b === 'string') lines.push(`- ${cleanLatex(b)}`);
        }
      }
      lines.push('');
    }
  }

  // Projects
  if (data.key_projects) {
    lines.push('## Key Projects');
    lines.push('');
    for (const proj of data.key_projects) {
      lines.push(`### ${cleanLatex(proj.name)}`);
      if (proj.subtitle) lines.push(`*${cleanLatex(proj.subtitle)}*`);
      lines.push('');
      for (const b of (proj.bullets || [])) lines.push(`- ${cleanLatex(b)}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML Export (with inline styles for email/web)
// ═══════════════════════════════════════════════════════════════════════════

export function exportToHTML(data) {
  const profile = data.header || {};
  const bodyStyle = 'font-family: "Inter", "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a2e; line-height: 1.6;';
  const h1Style = 'font-size: 28px; color: #16213e; margin-bottom: 4px; font-weight: 700;';
  const h2Style = 'font-size: 18px; color: #0f3460; border-bottom: 2px solid #e94560; padding-bottom: 4px; margin-top: 24px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;';
  const h3Style = 'font-size: 15px; color: #16213e; margin-bottom: 2px; font-weight: 600;';
  const contactStyle = 'font-size: 13px; color: #666; margin-bottom: 16px;';
  const bulletStyle = 'margin: 3px 0; padding-left: 16px; font-size: 13px;';
  const skillBadge = 'display: inline-block; background: #f0f4ff; color: #0f3460; padding: 2px 8px; border-radius: 4px; margin: 2px; font-size: 12px;';

  let html = `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><title>${profile.name || 'Resume'}</title></head>\n<body style="${bodyStyle}">\n`;
  html += `<h1 style="${h1Style}">${profile.name || 'Candidate'}</h1>\n`;

  const contactParts = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.location) contactParts.push(profile.location);
  html += `<p style="${contactStyle}">${contactParts.join(' • ')}</p>\n`;

  // Summary
  if (data.summary) {
    html += `<h2 style="${h2Style}">Professional Summary</h2>\n`;
    const summaryText = typeof data.summary === 'string' ? data.summary : Object.values(data.summary).join(' ');
    html += `<p style="font-size: 13px;">${cleanLatex(summaryText)}</p>\n`;
  }

  // Skills
  if (data.skills) {
    html += `<h2 style="${h2Style}">Skills</h2>\n`;
    for (const [category, skills] of Object.entries(data.skills)) {
      html += `<p style="margin: 4px 0;"><strong>${formatCategoryName(category)}:</strong> `;
      const skillArr = Array.isArray(skills) ? skills : [skills];
      html += skillArr.map(s => `<span style="${skillBadge}">${cleanLatex(s)}</span>`).join(' ');
      html += `</p>\n`;
    }
  }

  // Experience
  if (data.experience) {
    html += `<h2 style="${h2Style}">Experience</h2>\n`;
    for (const [, exp] of Object.entries(data.experience)) {
      if (typeof exp !== 'object') continue;
      html += `<h3 style="${h3Style}">${cleanLatex(exp.title || exp.role || '')} — ${cleanLatex(exp.company || '')}</h3>\n`;
      html += `<p style="font-size: 12px; color: #888; margin-top: 0;">${exp.duration || ''}</p>\n`;
      html += `<ul style="margin: 4px 0; padding-left: 20px;">\n`;
      const bullets = exp.bullets || exp.achievements || [];
      const bulletArr = Array.isArray(bullets) ? bullets : Object.values(bullets).filter(b => typeof b === 'string');
      for (const b of bulletArr) {
        html += `<li style="${bulletStyle}">${cleanLatex(b)}</li>\n`;
      }
      html += `</ul>\n`;
    }
  }

  // Projects
  if (data.key_projects) {
    html += `<h2 style="${h2Style}">Key Projects</h2>\n`;
    for (const proj of data.key_projects) {
      html += `<h3 style="${h3Style}">${cleanLatex(proj.name)}</h3>\n`;
      if (proj.subtitle) html += `<p style="font-size: 12px; color: #888; margin: 0;">${cleanLatex(proj.subtitle)}</p>\n`;
      html += `<ul style="margin: 4px 0; padding-left: 20px;">\n`;
      for (const b of (proj.bullets || [])) {
        html += `<li style="${bulletStyle}">${cleanLatex(b)}</li>\n`;
      }
      html += `</ul>\n`;
    }
  }

  html += `</body></html>`;
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCX-ready XML Export (Simplified — for Word import)
// ═══════════════════════════════════════════════════════════════════════════

export function exportToDocxXML(data) {
  const profile = data.header || {};
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  xml += `<?mso-application progid="Word.Document"?>\n`;
  xml += `<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">\n`;
  xml += `<w:body>\n`;

  // Name
  xml += `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${escapeXml(profile.name || 'Candidate')}</w:t></w:r></w:p>\n`;

  // Contact
  const contact = [profile.email, profile.phone, profile.location].filter(Boolean).join(' | ');
  xml += `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(contact)}</w:t></w:r></w:p>\n`;

  // Summary
  if (data.summary) {
    xml += addWordHeading('Professional Summary');
    const text = typeof data.summary === 'string' ? data.summary : Object.values(data.summary).join(' ');
    xml += `<w:p><w:r><w:t>${escapeXml(cleanLatex(text))}</w:t></w:r></w:p>\n`;
  }

  // Skills
  if (data.skills) {
    xml += addWordHeading('Skills');
    for (const [cat, skills] of Object.entries(data.skills)) {
      const str = Array.isArray(skills) ? skills.join(', ') : skills;
      xml += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(formatCategoryName(cat))}: </w:t></w:r><w:r><w:t>${escapeXml(cleanLatex(str))}</w:t></w:r></w:p>\n`;
    }
  }

  // Experience
  if (data.experience) {
    xml += addWordHeading('Experience');
    for (const [, exp] of Object.entries(data.experience)) {
      if (typeof exp !== 'object') continue;
      xml += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(cleanLatex(exp.title || exp.role || ''))} — ${escapeXml(cleanLatex(exp.company || ''))}</w:t></w:r></w:p>\n`;
      const bullets = exp.bullets || exp.achievements || [];
      const bulletArr = Array.isArray(bullets) ? bullets : Object.values(bullets).filter(b => typeof b === 'string');
      for (const b of bulletArr) {
        xml += `<w:p><w:pPr><w:listPr><w:ilvl w:val="0"/></w:listPr></w:pPr><w:r><w:t>${escapeXml(cleanLatex(b))}</w:t></w:r></w:p>\n`;
      }
    }
  }

  // Projects
  if (data.key_projects) {
    xml += addWordHeading('Key Projects');
    for (const proj of data.key_projects) {
      xml += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(cleanLatex(proj.name))}</w:t></w:r></w:p>\n`;
      for (const b of (proj.bullets || [])) {
        xml += `<w:p><w:pPr><w:listPr><w:ilvl w:val="0"/></w:listPr></w:pPr><w:r><w:t>${escapeXml(cleanLatex(b))}</w:t></w:r></w:p>\n`;
      }
    }
  }

  xml += `</w:body></w:wordDocument>`;
  return xml;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Export Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Export resume data to the specified format(s)
 * @param {Object} data - Tailored resume data
 * @param {string} format - 'json' | 'text' | 'markdown' | 'html' | 'docx' | 'all'
 * @param {string} [outputDir] - Optional directory to write files
 * @returns {Object} Export results with content strings
 */
export function exportResume(data, format = 'all', outputDir = null) {
  const results = {};

  if (format === 'json' || format === 'all') results.json = exportToJSON(data);
  if (format === 'text' || format === 'all') results.text = exportToPlainText(data);
  if (format === 'markdown' || format === 'all') results.markdown = exportToMarkdown(data);
  if (format === 'html' || format === 'all') results.html = exportToHTML(data);
  if (format === 'docx' || format === 'all') results.docx_xml = exportToDocxXML(data);

  // Write to files if outputDir specified
  if (outputDir) {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const extensions = { json: '.json', text: '.txt', markdown: '.md', html: '.html', docx_xml: '.xml' };
    const company = (data.header?.company || 'tailored').replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];

    for (const [key, content] of Object.entries(results)) {
      const ext = extensions[key] || '.txt';
      const filename = `resume_${company}_${timestamp}${ext}`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, content, 'utf-8');
      results[`${key}_path`] = filepath;
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

function cleanLatex(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\\textbf\{([^}]+)\}/g, '$1')
    .replace(/\\\\/g, '')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\#/g, '#')
    .replace(/\\\$/g, '$')
    .replace(/\{\\bf\s+([^}]+)\}/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

function formatCategoryName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function addWordHeading(text) {
  return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>\n`;
}
