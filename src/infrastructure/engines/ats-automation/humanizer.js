import { createCursor } from 'ghost-cursor';

/**
 * Humanizer Module for Playwright
 * Simulates human interaction (mouse movements, randomized typing cadences)
 * to bypass behavioral bot detection (e.g., Cloudflare, DataDome).
 */

/**
 * Initializes a human-like cursor on the page.
 * @param {import('playwright').Page} page
 * @returns {Object} The ghost cursor instance
 */
export async function setupHumanCursor(page) {
    // createCursor takes a page and generates bezier curves for mouse movements
    const cursor = createCursor(page);
    return cursor;
}

/**
 * Types text into an element with a randomized, human-like cadence.
 * Uses a normal distribution around the base delay, occasionally making small pauses.
 * 
 * @param {import('playwright').Page} page 
 * @param {string} selector 
 * @param {string} text 
 */
export async function humanType(page, selector, text) {
    // Focus the element first
    await page.focus(selector);
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // Base delay of 75ms, with a random variation of +/- 30ms
        const baseDelay = 75;
        const variation = Math.floor(Math.random() * 60) - 30;
        let delay = baseDelay + variation;

        // 1% chance to simulate a "thinking" pause (300-800ms)
        if (Math.random() < 0.01) {
            delay += Math.floor(Math.random() * 500) + 300;
        }

        await page.keyboard.type(char, { delay });
    }
}

/**
 * Clicks an element using the ghost cursor for realistic mouse trajectory.
 * 
 * @param {Object} cursor The ghost cursor instance
 * @param {string} selector The selector to click
 */
export async function humanClick(cursor, selector) {
    // ghost-cursor will move the mouse naturally and then click
    await cursor.click(selector);
}
