import { callLLM } from '../../services/llmRouter.js';
import { vectorBrainRetrieval } from '../../services/vectorBrain.js';
import { humanType } from './humanizer.js';

/**
 * Generative ATS Form Filler
 * Interrogates unknown textareas in an ATS (e.g. "Why do you want to work here?")
 * Queries the Obsidian vector brain for ground-truth experiences.
 * Synthesizes a truthful, perfectly tailored answer using an LLM.
 */

/**
 * Automatically detects and answers custom questions on an ATS form.
 * 
 * @param {import('playwright').Page} page 
 * @param {Object} profile The candidate's brain/profile containing projects and experiences.
 */
export async function answerCustomQuestions(page, profile) {
    console.log('[GenerativeFiller] Scanning for custom text area questions...');
    
    // Find text areas that aren't hidden
    const textareas = await page.$$('textarea:visible');
    
    if (textareas.length === 0) {
        console.log('[GenerativeFiller] No custom text areas found.');
        return;
    }

    // Uses Global LLM Engine v5 (17-tier routing)

    for (const textarea of textareas) {
        // Attempt to find the question label
        // Usually, the label is either the previous sibling, a parent, or mapped via `id`
        const id = await textarea.getAttribute('id');
        let questionText = "Unknown Question";

        if (id) {
            const label = await page.$(`label[for="${id}"]`);
            if (label) {
                questionText = await label.innerText();
            }
        }

        if (questionText === "Unknown Question") {
            // Fallback: get preceding text
            questionText = await page.evaluate(el => {
                let prev = el.previousElementSibling;
                return prev ? prev.innerText : "Describe your experience.";
            }, textarea);
        }

        // Clean up the question text
        questionText = questionText.replace(/\n/g, ' ').trim();
        console.log(`[GenerativeFiller] Found question: "${questionText}"`);

        // Check if it's already filled
        const existingValue = await textarea.inputValue();
        if (existingValue.trim().length > 0) {
            console.log(`[GenerativeFiller] Already filled, skipping.`);
            continue;
        }

        // 1. RAG Retrieval from Obsidian Brain
        // We simulate a "JD" query using the question itself to find relevant projects
        const relevantProjects = await vectorBrainRetrieval(
            questionText, 
            { all_keywords: questionText.split(' ') }, 
            profile, 
            3 // Get top 3 relevant projects
        );

        const contextDocs = relevantProjects.map(p => 
            `Project: ${p.name}\nDetails: ${p.bullets?.join('. ') || p.description}`
        ).join('\n\n');

        // 2. Synthesize Answer
        console.log(`[GenerativeFiller] Querying LLM via Router with Obsidian RAG context...`);
        try {
            const response = await callLLM('quick_apply', {
                messages: [
                    {
                        role: "system",
                        content: `You are an elite candidate applying for a job. You must answer the custom application question truthfully based ONLY on the provided Obsidian Brain context. Be concise, professional, and confident. Keep answers under 100 words. Do not use corporate buzzwords. If the context does not contain an exact answer, extrapolate your skills reasonably without lying.`
                    },
                    {
                        role: "user",
                        content: `Obsidian Context:\n${contextDocs}\n\nQuestion: ${questionText}`
                    }
                ],
                temperature: 0.3,
            });

            const answer = response.choices[0].message.content.trim();
            console.log(`[GenerativeFiller] Generated Answer: "${answer}"`);

            // 3. Humanized typing
            // Get a unique selector for the textarea to use humanType
            let selector = `textarea`;
            if (id) selector = `textarea#${id}`;
            
            await humanType(page, selector, answer);
            
            // Random pause between questions
            await page.waitForTimeout(Math.random() * 2000 + 1000);

        } catch (err) {
            console.error(`[GenerativeFiller] LLM generation failed for question: ${questionText}`, err.message);
        }
    }
}
