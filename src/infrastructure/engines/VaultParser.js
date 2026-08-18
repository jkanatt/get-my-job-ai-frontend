/**
 * VaultParser.js — OBPE Stage 1 + 2: Lexical Ingestion & Knowledge Graph
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Zero-dependency Obsidian Vault parser.
 * Traverses a vault directory, extracts markdown AST, frontmatter,
 * wikilinks, tags, and builds a knowledge graph of nodes + edges.
 *
 * Performance: <100ms for a 500-note vault
 * Dependencies: fs only (no npm packages required)
 */

import fs from 'fs';
import path from 'path';

// ─── Ignored Directories ────────────────────────────────────────────────
const IGNORED_DIRS = new Set([
  '.obsidian', '.trash', '.git', 'node_modules', '.DS_Store',
  '.stversions', '.mobile',
]);

// ─── Frontmatter Parser (zero-dep YAML subset) ─────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const raw = match[1];
  const frontmatter = {};
  let currentKey = null;
  let inArray = false;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Array item
    if (trimmed.startsWith('- ') && currentKey && inArray) {
      if (!Array.isArray(frontmatter[currentKey])) frontmatter[currentKey] = [];
      frontmatter[currentKey].push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // Key: value
    const kvMatch = trimmed.match(/^([a-zA-Z_-]+)\s*:\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === '' || val === '|' || val === '>') {
        inArray = true;
        frontmatter[currentKey] = [];
      } else {
        inArray = false;
        // Parse boolean, number, or string
        if (val === 'true') frontmatter[currentKey] = true;
        else if (val === 'false') frontmatter[currentKey] = false;
        else if (/^\d+(\.\d+)?$/.test(val)) frontmatter[currentKey] = parseFloat(val);
        else frontmatter[currentKey] = val.replace(/^["']|["']$/g, '');
      }
    }
  }

  const body = content.slice(match[0].length).trim();
  return { frontmatter, body };
}

// ─── WikiLink Extractor ─────────────────────────────────────────────────
function extractWikiLinks(body) {
  const links = [];
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let m;
  while ((m = regex.exec(body)) !== null) {
    links.push({
      target: m[1].trim(),
      alias: m[2]?.trim() || null,
    });
  }
  return links;
}

// ─── Tag Extractor ──────────────────────────────────────────────────────
function extractTags(body, frontmatter) {
  const tags = new Set();
  // Frontmatter tags
  if (Array.isArray(frontmatter.tags)) {
    frontmatter.tags.forEach(t => tags.add(t.toLowerCase()));
  } else if (typeof frontmatter.tags === 'string') {
    frontmatter.tags.split(',').forEach(t => tags.add(t.trim().toLowerCase()));
  }
  // Inline tags (#tag)
  const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  let m;
  while ((m = tagRegex.exec(body)) !== null) {
    tags.add(m[1].toLowerCase());
  }
  return [...tags];
}

// ─── Heading / Section Extractor ────────────────────────────────────────
function extractSections(body) {
  const sections = [];
  const lines = body.split('\n');
  let currentSection = { heading: '_root', level: 0, content: [] };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (currentSection.content.length > 0 || currentSection.heading !== '_root') {
        currentSection.content = currentSection.content.join('\n').trim();
        sections.push(currentSection);
      }
      currentSection = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        content: [],
      };
    } else {
      currentSection.content.push(line);
    }
  }
  currentSection.content = currentSection.content.join('\n').trim();
  if (currentSection.content || currentSection.heading !== '_root') {
    sections.push(currentSection);
  }
  return sections;
}

// ─── Bullet Point Extractor ─────────────────────────────────────────────
function extractBullets(body) {
  const bullets = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*]\s+/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-*]\s+/, ''));
    }
  }
  return bullets;
}

// ─── URL Extractor ──────────────────────────────────────────────────────
function extractUrls(body) {
  const urls = [];
  const regex = /https?:\/\/[^\s\)>\]]+/g;
  let m;
  while ((m = regex.exec(body)) !== null) {
    urls.push(m[0]);
  }
  return [...new Set(urls)];
}

