/**
 * Extracts and parses JSON from an LLM response robustly.
 * Handles markdown formatting, leading/trailing text, and plain text JSON.
 * @param {string} text - The raw response string from the LLM.
 * @returns {object|null} - The parsed JSON object, or null if parsing fails.
 */
export function parseLlmJson(text) {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text.trim();

  // Try direct parse first (fast path for valid pure JSON)
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Ignore and proceed to fallback strategies
  }

  // Strategy 1: Look for markdown code blocks ```json ... ``` or just ``` ... ```
  const blockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (blockMatch && blockMatch[1]) {
    try {
      return JSON.parse(blockMatch[1].trim());
    } catch (e) {
      // Ignore
    }
  }

  // Strategy 2: Bracket balancing (find first '{' or '[' and last '}' or ']')
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  let start = -1;
  let end = -1;

  // Determine if it looks more like an object or an array
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = lastBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = lastBracket;
  }

  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.substring(start, end + 1));
    } catch (e) {
      // Ignore
    }
  }

  // Strategy 3: Aggressive cleanup of control characters that Groq sometimes outputs
  try {
    const hyperCleaned = cleaned
      .replace(/^[^{[]*/, '') // Strip everything before first object/array
      .replace(/[^}\]]*$/, '') // Strip everything after last object/array
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Strip control characters
      
    if (hyperCleaned) {
      return JSON.parse(hyperCleaned);
    }
  } catch (e) {
    // Ultimate failure
  }

  return null;
}
