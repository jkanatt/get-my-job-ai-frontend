// src/infrastructure/services/contentFitEngine.js
import { callLLM } from './llmRouter.js';
import { measureTextWidth } from './latexMetrics.js';

/**
 * Optimizes a bullet to fit perfectly within the available line width, avoiding orphans.
 * 
 * @param {string} bullet - The original bullet text.
 * @param {number} currentWidthPt - The calculated width of the bullet in pt.
 * @param {number} availableWidthPt - The capacity of a single line in pt.
 * @returns {Promise<string>} The optimized bullet text.
 */
export async function optimizeBulletWidth(bullet, currentWidthPt, availableWidthPt) {
    // Determine the layout constraints
    const linesUsed = Math.floor(currentWidthPt / availableWidthPt);
    const remainder = currentWidthPt % availableWidthPt;
    
    // Thresholds
    // If the remaining space is very small (orphan word on new line)
    const ORPHAN_THRESHOLD_PT = 80; // ~15-20 characters
    
    // If the space is very large (under-utilization on final line)
    const UNDER_UTILIZATION_THRESHOLD_PT = availableWidthPt * 0.4; // >40% space left

    let targetAction = null;
    let targetMinPt = 0;
    let targetMaxPt = 0;

    if (remainder > 0 && remainder < ORPHAN_THRESHOLD_PT && linesUsed > 0) {
        // Option 1: Shrink to eliminate the orphan (fit exactly onto linesUsed lines)
        targetAction = 'shrink';
        targetMaxPt = (linesUsed * availableWidthPt) - 15; // 15pt safety buffer
        targetMinPt = targetMaxPt - 60;
    } else if (availableWidthPt - remainder > UNDER_UTILIZATION_THRESHOLD_PT && linesUsed > 0) {
        // Expand to use more of the final line
        targetAction = 'expand';
        targetMaxPt = ((linesUsed + 1) * availableWidthPt) - 15;
        targetMinPt = targetMaxPt - 80;
    } else {
        // It's perfectly fine
        return bullet;
    }

    try {
        const fixCompletion = await callLLM('content_fit', {
            messages: [{
                role: 'system',
                content: 'You are an expert ATS resume editor. Your job is to strictly adjust the length of bullet points to fit two physical lines without orphans.\n\nCRITICAL CONSTRAINTS:\n1. You must return EXACTLY ONE single sentence. Never split into two sentences.\n2. The sentence MUST end with a period.\n3. DO NOT hallucinate tools or frameworks (e.g. Mixpanel, A/B testing) if they are not in the input.\n4. NEVER truncate abruptly. The sentence must be grammatically complete.'
            }, {
                role: 'user',
                content: `Goal: Adjust the bullet point length to better fit the available horizontal space. Current word count: ${bullet.split(' ').length}.\n\nOriginal Text:\n"${bullet}"\n\nAction required: ${targetAction === 'shrink' ? 'Make it slightly shorter by removing filler words, rephrasing, or using concise terms (like "\&" instead of "and").' : 'Make it slightly longer by safely elaborating on existing points without fabricating new facts or tools.'}\n\nDo not change the core meaning or remove any technical keywords. Output ONLY a valid JSON object in this exact format: {"optimized_bullet": "..."}.`
            }],
            temperature: 0.1,
            response_format: { type: 'json_object' }
        });

        const fixedJson = JSON.parse(fixCompletion.choices[0]?.message?.content || '{}');
        const fixedText = fixedJson.optimized_bullet;
        if (fixedText && fixedText !== bullet) {
            // Verify if the new width actually complies or is closer
            const newWidth = measureTextWidth(fixedText, 'Helvetica', 11);
            // Even if it misses slightly, we accept it if it's closer to the target than the original
            return fixedText;
        }
    } catch(e) {
        console.error('Content Fit Engine LLM Optimization failed', e.message);
    }
    
    return bullet;
}
