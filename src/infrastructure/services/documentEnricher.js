/**
 * documentEnricher.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Phase 9: Shared utility to enrich project data with Document_1 metadata.
 * Used by cover letter and email generators for richer LLM context.
 */

import fs from 'fs';
import path from 'path';

let _doc1CacheLocal = null;

/**
 * Parse Document_1_ATS_Projects_temp.md into a structured lookup map.
 * Returns { [projectName]: { name, subtitle, link, link_text, keywords, bullets } }
 */
function parseDocument1FromFile() {
  if (_doc1CacheLocal) return _doc1CacheLocal;
  
  const filePath = path.join(process.cwd(), '.data', 'Document_1_ATS_Projects_temp.md');
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  
  const projectBlocks = content.split(/(?:^|\n)##\s+/);
  const parsedProjects = {};

  projectBlocks.forEach(block => {
    const nameMatch = block.match(/^\d+\.\s*([^\n\r]+)/);
    if (!nameMatch) return;
    const name = nameMatch[1].trim();

    const linkMatch = block.match(/\*\*Project Link:\*\*\s*\[(.*?)\]\((.*?)\)/);
    const link_text = linkMatch ? linkMatch[1].trim() : 'Live App';
    const link = linkMatch ? linkMatch[2].trim() : '';

    const keywordsMatch = block.match(/\*\*Keywords:\*\*\s*([^\n\r]+)/);
    const keywords = keywordsMatch
      ? keywordsMatch[1].split(',').map(k => k.trim().replace(/\.$/, ''))
      : [];

    // Extract subtitle from the bold line with pipes (e.g., "PayDash AI Copilot | HRMS / FinTech / AI | B2B SaaS | ...")
    const boldLines = [...block.matchAll(/\*\*(.+?)\*\*/g)].map(m => m[1]);
    let subtitle = 'Product & Engineering';
    let industry_context = '';
    for (const b of boldLines) {
      if (b.includes('|')) {
        const parts = b.split('|').map(p => p.trim());
        if (parts.length > 1) {
          subtitle = parts.slice(1).join(' | ');
          industry_context = subtitle;
          break;
        }
      }
    }

    const bullets = [];
    const lines = block.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('* ')) {
        let b = line.trim().substring(2).trim();
        b = b.replace(/^\*\*\s*"([^"]+)"\s*\*\*$/, '$1').replace(/^"([^"]+)"$/, '$1');
        bullets.push(b);
      }
    }

    const scoreMatch = block.match(/\*\*Score Card:\*\*\s*([^\n\r]+)/);
    const scoreCard = scoreMatch ? scoreMatch[1].trim() : '';

    const projData = { name, subtitle, link, link_text, keywords, bullets, industry_context, scoreCard };
    parsedProjects[name] = projData;
    parsedProjects[name.toLowerCase()] = projData;
    const normId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    parsedProjects[normId] = projData;
  });

  _doc1CacheLocal = parsedProjects;
  return parsedProjects;
}

/**
 * Enrich an array of project objects with Document_1 data.
 * Adds: keywords, industry_context, optimized bullets, links, subtitle.
 * Does NOT remove any existing data — only enriches.
 */
export function enrichProjectsWithDocument1(projects) {
  if (!projects || !Array.isArray(projects)) return projects;
  
  const doc1Data = parseDocument1FromFile();
  if (Object.keys(doc1Data).length === 0) return projects;

  return projects.map(p => {
    const pName = (p.name || '').toLowerCase();
    const normId = (p.id || '').toLowerCase() || pName.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    
    const d1 = doc1Data[p.name] || doc1Data[pName] || doc1Data[normId] || 
      (normId === 'get_my_job_autonomous_careers' ? doc1Data['kamkaro'] : null);
    
    if (d1) {
      return {
        ...p,
        bullets: d1.bullets && d1.bullets.length > 0 ? d1.bullets : p.bullets,
        subtitle: d1.subtitle || p.subtitle,
        link: d1.link || p.link,
        link_text: d1.link_text || p.link_text,
        keywords: d1.keywords || [],
        searchable_keywords: d1.keywords || p.searchable_keywords || [],
        industry_context: d1.industry_context || p.industry_context || '',
        scoreCard: d1.scoreCard || ''
      };
    }
    return p;
  });
}

/**
 * Clear the local Document_1 cache (call when Document_1 file changes).
 */
export function clearDocument1Cache() {
  _doc1CacheLocal = null;
}
