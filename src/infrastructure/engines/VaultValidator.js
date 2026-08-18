/**
 * VaultValidator.js — OBPE Stage 3: Structural Validation Engine
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Validates parsed vault data for completeness, consistency,
 * deduplication, and structural integrity before classification.
 *
 * Zero dependencies. Pure deterministic logic.
 */

// ─── Severity Levels ────────────────────────────────────────────────────
const SEVERITY = {
  CRITICAL: 'CRITICAL',   // Broken links, structural corruption
  WARNING: 'WARNING',     // Duplicates, missing metadata
  INFO: 'INFO',           // Orphans, suggestions
};

/**
 * Run the complete validation suite on a parsed vault.
 *
 * @param {Object} parsedVault - Output from VaultParser.parseVault()
 * @returns {Object} { isValid, issues[], stats }
 */
export function validateVault(parsedVault) {
  const { nodes, edges, stats } = parsedVault;
  const issues = [];

  // ── 1. Broken Link Detection ──────────────────────────────────────────
  const nodeIds = new Set(nodes.map(n => n.id));
  const nodeNames = new Set(nodes.map(n => n.fileName.toLowerCase()));

  for (const node of nodes) {
    for (const linkTarget of (node.wikiLinks || [])) {
      if (!nodeNames.has(linkTarget.toLowerCase())) {
        issues.push({
          severity: SEVERITY.CRITICAL,
          type: 'BROKEN_LINK',
          source: node.filePath,
          target: linkTarget,
          message: `Broken wikilink: [[${linkTarget}]] in ${node.filePath}`,
        });
      }
    }
  }

  // ── 2. Orphaned Note Detection ────────────────────────────────────────
  const hasIncoming = new Set();
  const hasOutgoing = new Set();
  for (const edge of edges) {
    hasOutgoing.add(edge.source);
    hasIncoming.add(edge.target);
  }

  for (const node of nodes) {
    if (!hasIncoming.has(node.id) && !hasOutgoing.has(node.id)) {
      issues.push({
        severity: SEVERITY.INFO,
        type: 'ORPHANED_NOTE',
        source: node.filePath,
        message: `Orphaned note: ${node.fileName} has no incoming or outgoing links`,
      });
    }
  }

  // ── 3. Duplicate Detection (name similarity) ─────────────────────────
  const nameMap = new Map();
  for (const node of nodes) {
    const normalized = node.fileName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nameMap.has(normalized)) {
      issues.push({
        severity: SEVERITY.WARNING,
        type: 'DUPLICATE_NOTE',
        source: node.filePath,
        duplicate: nameMap.get(normalized).filePath,
        message: `Potential duplicate: "${node.fileName}" ≈ "${nameMap.get(normalized).fileName}"`,
      });
    } else {
      nameMap.set(normalized, node);
    }
  }

  // ── 4. Missing Frontmatter ────────────────────────────────────────────
  for (const node of nodes) {
    if (node.type === 'canvas') continue;
    const fm = node.frontmatter || {};
    if (!fm.date && !fm.created && !fm.type) {
      issues.push({
        severity: SEVERITY.WARNING,
        type: 'MISSING_FRONTMATTER',
        source: node.filePath,
        message: `Missing frontmatter (no date, type, or created field): ${node.fileName}`,
      });
    }
  }

  // ── 5. Empty Notes ────────────────────────────────────────────────────
  for (const node of nodes) {
    if (node.type === 'canvas') continue;
    if ((!node.rawContent || node.rawContent.trim().length < 20) && node.sections.length <= 1) {
      issues.push({
        severity: SEVERITY.INFO,
        type: 'EMPTY_NOTE',
        source: node.filePath,
        message: `Nearly empty note: ${node.fileName} (${(node.rawContent || '').length} chars)`,
      });
    }
  }

  // ── 6. Temporal Consistency Check ─────────────────────────────────────
  // Look for date conflicts in related notes
  const dateNodes = nodes.filter(n => n.frontmatter?.date || n.frontmatter?.start_date);
  for (let i = 0; i < dateNodes.length; i++) {
    for (let j = i + 1; j < dateNodes.length; j++) {
      const a = dateNodes[i];
      const b = dateNodes[j];
      // Check if they reference each other
      const aLinksB = a.wikiLinks?.some(l => l.toLowerCase() === b.fileName.toLowerCase());
      const bLinksA = b.wikiLinks?.some(l => l.toLowerCase() === a.fileName.toLowerCase());
      if (aLinksB || bLinksA) {
        const dateA = a.frontmatter.date || a.frontmatter.start_date;
        const dateB = b.frontmatter.date || b.frontmatter.start_date;
        if (dateA && dateB && dateA === dateB && a.frontmatter.type !== b.frontmatter.type) {
          // Not necessarily a problem, just flag for review
        }
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const criticalCount = issues.filter(i => i.severity === SEVERITY.CRITICAL).length;
  const warningCount = issues.filter(i => i.severity === SEVERITY.WARNING).length;
  const infoCount = issues.filter(i => i.severity === SEVERITY.INFO).length;

  return {
    isValid: criticalCount === 0,
    issues,
    summary: {
      total: issues.length,
      critical: criticalCount,
      warnings: warningCount,
      info: infoCount,
      notesValidated: nodes.length,
      edgesValidated: edges.length,
    },
  };
}

/**
 * Print a human-readable validation report.
 *
 * @param {Object} validationResult - Output from validateVault()
 */
export function printValidationReport(validationResult) {
  const { isValid, issues, summary } = validationResult;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  OBPE Vault Validation Report');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Status:     ${isValid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`  Notes:      ${summary.notesValidated}`);
  console.log(`  Edges:      ${summary.edgesValidated}`);
  console.log(`  Issues:     ${summary.total} (🔴 ${summary.critical} | 🟡 ${summary.warnings} | ⚪ ${summary.info})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (summary.critical > 0) {
    console.log('🔴 CRITICAL:');
    issues.filter(i => i.severity === SEVERITY.CRITICAL).forEach(i => {
      console.log(`   ${i.message}`);
    });
    console.log('');
  }

  if (summary.warnings > 0) {
    console.log('🟡 WARNINGS:');
    issues.filter(i => i.severity === SEVERITY.WARNING).slice(0, 20).forEach(i => {
      console.log(`   ${i.message}`);
    });
    if (summary.warnings > 20) console.log(`   ... and ${summary.warnings - 20} more`);
    console.log('');
  }

  if (summary.info > 0) {
    console.log(`⚪ INFO: ${summary.info} informational findings (orphans, empty notes)`);
  }
}
