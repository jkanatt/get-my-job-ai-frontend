// src/infrastructure/services/latexParser.js
import fs from 'fs';

/**
 * Parses a LaTeX file to extract layout configurations.
 * Supports a4paper/letterpaper and standard geometry margin configs.
 */
export function parseLatexLayout(texFilePath) {
    let content = '';
    try {
        content = fs.readFileSync(texFilePath, 'utf8');
    } catch (err) {
        console.error('Failed to read LaTeX file', err);
        return null;
    }

    // Default A4 paper in points
    let paperWidthPt = 595.28; 
    let fontSize = 11;
    let fontFamily = 'Helvetica';

    // Parse Document Class options
    const docClassMatch = content.match(/\\documentclass\[(.*?)\]\{(.*?)\}/);
    if (docClassMatch) {
        const opts = docClassMatch[1].split(',');
        if (opts.includes('letterpaper')) paperWidthPt = 612; // 8.5 * 72
        if (opts.includes('10pt')) fontSize = 10;
        if (opts.includes('11pt')) fontSize = 11;
        if (opts.includes('12pt')) fontSize = 12;
    }

    // Parse Geometry
    // \usepackage[left=0.5in,right=0.5in,top=0.5in,bottom=0.5in]{geometry}
    let marginLeftIn = 1.0;
    let marginRightIn = 1.0;
    const geomMatch = content.match(/\\usepackage\[(.*?)\]\{geometry\}/);
    if (geomMatch) {
        const geomOpts = geomMatch[1];
        const leftMatch = geomOpts.match(/left=([\d\.]+)in/);
        const rightMatch = geomOpts.match(/right=([\d\.]+)in/);
        const marginMatch = geomOpts.match(/margin=([\d\.]+)in/);
        
        if (leftMatch) marginLeftIn = parseFloat(leftMatch[1]);
        else if (marginMatch) marginLeftIn = parseFloat(marginMatch[1]);

        if (rightMatch) marginRightIn = parseFloat(rightMatch[1]);
        else if (marginMatch) marginRightIn = parseFloat(marginMatch[1]);
    }

    // Calculate absolute text width
    const textWidthPt = paperWidthPt - ((marginLeftIn + marginRightIn) * 72);

    // Parse enumitem for itemize
    // \begin{itemize}[leftmargin=*,itemsep=2pt]
    // Usually itemize adds about 15-20pt of indentation and label separation
    const itemizeIndentPt = 20;
    const lineWidthPt = textWidthPt - itemizeIndentPt;

    return {
        paperWidthPt,
        textWidthPt,
        lineWidthPt,
        fontSize,
        fontFamily
    };
}
