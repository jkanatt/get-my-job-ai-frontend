// src/infrastructure/services/layoutAnalyzer.js
import fs from 'fs';
import path from 'path';
import { parseLatexLayout } from './latexParser.js';

/**
 * Intelligent Pre-Generation Layout Analysis Engine.
 * Calculates the exact physical capacity of the target LaTeX template.
 * Outputs a Layout Blueprint used to dynamically constrain AI generation.
 * 
 * @param {string} texFilePath - Path to the target LaTeX template.
 * @param {object} masterResume - The current master resume data (for structure estimates).
 * @param {boolean} enforceSinglePage - If true, restricts capacity to a single page.
 * @returns {object} The Layout Blueprint
 */
export function generateLayoutBlueprint(texFilePath, masterResume = {}, enforceSinglePage = false) {
    const layout = parseLatexLayout(texFilePath);
    if (!layout) {
        throw new Error("Failed to parse LaTeX layout constraints.");
    }

    const { paperWidthPt, textWidthPt, lineWidthPt, fontSize, fontFamily } = layout;
    
    // 1. Calculate Page Height
    // a4paper: 842.28 pt x 595.28 pt
    // letterpaper: 792 pt x 612 pt
    const isLetter = paperWidthPt > 600;
    const paperHeightPt = isLetter ? 792 : 842.28;

    // 2. Parse vertical margins from tex (assume symmetric or default 0.5in if not explicitly parsed)
    // latexParser only parsed left/right margins to get textWidthPt.
    // Let's manually do a quick pass for top/bottom margins, defaulting to 0.5in
    let topMarginIn = 0.5;
    let bottomMarginIn = 0.5;
    try {
        const content = fs.readFileSync(texFilePath, 'utf8');
        const geomMatch = content.match(/\\usepackage\[(.*?)\]\{geometry\}/);
        if (geomMatch) {
            const opts = geomMatch[1];
            const topMatch = opts.match(/top=([\d\.]+)in/);
            const botMatch = opts.match(/bottom=([\d\.]+)in/);
            const margMatch = opts.match(/margin=([\d\.]+)in/);
            if (topMatch) topMarginIn = parseFloat(topMatch[1]);
            else if (margMatch) topMarginIn = parseFloat(margMatch[1]);
            if (botMatch) bottomMarginIn = parseFloat(botMatch[1]);
            else if (margMatch) bottomMarginIn = parseFloat(margMatch[1]);
        }
    } catch (e) {
        console.warn("Could not read geometry for top/bottom margins. Defaulting to 0.5in");
    }

    const printableHeightPt = paperHeightPt - ((topMarginIn + bottomMarginIn) * 72);

    // 3. Line Height Calculation
    // LaTeX line spacing is roughly 1.2 to 1.3 times the font size
    const lineSpacingPt = fontSize * 1.3;
    const sectionSpacingPt = 15; // Space before/after \section
    const itemSpacingPt = 2; // itemsep

    // 4. Estimate Page 1 Usage
    // Page 1 usually has: Header + Summary + Experience
    // Header block (Name, Contact, Links) ~ 60pt
    const headerPt = 60;
    
    // Summary block
    // Title (Section) ~ 20pt
    const summaryTitlePt = 20 + sectionSpacingPt;
    const summaryLines = 4; // Typical summary lines
    const summaryTextPt = summaryLines * lineSpacingPt;
    const summaryBlockPt = summaryTitlePt + summaryTextPt;

    // Experience Header
    const expTitlePt = 20 + sectionSpacingPt;
    
    // Used space on Page 1 before any experience bullets
    const page1FixedUsedPt = headerPt + summaryBlockPt + expTitlePt;
    const page1AvailableExpPt = printableHeightPt - page1FixedUsedPt;

    // A single experience bullet (assuming 1 line) = lineSpacingPt + itemSpacingPt
    const singleExpBulletHeightPt = lineSpacingPt + itemSpacingPt;
    
    // Company Header Block (Company Name, Role, Date) ~ 2 lines
    const companyHeaderHeightPt = (2 * lineSpacingPt) + 5; 

    // Assuming we have 2 companies on Page 1
    const totalCompanyHeadersPt = 2 * companyHeaderHeightPt;
    
    // Bullets capacity on Page 1
    const page1AvailableBulletPt = page1AvailableExpPt - totalCompanyHeadersPt;
    const page1MaxBullets = Math.floor(page1AvailableBulletPt / singleExpBulletHeightPt);

    // 5. Estimate Page 2 Usage (if not single page)
    const page2AvailablePt = enforceSinglePage ? 0 : printableHeightPt;

    // Skills Section
    const skillsTitlePt = 20 + sectionSpacingPt;
    const skillsBlockPt = skillsTitlePt + (3 * singleExpBulletHeightPt); // Usually 3-4 lines for skills
    
    // Key Projects Section
    const projectsTitlePt = 20 + sectionSpacingPt;
    const page2FixedUsedPt = skillsBlockPt + projectsTitlePt;
    const page2AvailableProjPt = page2AvailablePt - page2FixedUsedPt;
    
    // Project Header (Title, Role/Link) ~ 1 line
    const projectHeaderHeightPt = lineSpacingPt + 5;
    
    // Total capacity on page 2 assuming P projects with B bullets each:
    // page2AvailableProjPt = P * projectHeaderHeightPt + (P * B) * singleExpBulletHeightPt
    // If we want B=3 or B=4, we can optimize.
    const projectTotalCapacityLines = Math.floor(page2AvailableProjPt / singleExpBulletHeightPt);
    
    // Let's create a dynamic blueprint to pass to LLM
    const layoutBlueprint = {
        dimensions: {
            paperWidthPt,
            paperHeightPt,
            printableHeightPt,
            lineWidthPt,
            fontSize,
            fontFamily,
            lineSpacingPt,
            singleExpBulletHeightPt,
            projectHeaderHeightPt
        },
        constraints: {
            page_1: {
                total_pt: printableHeightPt,
                fixed_used_pt: page1FixedUsedPt,
                available_exp_pt: page1AvailableExpPt,
                estimated_exp_bullet_capacity: Math.max(0, page1MaxBullets)
            },
            page_2: {
                allowed: !enforceSinglePage,
                total_pt: page2AvailablePt,
                fixed_used_pt: page2FixedUsedPt,
                available_proj_pt: page2AvailableProjPt,
                estimated_proj_line_capacity: Math.max(0, projectTotalCapacityLines)
            }
        },
        guidelines: {
            // Target character length for a single line using Helvetica 11pt is ~85-90 characters.
            // But we pass the strict PT width for the LLM prompts.
            max_chars_per_line_estimate: Math.floor(lineWidthPt / 5),
            orphan_threshold_chars: 10
        }
    };

    return layoutBlueprint;
}