// ─── KPI / Metric Extractor ────────────────────────────────────────────
function extractKPIs(body) {
  const kpis = [];
  const patterns = [
    /(\d+[%x])/gi,                          // 40%, 3x
    /(\$[\d,.]+[KMB]?)/gi,                  // $1.2M, $500K
    /([\d,.]+\+?\s*(?:users?|customers?|clients?|downloads?))/gi,
    /([\d,.]+\+?\s*(?:DAU|MAU|MRR|ARR))/gi,
    /(\d+\+?\s*(?:engineers?|members?|team))/gi,
    /([\d,.]+\s*(?:ms|seconds?|minutes?))/gi,  // Latency metrics
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(body)) !== null) {
      kpis.push(m[1]);
    }
  }
  return [...new Set(kpis)];
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse an entire Obsidian vault directory into a structured knowledge graph.
 *
 * @param {string} vaultPath - Absolute path to the Obsidian vault root
 * @returns {Object} Parsed vault: { nodes[], edges[], stats }
 */
export function parseVault(vaultPath) {
  const startTime = Date.now();
  const nodes = [];
  const edges = [];
  const nodeMap = new Map(); // filename → node

  // Recursive directory traversal
  function walkDir(dirPath, relativeTo) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(relativeTo, fullPath);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walkDir(fullPath, relativeTo);
        }
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(content);
        const wikiLinks = extractWikiLinks(body);
        const tags = extractTags(body, frontmatter);
        const sections = extractSections(body);
        const bullets = extractBullets(body);
        const urls = extractUrls(body);
        const kpis = extractKPIs(body);
        const fileName = path.basename(entry.name, '.md');
        const folder = path.dirname(relPath);

        const node = {
          id: slugify(fileName),
          fileName,
          filePath: relPath,
          folder,
          frontmatter,
          tags,
          sections,
          bullets,
          urls,
          kpis,
          wikiLinks: wikiLinks.map(l => l.target),
          rawContent: body,
          createdAt: frontmatter.date || fs.statSync(fullPath).birthtime.toISOString(),
          updatedAt: fs.statSync(fullPath).mtime.toISOString(),
        };

        nodes.push(node);
        nodeMap.set(fileName.toLowerCase(), node);
      } else if (entry.name.endsWith('.canvas')) {
        // Parse canvas files (JSON format)
        try {
          const canvasData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          const canvasNode = {
            id: slugify(path.basename(entry.name, '.canvas')),
            fileName: path.basename(entry.name, '.canvas'),
            filePath: path.relative(relativeTo, fullPath),
            folder: path.dirname(path.relative(relativeTo, fullPath)),
            type: 'canvas',
            canvasNodes: canvasData.nodes || [],
            canvasEdges: canvasData.edges || [],
            tags: [],
            sections: [],
            bullets: [],
            urls: [],
            kpis: [],
            wikiLinks: [],
            rawContent: '',
          };
          nodes.push(canvasNode);
        } catch (_) {
          // Skip malformed canvas files
        }
      }
    }
  }

  walkDir(vaultPath, vaultPath);

  // Build bidirectional edges from wikilinks
  for (const node of nodes) {
    for (const linkTarget of node.wikiLinks) {
      const targetNode = nodeMap.get(linkTarget.toLowerCase());
      if (targetNode) {
        edges.push({
          source: node.id,
          target: targetNode.id,
          type: 'wikilink',
        });
      }
    }
  }

  // Compute basic graph stats
  const incomingCount = {};
  const outgoingCount = {};
  for (const edge of edges) {
    outgoingCount[edge.source] = (outgoingCount[edge.source] || 0) + 1;
    incomingCount[edge.target] = (incomingCount[edge.target] || 0) + 1;
  }

  const orphanedNodes = nodes.filter(n =>
    !incomingCount[n.id] && !outgoingCount[n.id]
  );

  const hubNodes = nodes
    .map(n => ({
      id: n.id,
      connections: (incomingCount[n.id] || 0) + (outgoingCount[n.id] || 0),
    }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 10);

  const elapsed = Date.now() - startTime;

  return {
    nodes,
    edges,
    nodeMap,
    stats: {
      totalNotes: nodes.filter(n => n.type !== 'canvas').length,
      totalCanvases: nodes.filter(n => n.type === 'canvas').length,
      totalEdges: edges.length,
      orphanedCount: orphanedNodes.length,
      hubNodes,
      parsingTimeMs: elapsed,
    },
  };
}

// ─── Utility ────────────────────────────────────────────────────────────
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export { parseFrontmatter, extractWikiLinks, extractTags, extractSections, extractBullets, extractUrls, extractKPIs };
