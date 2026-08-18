import fs from 'fs';
import path from 'path';
import { compileLatexOnline } from './latex-compiler.js';
import { generatePersonalizedNarrative } from './personalizationEngine.js';
import { enrichProjectsWithDocument1 } from './documentEnricher.js';

/**
 * Dynamically generates a highly targeted Markdown cover letter based on the Job Description
 * and the top Vector Brain matched projects.
 * 
 * @param {string} jdText The raw job description
 * @param {object} jdIntel Structured intelligence extracted from the JD
 * @param {Array} topProjects The top 1-4 projects retrieved from the Vector Brain
 * @param {object} profileData Master profile data (name, email, phone, links)
 * @returns {Promise<string>} The tailored Markdown cover letter
 */
export async function generateCoverLetter(jdText, jdIntel, topProjects, profileData, brainData = {}) {
  try {
    // Phase 9b: Enrich projects with Document_1 data (keywords, industry, optimized bullets)
    const enrichedProjects = enrichProjectsWithDocument1(topProjects);
    const dynamicParagraphs = await generatePersonalizedNarrative(jdText, jdIntel, enrichedProjects, profileData, 'cover_letter');
    
    // ── DETERMINISTIC KEYWORD BOLDING ENRICHMENT ──
    // Dynamically source priority terms from JD keywords + user profile data
    let enrichedCoverLetter = dynamicParagraphs;
    const profileSkills = [
      ...(profileData?.skills || []),
      ...(profileData?.core_competencies || []),
      ...(brainData?.top_skills || []),
    ].filter(Boolean);
    const profileRecognitions = [
      ...(profileData?.recognitions || []),
      ...(profileData?.incubations || []),
      ...(brainData?.key_recognitions || []),
    ].filter(Boolean);
    const priorityTerms = new Set([
      ...(jdIntel?.all_keywords || []),
      ...(jdIntel?.role_type ? jdIntel.role_type.split(/\s+/) : []),
      ...(jdIntel?.required_skills || []),
      ...profileSkills,
      ...profileRecognitions,
    ]);

    for (const term of priorityTerms) {
      if (!term || typeof term !== 'string' || term.length < 3) continue;
      // Match word/term that is NOT immediately preceded or followed by an asterisk
      const regex = new RegExp(`(?<!\\*)\\b(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b(?!\\*)`, 'gi');
      enrichedCoverLetter = enrichedCoverLetter.replace(regex, '**$1**');
    }

    const coverLetterText = enrichedCoverLetter;

    // Generate PDF Cover Letter
    let pdfPath = null;
    try {
      const templatePath = path.join(process.cwd(), 'src', 'shared', 'templates', 'cover_letter_template.tex');
      let texTemplate = fs.readFileSync(templatePath, 'utf-8');

      // Convert markdown bold to LaTeX bold first, then escape special LaTeX characters
      let safeBody = coverLetterText
        .replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}') // Convert markdown bold to LaTeX bold
        .replace(/#/g, '\\#')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/^\s*[-*]\s+/gm, '') // Strip bullet points at start of lines
        .replace(/^\s*\d+\.\s+/gm, '') // Strip numbered lists (e.g. "1. ")
        .replace(/\*/g, ''); // Strip remaining italic markdown completely

      const safeLinkedin = (profileData.linkedin || '').replace(/#/g, '\\#').replace(/_/g, '\\_') || '\\#';
      const safePortfolio = (profileData.portfolio || '').replace(/#/g, '\\#').replace(/_/g, '\\_') || '\\#';

      // Replace variables in LaTeX template
      texTemplate = texTemplate
        .replace(/{{name}}/g, profileData.name || 'Candidate')
        .replace(/{{email}}/g, profileData.email || '')
        .replace(/{{phone}}/g, profileData.phone || '')
        .replace(/{{location}}/g, profileData.location || '')
        .replace(/{{linkedin_url}}/g, safeLinkedin)
        .replace(/{{portfolio_url}}/g, safePortfolio)
        .replace(/{{company_name}}/g, jdIntel.company_name || 'Hiring Team')
        .replace(/{{role_title}}/g, jdIntel.role_type || jdIntel.role || 'Product Manager')
        .replace(/{{body}}/g, safeBody);

      const buildDir = path.join(process.cwd(), 'build');
      const archiveDir = path.join(process.cwd(), 'generated_resumes');
      fs.mkdirSync(buildDir, { recursive: true });
      fs.mkdirSync(archiveDir, { recursive: true });

      const ddmmyyyy = `${new Date().getDate().toString().padStart(2, '0')}_${(new Date().getMonth() + 1).toString().padStart(2, '0')}_${new Date().getFullYear()}`;
      const safeName = (profileData.name || "Candidate").replace(/[^a-zA-Z0-9_\\s-]/g, '').replace(/\\s+/g, '_');
      const finalPdfName = `${safeName}_Cover_Letter_${ddmmyyyy}.pdf`;
      pdfPath = path.join(buildDir, finalPdfName);

      const pdfBuffer = await compileLatexOnline(texTemplate);
      fs.writeFileSync(pdfPath, pdfBuffer);
      fs.copyFileSync(pdfPath, path.join(archiveDir, finalPdfName));
    } catch (pdfErr) {
      console.error("Cover Letter PDF Generation Failed:", pdfErr);
    }

    return { text: coverLetterText, pdfPath };
  } catch (error) {
    console.error("Cover Letter Generator Failed:", error);
    throw error;
  }
}
