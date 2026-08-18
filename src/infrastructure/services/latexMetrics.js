// src/infrastructure/services/latexMetrics.js

const HELVETICA_METRICS = {
    'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722, 'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667, 'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667, 'Y': 667, 'Z': 611,
    'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556, 'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556, 'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500, 'y': 500, 'z': 500,
    '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
    ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, '\'': 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015, '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556, '`': 333, '{': 333, '|': 260, '}': 333, '~': 584
};

/**
 * Calculates the visual width of a text string in points (pt).
 * @param {string} text - The string to measure (Markdown ** will be stripped).
 * @param {string} font - Font name (e.g., 'Helvetica').
 * @param {number} fontSize - Font size in pt (e.g., 11).
 * @returns {number} Width in points (pt).
 */
export function measureTextWidth(text, font = 'Helvetica', fontSize = 11) {
    if (!text) return 0;
    
    // Strip markdown bolding for measurement
    const cleanText = text.replace(/\*\*/g, '');
    
    // Default to Helvetica if unknown font
    const metrics = (font.toLowerCase() === 'helvetica') ? HELVETICA_METRICS : HELVETICA_METRICS;
    
    let totalWidthUpm = 0;
    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        totalWidthUpm += (metrics[char] !== undefined) ? metrics[char] : 500; // Default 500 upm for unknown
    }
    
    // Convert UPM (Units Per Em, usually 1000) to points
    return (totalWidthUpm / 1000) * fontSize;
}
