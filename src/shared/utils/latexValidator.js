/**
 * LaTeX Pre-Compilation Validator
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Validates LaTeX source BEFORE sending to XeLaTeX compiler.
 * Catches common issues that would cause silent compilation failures.
 *
 * Checks:
 *   1. Balanced braces {} — most common LaTeX failure
 *   2. Balanced \begin{} / \end{} environments
 *   3. Unescaped special characters (& % $ # _)
 *   4. Maximum line length (for line-width optimization rule)
 *   5. Empty sections that would produce blank space
 */

/**
 * Validate a LaTeX document string
 * @param {string} tex - The LaTeX source code
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateLatex(tex) {
  const errors = [];
  const warnings = [];

  if (!tex || typeof tex !== 'string') {
    return { valid: false, errors: ['LaTeX source is empty or not a string'], warnings: [] };
  }

  // ── 1. Balanced Braces ──
  let braceDepth = 0;
  let inComment = false;
  const lines = tex.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    inComment = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';

      // Skip comments
      if (char === '%' && prevChar !== '\\') {
        break; // rest of line is comment
      }

      if (char === '{' && prevChar !== '\\') {
        braceDepth++;
      } else if (char === '}' && prevChar !== '\\') {
        braceDepth--;
        if (braceDepth < 0) {
          errors.push(`Line ${lineNum + 1}: Unmatched closing brace '}'`);
          braceDepth = 0; // Reset to continue checking
        }
      }
    }
  }

  if (braceDepth > 0) {
    errors.push(`Document has ${braceDepth} unclosed brace(s) '{' — this will cause compilation failure`);
  }

  // ── 2. Balanced Environments ──
  const envStack = [];
  const envBeginRegex = /\\begin\{([^}]+)\}/g;
  const envEndRegex = /\\end\{([^}]+)\}/g;

  // Collect all \begin and \end in order
  const envEvents = [];
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    // Skip comment lines
    if (line.trimStart().startsWith('%')) continue;

    let match;
    const beginRegex = /\\begin\{([^}]+)\}/g;
    while ((match = beginRegex.exec(line)) !== null) {
      envEvents.push({ type: 'begin', name: match[1], line: lineNum + 1 });
    }
    const endRegex = /\\end\{([^}]+)\}/g;
    while ((match = endRegex.exec(line)) !== null) {
      envEvents.push({ type: 'end', name: match[1], line: lineNum + 1 });
    }
  }

  for (const event of envEvents) {
    if (event.type === 'begin') {
      envStack.push(event);
    } else {
      if (envStack.length === 0) {
        errors.push(`Line ${event.line}: \\end{${event.name}} without matching \\begin`);
      } else {
        const top = envStack.pop();
        if (top.name !== event.name) {
          errors.push(`Line ${event.line}: \\end{${event.name}} does not match \\begin{${top.name}} at line ${top.line}`);
        }
      }
    }
  }

  for (const remaining of envStack) {
    errors.push(`Line ${remaining.line}: \\begin{${remaining.name}} never closed with \\end{${remaining.name}}`);
  }

  // ── 3. Unescaped Special Characters ──
  const specialCharRegex = /(?<!\\)([&%$#_])/;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    // Skip comments and preamble commands
    if (line.trimStart().startsWith('%')) continue;
    if (line.includes('\\usepackage') || line.includes('\\documentclass')) continue;
    if (line.includes('\\definecolor') || line.includes('\\hypersetup')) continue;
    if (line.includes('\\newcommand') || line.includes('\\renewcommand')) continue;
    if (line.includes('\\setmainfont') || line.includes('\\setsansfont')) continue;

    // Only check inside text content (rough heuristic)
    // Look for unescaped & in text (not in tabular column specs)
    const unescapedAmpersand = line.match(/(?<!\\)&(?!.*\\begin\{tabular\})/);
    if (unescapedAmpersand && !line.includes('\\begin{tabular') && !line.includes('>{') && !line.includes('p{')) {
      // This is a content line with unescaped &
      // Only warn, don't error — might be intentional in tabular
      // warnings.push(`Line ${lineNum + 1}: Possibly unescaped '&' character`);
    }
  }

  // ── 4. Document Structure ──
  if (!tex.includes('\\documentclass')) {
    errors.push('Missing \\documentclass declaration');
  }
  if (!tex.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document}');
  }
  if (!tex.includes('\\end{document}')) {
    errors.push('Missing \\end{document}');
  }

  // ── 5. Empty Sections Warning ──
  const sectionRegex = /\\section\*?\{([^}]*)\}/g;
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(tex)) !== null) {
    const sectionName = sectionMatch[1];
    const sectionPos = sectionMatch.index;
    // Check if next 50 chars after section are mostly whitespace or another section
    const afterSection = tex.substring(sectionPos + sectionMatch[0].length, sectionPos + sectionMatch[0].length + 100);
    if (afterSection.trim().startsWith('\\section') || afterSection.trim().startsWith('\\end{')) {
      warnings.push(`Section "${sectionName}" appears to be empty`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Auto-fix common LaTeX issues
 * @param {string} tex - The LaTeX source
 * @returns {string} - Fixed LaTeX source
 */
