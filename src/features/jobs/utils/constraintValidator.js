/**
 * constraintValidator.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Deterministic constraint enforcement — zero AI, zero cost, <10ms
 * Validates resume JSON against resume_constraints.json rules.
 * Auto-fixes violations by truncating strings and trimming arrays.
 */

import fs from 'fs';
import path from 'path';

const SENDER_PATH = process.env.GMAIL_SENDER_PATH || process.cwd();

// Helper: strip LaTeX commands for visible-character counting
function stripLatexMarkup(str) {
  return str
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\hlink\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\item\s*/g, '')
    .replace(/\\noindent\s*/g, '')
    .replace(/\\{1,2}/g, '')         // H6 Fix: Handle both \\ (newline) and single \ escape sequences
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_');
}

// Helper: convert markdown **bold** to LaTeX \textbf{}
function markdownToLatex(str) {
  return str.replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}');
}

export function loadConstraints() {
  return JSON.parse(fs.readFileSync(path.join(SENDER_PATH, 'resume_constraints.json'), 'utf-8'));
}

// Get nested value from object using dot-notation path
function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}

// Set nested value on object using dot-notation path
function setNestedValue(obj, dotPath, value) {
  const keys = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Validate and auto-fix a resume JSON against constraints.
 * Returns { valid, violations, fixes, data }
 */
export function validateAndFix(resumeData, constraints = null) {
  if (!constraints) constraints = loadConstraints();

  const violations = [];
  const fixes = [];

  // Convert markdown **bold** to LaTeX \textbf{} across ALL string fields
  convertMarkdownToLatex(resumeData, fixes);

  for (const [sectionPath, rules] of Object.entries(constraints.sections)) {
    // Handle wildcard paths like "key_projects.*.bullets"
    if (sectionPath.includes('*')) {
      const parts = sectionPath.split('.*.');
      const parentPath = parts[0];
      const childKey = parts[1];
      const parentArray = getNestedValue(resumeData, parentPath);

      if (Array.isArray(parentArray)) {
        parentArray.forEach((item, idx) => {
          if (childKey && item[childKey] !== undefined) {
            validateAndFixField(
              item, childKey, item[childKey], rules,
              `${parentPath}[${idx}].${childKey}`, violations, fixes
            );
          }
        });
      }
      continue;
    }

    const value = getNestedValue(resumeData, sectionPath);
    if (value === undefined) continue;

    // Find the parent object and the final key
    const keys = sectionPath.split('.');
    const finalKey = keys.pop();
    const parent = keys.length > 0 ? getNestedValue(resumeData, keys.join('.')) : resumeData;

    if (parent) {
      validateAndFixField(parent, finalKey, value, rules, sectionPath, violations, fixes);
    }
  }

  // Check for duplicates across skill sections
  if (constraints.global.no_duplicates_across_sections) {
    removeDuplicates(resumeData, violations, fixes);
  }

  // LaTeX safety check
  if (constraints.global.latex_safe_chars) {
    fixLatexChars(resumeData, fixes);
  }

  // Immutable section protection
  if (constraints.immutable_sections) {
    try {
      const masterData = JSON.parse(fs.readFileSync(path.join(SENDER_PATH, 'master_resume_data.json'), 'utf-8'));
      enforceImmutableSections(resumeData, masterData, constraints.immutable_sections, violations, fixes);
    } catch { /* master data not available, skip immutable check */ }
  }

  return {
    valid: violations.length === 0,
    violations,
    fixes,
    data: resumeData
  };
}

function validateAndFixField(parent, key, value, rules, pathStr, violations, fixes) {
  if (rules.type === 'array' && Array.isArray(value)) {
    // Check exact_items
    if (rules.exact_items && value.length !== rules.exact_items) {
      violations.push({ path: pathStr, rule: 'exact_items', expected: rules.exact_items, actual: value.length });
      if (value.length > rules.exact_items) {
        parent[key] = value.slice(0, rules.exact_items);
        fixes.push({ path: pathStr, action: 'trimmed_array', from: value.length, to: rules.exact_items });
      }
    }
    // Check min_items
    if (rules.min_items && value.length < rules.min_items) {
      violations.push({ path: pathStr, rule: 'min_items', expected: rules.min_items, actual: value.length });
      fixes.push({ path: pathStr, action: 'below_minimum', expected: rules.min_items, actual: value.length });
    }
    // Check max_items
    if (rules.max_items && value.length > rules.max_items) {
      violations.push({ path: pathStr, rule: 'max_items', expected: rules.max_items, actual: value.length });
      parent[key] = value.slice(0, rules.max_items);
      fixes.push({ path: pathStr, action: 'trimmed_array', from: value.length, to: rules.max_items });
    }
    // Check max_chars_per_item (count VISIBLE chars, excluding LaTeX markup)
    if (rules.max_chars_per_item || rules.min_chars_per_item) {
      const arr = parent[key];
      arr.forEach((item, idx) => {
        if (typeof item === 'string') {
          const visibleLength = stripLatexMarkup(item).length;
          
          // Max check
          console.log(`[Validator] Check ${pathStr}[${idx}]: length=${visibleLength} vs max=${rules.max_chars_per_item}`); if (rules.max_chars_per_item && visibleLength > rules.max_chars_per_item) {
            violations.push({ path: `${pathStr}[${idx}]`, rule: 'max_chars_per_item', expected: rules.max_chars_per_item, actual: visibleLength });
            // Smart truncate: try to break at a word boundary
            // We need to truncate the raw string proportionally
            const ratio = rules.max_chars_per_item / visibleLength;
            const targetRawLen = Math.floor(item.length * ratio);
            let truncated = item.substring(0, targetRawLen);
            const lastSpace = truncated.lastIndexOf(' ');
            if (lastSpace > targetRawLen * 0.7) {
              truncated = truncated.substring(0, lastSpace);
            }
            // Clean up trailing prepositions and punctuation
            truncated = truncated.replace(/\s+(for|and|or|the|with|to|in|of|a|an)\s*$/i, '');
            truncated = truncated.replace(/[,;:\-\s]+$/, '');
            // Ensure we don't break inside a \textbf{} command
            const openBraces = (truncated.match(/\\textbf\{/g) || []).length;
            const closeBraces = (truncated.match(/\}/g) || []).length;
            if (openBraces > closeBraces) {
              truncated += '}';
            }
            arr[idx] = truncated;
            fixes.push({ path: `${pathStr}[${idx}]`, action: 'truncated', from: visibleLength, to: stripLatexMarkup(truncated).length });
          }
          
          // Suboptimal line width check (84-char line width utilization)
          // Specifically applies to bullet fields (experience and key_projects).
          if (pathStr.includes('bullets') || pathStr.includes('experience')) {
            const currentVisLen = stripLatexMarkup(arr[idx]).length;
            if ((currentVisLen > 10 && currentVisLen < 80) || (currentVisLen > 84 && currentVisLen < 160)) {
              violations.push({
                path: `${pathStr}[${idx}]`,
                rule: 'suboptimal_line_width',
                expected: "80-84 or 160-168 visible characters to exactly fill 1 or 2 lines",
                actual: currentVisLen
              });
              // No auto-fix applied here; the violation array feeds directly into the Agent 6 Self-Healing Loop.
            }
          }
        }
      });
    }
  }

  if (rules.type === 'string' && typeof value === 'string') {
    if (rules.max_chars && value.length > rules.max_chars) {
      violations.push({ path: pathStr, rule: 'max_chars', expected: rules.max_chars, actual: value.length });
      let truncated = value.substring(0, rules.max_chars);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > rules.max_chars * 0.7) {
        truncated = truncated.substring(0, lastSpace);
      }
      // Clean up trailing prepositions and punctuation
      truncated = truncated.replace(/\s+(for|and|or|the|with|to|in|of|a|an)\s*$/i, '');
      truncated = truncated.replace(/[,;:\-\s]+$/, '');
      parent[key] = truncated;
      fixes.push({ path: pathStr, action: 'truncated', from: value.length, to: truncated.length });
    }
  }
}

