import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * LaTeX Compiler Service
 * Uses local tectonic CLI to compile raw LaTeX strings into PDF buffers.
 */
export async function compileLatexOnline(texContent) {
  const buildDir = path.join(process.cwd(), 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  const fileId = `resume_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const texPath = path.join(buildDir, `${fileId}.tex`);
  const pdfPath = path.join(buildDir, `${fileId}.pdf`);

  try {
    // MOCK FONT: To ensure compilation on machines without TeX Gyre Adventor
    let patchedContent = texContent
      .replace(/\\setmainfont\{TeX Gyre Adventor\}/g, '')
      .replace(/\\setsansfont\{TeX Gyre Adventor\}/g, '');
    
    fs.writeFileSync(texPath, patchedContent, 'utf8');
    fs.writeFileSync(path.join(process.cwd(), 'last_failed_latex.tex'), patchedContent, 'utf8');

    // Run tectonic
    try {
      execSync(`tectonic "${texPath}"`);
    } catch (execErr) {
      const errStr = `Tectonic Error Output: ${execErr.stdout?.toString()} \n ${execErr.stderr?.toString()}`;
      console.error("[LATEX COMPILER ERROR]", errStr);
      console.error("====== FAILING TEX CONTENT START ======");
      console.error(texContent);
      console.error("====== FAILING TEX CONTENT END ======");
      console.error("Saved failing tex to:", texPath);
      throw new Error(errStr);
    }

    if (!fs.existsSync(pdfPath)) {
      throw new Error("PDF not found after tectonic execution.");
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    return pdfBuffer;
  } catch (err) {
    throw new Error(`Failed to compile LaTeX via tectonic: ${err.message}`);
  } finally {
    // L4 Fix: Clean up temp files to prevent disk space leaks
    try {
      if (!process.env.GETMYJOB_DEBUG_LATEX && fs.existsSync(texPath)) fs.unlinkSync(texPath);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      // Also clean up tectonic auxiliary files (.aux, .log)
      const auxPath = texPath.replace('.tex', '.aux');
      const logPath = texPath.replace('.tex', '.log');
      if (fs.existsSync(auxPath)) fs.unlinkSync(auxPath);
      if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
    } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Compiles LaTeX to PDF, then iteratively runs widow optimization to fix widow lines.
 * Returns { pdfBuffer, finalTexContent }
 */
export async function compileLatexAndOptimize(texContent) {
  let currentTex = texContent;
  let pdfBuffer = await compileLatexOnline(currentTex);
  
  const buildDir = path.join(process.cwd(), 'build');
  const tempPdfPath = path.join(buildDir, 'temp_opt.pdf');
  const tempTexPath = path.join(buildDir, 'temp_opt.tex');
  
  for (let iteration = 0; iteration < 3; iteration++) {
    fs.writeFileSync(tempPdfPath, pdfBuffer);
    fs.writeFileSync(tempTexPath, currentTex, 'utf8');
    
    try {
      const pythonScript = path.join(process.cwd(), 'scripts', 'widow_optimizer.py');
      const output = execSync(`python3 "${pythonScript}" --pdf "${tempPdfPath}" --tex "${tempTexPath}"`, { encoding: 'utf8' });
      
      const result = JSON.parse(output);
      if (result.error) {
        console.error("[WIDOW OPTIMIZER ERROR]", result.error);
        break;
      }
      
      if (!result.widows || result.widows.length === 0) {
        console.log(`[WIDOW OPTIMIZER] No widows detected. Iteration: ${iteration}`);
        break; // Clean!
      }
      
      console.log(`[WIDOW OPTIMIZER] Found ${result.widows.length} widows. Applying fixes...`);
      let texChanged = false;
      
      for (const widow of result.widows) {
        if (widow.candidates && widow.candidates.length > 0) {
          // Use the top candidate
          const fix = widow.candidates[0];
          console.log(`[WIDOW OPTIMIZER] Fixing:\n  Old: ${widow.original}\n  New: ${fix}`);
          
          // Use a very careful replacement (string replacement)
          if (currentTex.includes(widow.original)) {
            currentTex = currentTex.replace(widow.original, fix);
            texChanged = true;
          } else {
             // Handle case where python output formatting might slightly differ
             const cleanOld = widow.original.trim();
             const cleanNew = fix.trim();
             if (currentTex.includes(cleanOld)) {
                 currentTex = currentTex.replace(cleanOld, cleanNew);
                 texChanged = true;
             }
          }
        }
      }
      
      if (!texChanged) {
        console.log("[WIDOW OPTIMIZER] No candidates could be applied. Stopping optimization.");
        break;
      }
      
      // Recompile with the new tex
      pdfBuffer = await compileLatexOnline(currentTex);
      
    } catch (err) {
      console.error("[WIDOW OPTIMIZER FAILED]", err.message);
      break;
    }
  }
  
  // Clean up temp files
  try {
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      if (fs.existsSync(tempTexPath)) fs.unlinkSync(tempTexPath);
  } catch {}
  
  return { pdfBuffer, finalTexContent: currentTex };
}
