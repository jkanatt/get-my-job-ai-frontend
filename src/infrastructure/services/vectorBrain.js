import { calculateTfIdfSimilarity } from '../../features/jobs/utils/nlpScorer.js';

// Fix #5: LRU-bounded cache with 1hr TTL to prevent OOM and stale embeddings
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 3600000; // 1 hour
const vectorCache = new Map();

function cacheSet(key, value) {
  if (vectorCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry (first key in Map iteration order)
    const firstKey = vectorCache.keys().next().value;
    vectorCache.delete(firstKey);
  }
  vectorCache.set(key, { value, timestamp: Date.now() });
}

function cacheGet(key) {
  const entry = vectorCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    vectorCache.delete(key);
    return undefined;
  }
  return entry.value;
}

// Phase 7: Gemini Embeddings — rotates across all available keys
let _embeddingKeyIndex = 0;
function getGeminiApiKey() {
  const keys = [
    process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter(Boolean);
  if (keys.length === 0) return null;
  const key = keys[_embeddingKeyIndex % keys.length];
  _embeddingKeyIndex++;
  return key;
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Phase 7: Gemini batch embedding using text-embedding-004.
 * Falls back to TF-IDF if no GEMINI_API_KEY is available.
 * Gemini's embedding endpoint supports batch requests natively.
 */
async function batchGetEmbeddings(texts) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.warn('[VectorBrain] No GEMINI_API_KEY set. Falling back to TF-IDF only.');
    return texts.map(() => null);
  }

  // Separate cached vs uncached
  const results = new Array(texts.length).fill(null);
  const uncachedIndices = [];
  const uncachedTexts = [];

  for (let i = 0; i < texts.length; i++) {
    const cached = cacheGet(texts[i]);
    if (cached !== undefined) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  if (uncachedTexts.length === 0) return results;

  try {
    // Gemini batchEmbedContents API — single request for all texts
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`;
    
    const requestBody = {
      requests: uncachedTexts.map(text => ({
        model: 'models/text-embedding-004',
        content: { parts: [{ text: text.substring(0, 8000) }] },  // Cap at 8000 chars
        taskType: 'SEMANTIC_SIMILARITY'
      }))
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Embeddings API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const embeddings = data.embeddings || [];

    for (let j = 0; j < embeddings.length; j++) {
      const embedding = embeddings[j].values;
      const originalIndex = uncachedIndices[j];
      results[originalIndex] = embedding;
      cacheSet(uncachedTexts[j], embedding);
    }
    
    console.log(`[VectorBrain] Gemini embedded ${uncachedTexts.length} texts successfully.`);
  } catch (error) {
    console.error("[VectorBrain] Gemini embedding failed:", error.message);
    // Results will remain null for failed embeddings — fallback to TF-IDF only
  }

  return results;
}

/**
 * Agent 5: Vector RAG ("The Infinite Brain")
 * Dynamically retrieves the best projects and experience chunks using Cosine Similarity
 * ensuring 0% data loss for massive Obsidian Brains.
 * 
 * Fix #6: Uses a single batched embedding API call instead of N sequential calls.
 */
export async function vectorBrainRetrieval(jdText, jdIntel, brain, maxResults = 50) {
  const allKeywords = jdIntel.all_keywords || [];
  const projects = brain.projects || [];

  // Build all texts to embed (JD + all projects) in one array
  const projectTexts = projects.map(project =>
    `${project.name} ${project.subtitle || ''} ${(project.bullets || []).join(' ')} ${(project.searchable_keywords || []).join(' ')}`
  );

  // Single batched API call: [jdText, ...projectTexts]
  const allTexts = [jdText, ...projectTexts];
  const allEmbeddings = await batchGetEmbeddings(allTexts);
  const jdEmbedding = allEmbeddings[0];

  const rankedProjects = [];
  
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const projectContent = projectTexts[i];
    const projectEmbedding = allEmbeddings[i + 1]; // offset by 1 because JD is at index 0

    // 1. Keyword overlap (with normalization for better matching)
    let keywordScore = 0;
    const projectLower = projectContent.toLowerCase();
    for (const kw of allKeywords) {
      // Normalize: strip hyphens, extra spaces for fuzzy matching
      const normalizedKw = kw.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
      if (normalizedKw.length < 2) continue;
      if (projectLower.includes(normalizedKw)) {
        keywordScore += 0.5;
      } else {
        // Try individual words for multi-word keywords (e.g., "product management" → "product" + "management")
        const words = normalizedKw.split(' ');
        if (words.length > 1 && words.every(w => w.length > 2 && projectLower.includes(w))) {
          keywordScore += 0.3; // Partial match — all words present but not as a phrase
        }
      }
    }
    
    // 2. TF-IDF Semantic Similarity (Fallback)
    const tfidfScore = calculateTfIdfSimilarity(jdText, projectContent) * 10;
    
    // 3. Vector Similarity (from batched embeddings)
    let vectorScore = 0;
    if (jdEmbedding && projectEmbedding) {
      vectorScore = cosineSimilarity(jdEmbedding, projectEmbedding) * 15;
    }
    
    // 4. Pre-computed ATS Evaluation Score (from Document 2)
    const baseEvaluationScore = project.evaluation_score || 0;
    
    // 5. Explicit Domain Matching (Deep Fix for Domain Priority)
    let domainScore = 0;
    if (jdIntel.domain) {
      const domainKeywords = jdIntel.domain.toLowerCase().split(/[\s/|,]+/).filter(w => w.length > 3 && !['and', 'the', 'with', 'for'].includes(w));
      const projectIndustryLower = (project.subtitle || '') + ' ' + (project.industry_context || '');
      for (const dw of domainKeywords) {
        if (projectIndustryLower.toLowerCase().includes(dw)) {
          domainScore += 15; // Massive boost for matching the target domain (e.g. FinTech)
        }
      }
    }

    // Heavily weight the pre-computed evaluation score and domain score
    const combinedScore = keywordScore + tfidfScore + vectorScore + (baseEvaluationScore * 0.5) + domainScore;
    
    rankedProjects.push({
      ...project,
      vector_score: vectorScore,
      keyword_score: keywordScore,
      tfidf_score: tfidfScore,
      evaluation_score: baseEvaluationScore,
      combined_score: combinedScore
    });
  }
  
  // Sort and take up to maxResults (capped at 50) based on actual project pool size
  rankedProjects.sort((a, b) => b.combined_score - a.combined_score);
  return rankedProjects.slice(0, Math.min(maxResults, projects.length));
}