function removeDuplicates(resumeData, violations, fixes) {
  const seen = new Set();
  const skillArrayPaths = [
    ['skills', 'ai_product_strategy'],
    ['skills', 'domain_skills'],
    ['skills', 'tools'],
    ['skills', 'analytics'],
    ['page2', 'other_skills'],
    ['page2', 'domain_expertise']
  ];

  for (const keys of skillArrayPaths) {
    let obj = resumeData;
    for (const k of keys.slice(0, -1)) {
      if (!obj[k]) break;
      obj = obj[k];
    }
    const finalKey = keys[keys.length - 1];
    const arr = obj?.[finalKey];
    if (!Array.isArray(arr)) continue;

    const pathStr = keys.join('.');
    const cleaned = [];
    for (const item of arr) {
      const normalized = item.replace(/\\\\/g, '').replace(/\\&/g, '&').replace(/\s+/g, ' ').toLowerCase().trim();
      if (seen.has(normalized)) {
        violations.push({ path: pathStr, rule: 'duplicate', value: item });
        fixes.push({ path: pathStr, action: 'removed_duplicate', value: item });
      } else {
        seen.add(normalized);
        cleaned.push(item);
      }
    }
    obj[finalKey] = cleaned;
  }
}

function fixLatexChars(obj, fixes) {
  function traverse(o, currentPath) {
    if (!o || typeof o !== 'object') return;
    for (const [key, value] of Object.entries(o)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      if (typeof value === 'string') {
        // Skip strings that already contain LaTeX commands
        if (/\\textbf\{/.test(value) || /\\hlink\{/.test(value) || /\\href\{/.test(value)) {
          // Only fix unescaped ampersands in LaTeX-command strings
          let fixed = value.replace(/(?<!\\)&/g, '\\&');
          if (fixed !== value) {
            o[key] = fixed;
            fixes.push({ path: newPath, action: 'latex_escape_ampersand_only' });
          }
          continue;
        }
        let fixed = value;
        fixed = fixed.replace(/(?<!\\)&/g, '\\&');
        fixed = fixed.replace(/(?<!\\)%/g, '\\%');
        fixed = fixed.replace(/(?<!\\)\$/g, '\\$');
        fixed = fixed.replace(/(?<!\\)#/g, '\\#');
        fixed = fixed.replace(/(?<!\\)_/g, '\\_');

        if (fixed !== value) {
          o[key] = fixed;
          fixes.push({ path: newPath, action: 'latex_escape' });
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          if (typeof item === 'string') {
            // Skip strings that contain LaTeX commands
            if (/\\textbf\{/.test(item) || /\\hlink\{/.test(item) || /\\href\{/.test(item)) {
              let fixed = item.replace(/(?<!\\)&/g, '\\&');
              if (fixed !== item) {
                value[idx] = fixed;
                fixes.push({ path: `${newPath}[${idx}]`, action: 'latex_escape_ampersand_only' });
              }
              return;
            }
            let fixed = item;
            fixed = fixed.replace(/(?<!\\)&/g, '\\&');
            fixed = fixed.replace(/(?<!\\)%/g, '\\%');
            fixed = fixed.replace(/(?<!\\)\$/g, '\\$');
            fixed = fixed.replace(/(?<!\\)#/g, '\\#');
            fixed = fixed.replace(/(?<!\\)_/g, '\\_');

            if (fixed !== item) {
              value[idx] = fixed;
              fixes.push({ path: `${newPath}[${idx}]`, action: 'latex_escape' });
            }
          }
        });
      } else if (typeof value === 'object') {
        traverse(value, newPath);
      }
    }
  }
  traverse(obj, '');
}

// Convert markdown **bold** to LaTeX \textbf{} across all string fields
function convertMarkdownToLatex(obj, fixes) {
  function traverse(o, currentPath) {
    if (!o || typeof o !== 'object') return;
    for (const [key, value] of Object.entries(o)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      if (typeof value === 'string') {
        const converted = markdownToLatex(value);
        if (converted !== value) {
          o[key] = converted;
          fixes.push({ path: newPath, action: 'markdown_to_latex' });
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          if (typeof item === 'string') {
            const converted = markdownToLatex(item);
            if (converted !== item) {
              value[idx] = converted;
              fixes.push({ path: `${newPath}[${idx}]`, action: 'markdown_to_latex' });
            }
          }
        });
      } else if (typeof value === 'object') {
        traverse(value, newPath);
      }
    }
  }
  traverse(obj, '');
}

// Enforce immutable sections by restoring original values from master data
function enforceImmutableSections(resumeData, masterData, immutablePaths, violations, fixes) {
  for (const immutablePath of immutablePaths) {
    if (immutablePath.includes('*')) {
      // Handle wildcard paths like "experience.*.company_name"
      const parts = immutablePath.split('.*.');
      if (parts.length !== 2) continue;
      const arrayPath = parts[0];
      const fieldKey = parts[1];
      
      const currentArray = getNestedValue(resumeData, arrayPath);
      const masterArray = getNestedValue(masterData, arrayPath);
      
      if (!Array.isArray(currentArray) || !Array.isArray(masterArray)) continue;
      
      // Match by index (arrays should be structurally aligned)
      const limit = Math.min(currentArray.length, masterArray.length);
      for (let i = 0; i < limit; i++) {
        const masterVal = masterArray[i]?.[fieldKey];
        const currentVal = currentArray[i]?.[fieldKey];
        if (masterVal !== undefined && currentVal !== undefined && JSON.stringify(masterVal) !== JSON.stringify(currentVal)) {
          violations.push({ path: `${arrayPath}[${i}].${fieldKey}`, rule: 'immutable', expected: masterVal, actual: currentVal });
          currentArray[i][fieldKey] = masterVal;
          fixes.push({ path: `${arrayPath}[${i}].${fieldKey}`, action: 'restored_immutable' });
        }
      }
      continue;
    }
    const masterValue = getNestedValue(masterData, immutablePath);
    const currentValue = getNestedValue(resumeData, immutablePath);
    if (masterValue !== undefined && currentValue !== undefined && JSON.stringify(masterValue) !== JSON.stringify(currentValue)) {
      violations.push({ path: immutablePath, rule: 'immutable', expected: 'unchanged', actual: 'modified' });
      setNestedValue(resumeData, immutablePath, masterValue);
      fixes.push({ path: immutablePath, action: 'restored_immutable' });
    }
  }
}

const constraintValidator = { validateAndFix, loadConstraints };
export default constraintValidator;
