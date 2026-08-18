/**
 * generateLatex(resumeData)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Get My Job V3 — Strict Template Injection Engine
 * Surgically injects tailored content into the immutable master_resume_template.tex
 */
import fs from 'fs';
import path from 'path';

export function generateLatex(data) {
  const templatePath = path.join(process.cwd(), 'master_resume_template.tex');
  let tex = fs.readFileSync(templatePath, 'utf8');

  // Helper: Escape LaTeX special characters
  function esc(str) {
    if (!str) return '';
    return str
      .replace(/(?<!\\)&/g, '\\&')
      .replace(/(?<!\\)%/g, '\\%')
      .replace(/(?<!\\)\$/g, '\\$')
      .replace(/(?<!\\)#/g, '\\#')
      .replace(/(?<!\\)_/g, '\\_');
  }

  // Helper: Bullet text
  function bulletText(str) {
    if (!str) return '';
    let out = str;

    // 1. Convert markdown **bold** to \textcolor{black}{\textbf{bold}}
    out = out.replace(/\*\*([^*]+)\*\*/g, '\\textcolor{black}{\\textbf{$1}}');

    // 2. Temporarily hide URLs inside \href and \hlink so they don't get escaped
    const links = [];
    out = out.replace(/\\(href|hlink)\{([^}]+)\}/g, (match, cmd, url) => {
      links.push({ cmd, url });
      return `LINKPLACEHOLDER${links.length - 1}END`;
    });

    // 3. Escape the string
    out = esc(out);

    // 4. Restore the links
    out = out.replace(/LINKPLACEHOLDER(\d+)END/g, (match, idx) => {
      const link = links[idx];
      return `\\${link.cmd}{${link.url}}`;
    });

    return out;
  }

  // 1. CORE COMPETENCIES (Page 1)
  const skills = data.skills || {};
  if (skills.ai_product_strategy?.length) {
    tex = tex.replace(
      /(\\subsection\{Key Skills\}\s*\\leftsep\s*\\skilltag\{)[^\n]+/g,
      `$1${esc(skills.ai_product_strategy.join(' \\textbullet{} '))}}`
    );
  }

  if (skills.tools?.length) {
    tex = tex.replace(
      /(\\section\{Product \\& Design Tools\}\s*\\leftsep\s*\\skilltag\{)[^\n]+/g,
      `$1${esc(skills.tools.join(' \\textbullet{} '))}}`
    );
  }

  // 2. PROFESSIONAL SUMMARY (Page 1)
  const summary = data.summary || {};

  if (summary.profile_summary_rewrite) {
    const defaultSentence1 = /having built \\textbf\{35\+ [^\}]+\} across [^\.]+\./;
    tex = tex.replace(defaultSentence1, esc(summary.profile_summary_rewrite) + (summary.profile_summary_rewrite.endsWith('.') ? '' : '.'));
  } else if (summary.product_types && summary.domain_context) {
    const defaultSentence1 = /having built \\textbf\{35\+ [^\}]+\} across [^\.]+\./;
    const newSentence1 = `having built \\textbf{35+ ${esc(summary.product_types)}} across ${esc(summary.domain_context)}.`;
    tex = tex.replace(defaultSentence1, newSentence1);
  }

  if (summary.closing_strength) {
    const defaultSentence = /Skilled at translating customer insights, stakeholder collaboration, and global research into product roadmaps focused on \\textbf\{unit economics\}, \\textbf\{P\\&L ownership\},\\& business impact\./;
    const newSentence = summary.closing_strength.includes("Skilled at")
      ? summary.closing_strength
      : `Skilled at translating customer insights, stakeholder collaboration, and global research into product roadmaps focused on \\textbf{${esc(summary.closing_strength)}}.`;
    tex = tex.replace(defaultSentence, newSentence);
  }

  // 3. OTHER SKILLS & DOMAIN EXPERTISE (Page 2)
  const page2 = data.page2 || {};
  if (page2.other_skills?.length) {
    tex = tex.replace(
      /(\\subsection\{Other Skills\}\s*\\leftsep\s*\\skilltag\{)[^\n]+/g,
      `$1${esc(page2.other_skills.join(' \\textbullet{} '))}}`
    );
  }
  if (page2.domain_expertise?.length) {
    tex = tex.replace(
      /(\\section\{Domain Expertise\}\s*\\leftsep\s*\\skilltag\{)[^\n]+/g,
      `$1${esc(page2.domain_expertise.join(' \\textbullet{} '))}}`
    );
  }

  // 4. EXPERIENCE (Page 1/2)
  const experience = data.experience || {};
  for (const [companyKey, fields] of Object.entries(experience)) {
    // Find the \expheader that matches the company Key
    // Escape regex characters just in case
    const safeKey = companyKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headerRegex = new RegExp(`(\\\\expheader\\{.*?${safeKey}.*?\\}.*?)\\\\begin\\{tightlist\\}([\\s\\S]*?)\\\\end\\{tightlist\\}`, 'i');

    tex = tex.replace(headerRegex, (match, headerBlock, oldList) => {
      let outList = `\n\\begin{tightlist}\n`;
      // Filter out non-bullet fields like company_name, title, etc.
      let bulletVals = [];
      if (Array.isArray(fields)) {
        bulletVals = fields.filter(val => typeof val === 'string' && val.trim().length > 0);
      } else {
        bulletVals = Object.entries(fields)
          .filter(([k, v]) => k.startsWith('bullet') && typeof v === 'string' && v.trim().length > 0)
          .map(([k, v]) => v);
      }

      // If LLM returned no bullets or an empty object, preserve the original
      if (bulletVals.length === 0) return match;

      for (const bullet of bulletVals) {
        outList += `  \\item ${bulletText(bullet)}\n`;
      }
      outList += `\\end{tightlist}`;
      return headerBlock + outList;
    });
  }

  // 5. KEY PROJECTS
  const projects = data.key_projects || [];
  const page2Projects = projects;

  function renderProject(proj, isLast) {
    if (!proj) return '';
    const name = proj.name || '';
    const subtitle = proj.subtitle || 'Product \\& Engineering';
    const link = proj.link || '';
    const subtitleLink = proj.subtitle_link || '';
    const subtitleLinkText = proj.subtitle_link_text || proj.link_text || proj.linkText || 'Live App';
    const projBullets = proj.bullets || [];

    // Escape '#' in URLs so LaTeX doesn't choke on them inside macro arguments
    const safeLink = link ? link.replace(/#/g, '\\#').replace(/%/g, '\\%') : '';
    const safeSubtitleLink = subtitleLink ? subtitleLink.replace(/#/g, '\\#').replace(/%/g, '\\%') : '';

    let header = safeLink ? `\\hlink{${safeLink}}{${esc(name)}}` : `\\textbf{${esc(name)}}`;
    const subtitleEsc = esc(subtitle);

    // Only add a link in the subtitle if explicitly provided (e.g. Demo video), 
    // to avoid duplicating the main link and messing up the layout.
    const linkPart = safeSubtitleLink ? `\\href{${safeSubtitleLink}}{${esc(subtitleLinkText)}}` : '';
    const subtitleBlock = linkPart ? `| ${subtitleEsc} | ${linkPart}` : `| ${subtitleEsc}`;

    let out = `\n\\projheader{${header}}{${subtitleBlock}}\n\\begin{tightlist}\n`;
    for (const b of projBullets.slice(0, 4)) {
      out += `  \\item ${bulletText(b)}\n`;
    }
    out += `\\end{tightlist}\n`;
    if (!isLast) {
      out += `\\rightsep\n`;
    }
    return out;
  }

  let p2_start = tex.indexOf('\\section{Key Projects}') + '\\section{Key Projects}'.length;
  let p2_end = tex.indexOf('\\end{minipage}', p2_start);
  if (p2_start !== -1 && p2_end !== -1) {
    let p2_tex = "\n\n";
    page2Projects.forEach((p, index) => p2_tex += renderProject(p, index === page2Projects.length - 1) + "\n");
    tex = tex.substring(0, p2_start) + p2_tex + "\n" + tex.substring(p2_end);
  }

  let page3Index = tex.indexOf('%  PAGE 3');
  if (page3Index !== -1) {
    let page3Start = tex.lastIndexOf('%==============================================================================', page3Index);
    if (page3Start === -1) page3Start = page3Index;
    let endDocIndex = tex.indexOf('\\end{document}', page3Start);
    if (endDocIndex !== -1) {
      tex = tex.substring(0, page3Start) + "\n\\end{document}\n";
    }
  }

  return tex;
}