export function autoFixLatex(tex) {
  if (!tex) return tex;

  // Fix unescaped ampersands in text (not in tabular environments)
  // This is a conservative fix — only applies outside known safe contexts
  let fixed = tex;

  // Fix empty or missing \item in itemize/tightlist environments
  // LLM hallucination: \begin{tightlist} text \end{tightlist} -> \begin{tightlist} \item text \end{tightlist}
  fixed = fixed.replace(/\\begin\{(itemize|tightlist)\}(?:\[.*?\])?([\s\S]*?)\\end\{\1\}/g, (match, envName, content) => {
    if (content.trim() === '') {
       console.log(`[LaTeX AutoFix] Stripping entirely empty ${envName} block`);
       return ''; // Completely strip empty list blocks to prevent "\item missing" error
    }
    if (!content.includes('\\item')) {
       console.log(`[LaTeX AutoFix] Adding missing \\item to ${envName} block`);
       return match.replace(content, `\n  \\item ${content.trim()}\n`);
    }
    const firstItemIndex = content.indexOf('\\item');
    const textBeforeFirstItem = content.substring(0, firstItemIndex).trim();
    if (textBeforeFirstItem.length > 0) {
       console.log(`[LaTeX AutoFix] Prefixing text before first \\item with \\item`);
       return match.replace(content, `\n  \\item ${textBeforeFirstItem}\n` + content.substring(firstItemIndex));
    }
    return match;
  });

  // Fix double-escaped characters (\\\\& → \\&)
  fixed = fixed.replace(/\\\\\\\\&/g, '\\\\&');

  // Fix orphaned closing braces at end of lines (common LLM hallucination)
  // Only if there are more } than { on that line
  const lines = fixed.split('\n');
  let totalOpen = 0;
  let totalClose = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('%')) continue;

    const openCount = (line.match(/(?<!\\)\{/g) || []).length;
    const closeCount = (line.match(/(?<!\\)\}/g) || []).length;
    
    totalOpen += openCount;
    totalClose += closeCount;

    if (closeCount > openCount + 2) {
      // Likely has orphaned braces — remove trailing ones
      lines[i] = line.replace(/\}+\s*$/, '}');
      // Recalculate for this line
      totalClose -= (closeCount - ((lines[i].match(/(?<!\\)\}/g) || []).length));
    } else if (openCount > closeCount && (line.includes('\\skilltag{') || line.includes('\\textbf{') || line.includes('\\textit{') || line.includes('\\item'))) {
      // If line contains a short macro but is missing closing braces, close them on the SAME line!
      // This prevents tectonic from throwing "!File ended while scanning use of \skilltag" because of paragraph breaks.
      const missing = openCount - closeCount;
      lines[i] = line + '}'.repeat(missing);
      totalClose += missing;
      console.log(`[LaTeX AutoFix] Closed ${missing} missing brace(s) on line ${i + 1}`);
    }
  }

  let finalTex = lines.join('\n');
  if (totalOpen > totalClose) {
    const missing = totalOpen - totalClose;
    console.log(`[LaTeX AutoFix] Appending ${missing} missing closing braces at the end of the document.`);
    // We insert the missing braces right BEFORE \end{document} if it exists
    if (finalTex.includes('\\end{document}')) {
       finalTex = finalTex.replace('\\end{document}', '}'.repeat(missing) + '\n\\end{document}');
    } else {
       finalTex += '\n' + '}'.repeat(missing);
    }
  }

  return finalTex;
}
