/**
 * QueryParser.js — Intelligent Query Understanding Engine
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Phase 2, Step 4 of the Get My Job Retrieval Engine v4 Blueprint.
 *
 * Features:
 *   - Fuzzy matching (Damerau-Levenshtein, max edit distance 2)
 *   - Synonym expansion via nlpScorer's SYNONYM_CLUSTERS
 *   - Acronym resolution (bidirectional via NGramTokenizer)
 *   - Phrase detection for compound terms
 *   - Query weighting (must_have: 3x, preferred: 2x, implied: 1x)
 *   - Domain-aware query expansion
 */

import natural from 'natural';
import { tokenize, ACRONYM_MAP } from './NGramTokenizer.js';
import { expandSynonyms } from '../../features/jobs/utils/nlpScorer.js';

const DamerauLevenshtein = natural.DamerauLevenshteinDistance;

// ═══════════════════════════════════════════════════════════════════════════
// QueryParser Class
// ═══════════════════════════════════════════════════════════════════════════

export class QueryParser {
  /**
   * @param {Object} [config]
   * @param {number} [config.maxFuzzyDistance=2]
   * @param {boolean} [config.expandSynonyms=true]
   * @param {boolean} [config.expandAcronyms=true]
   */
  constructor(config = {}) {
    this.maxFuzzyDistance = config.maxFuzzyDistance ?? 2;
    this.enableSynonymExpansion = config.expandSynonyms ?? true;
    this.enableAcronymExpansion = config.expandAcronyms ?? true;
  }

  /**
   * Parse and expand a query (JD text or search query) into a structured query object.
   *
   * @param {string} queryText - Raw query text
   * @param {Object} [jdIntel] - Optional structured JD intelligence (role_type, domain, etc.)
   * @returns {ParsedQuery}
   */
  parse(queryText, jdIntel = null) {
    if (!queryText || typeof queryText !== 'string') {
      return this._emptyQuery();
    }

    // Step 1: Base tokenization (includes ngrams, acronym expansion)
    const baseTokens = tokenize(queryText, {
      stem: true,
      domain: 'general',
      expandAcronyms: this.enableAcronymExpansion,
      includeNGrams: true,
    });

    // Step 2: Extract raw keywords for synonym expansion (unstemmed)
    const rawTokens = tokenize(queryText, {
      stem: false,
      domain: 'general',
      expandAcronyms: false,
      includeNGrams: false,
    });

    // Step 3: Synonym expansion
    let expandedTokens = [];
    if (this.enableSynonymExpansion) {
      const synonyms = expandSynonyms(rawTokens);
      // Tokenize the synonym expansions too
      expandedTokens = synonyms
        .filter((s) => !rawTokens.includes(s))
        .flatMap((s) => tokenize(s, { stem: true, includeNGrams: false }));
    }

    // Step 4: Domain expansion from jdIntel
    let domainTokens = [];
    if (jdIntel?.domain) {
      domainTokens = this._expandDomain(jdIntel.domain);
    }

    // Step 5: Tiered weighting
    const tiered = this._buildTiers(baseTokens, expandedTokens, domainTokens, jdIntel);

    // Step 6: Combine into final query
    const allTokens = [
      ...tiered.must_have,
      ...tiered.preferred,
      ...tiered.implied,
      ...tiered.expanded,
    ];

    return {
      tokens: allTokens,
      baseTokens,
      tiers: tiered,
      metadata: {
        roleType: jdIntel?.role_type || this._detectRoleType(queryText),
        domain: jdIntel?.domain || this._detectDomain(queryText),
        originalLength: queryText.length,
        tokenCount: allTokens.length,
        expansionCount: expandedTokens.length + domainTokens.length,
      },
    };
  }

  /**
   * Fuzzy match a query term against a vocabulary.
   * Returns matches within the configured edit distance.
   *
   * @param {string} queryTerm
   * @param {string[]} vocabulary
   * @returns {Array<{term: string, distance: number, score: number}>}
   */
  fuzzyMatch(queryTerm, vocabulary) {
    const results = [];

    for (const vocabTerm of vocabulary) {
      // Skip if lengths differ too much (quick pruning)
      if (Math.abs(queryTerm.length - vocabTerm.length) > this.maxFuzzyDistance) {
        continue;
      }

      const distance = DamerauLevenshtein(queryTerm, vocabTerm);
      if (distance <= this.maxFuzzyDistance) {
        results.push({
          term: vocabTerm,
          distance,
          score: 1.0 - distance * 0.3, // 0 edits = 1.0, 1 = 0.7, 2 = 0.4
        });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Expand a query with fuzzy matches from the index vocabulary.
   *
   * @param {ParsedQuery} parsedQuery
   * @param {string[]} indexVocabulary - All terms in the inverted index
   * @returns {ParsedQuery} Query with fuzzy-matched terms added
   */
  expandWithFuzzyMatches(parsedQuery, indexVocabulary) {
    const fuzzyTerms = [];

    for (const token of parsedQuery.baseTokens) {
      // Only fuzzy-match tokens that don't have exact matches in the index
      if (!indexVocabulary.includes(token)) {
        const matches = this.fuzzyMatch(token, indexVocabulary);
        for (const match of matches) {
          if (match.distance > 0 && match.distance <= this.maxFuzzyDistance) {
            fuzzyTerms.push(match.term);
          }
        }
      }
    }

    if (fuzzyTerms.length > 0) {
      parsedQuery.tiers.expanded.push(...fuzzyTerms);
      parsedQuery.tokens.push(...fuzzyTerms);
      parsedQuery.metadata.fuzzyMatchCount = fuzzyTerms.length;
    }

    return parsedQuery;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Internal Helpers
  // ═══════════════════════════════════════════════════════════════════════

  _buildTiers(baseTokens, expandedTokens, domainTokens, jdIntel) {
    const mustHaveKeywords = jdIntel?.must_have_keywords || [];
    const preferredKeywords = jdIntel?.preferred_keywords || [];

    const mustHaveSet = new Set(mustHaveKeywords.map((k) => k.toLowerCase()));
    const preferredSet = new Set(preferredKeywords.map((k) => k.toLowerCase()));

    const must_have = [];
    const preferred = [];
    const implied = [];

    for (const token of baseTokens) {
      if (mustHaveSet.has(token)) {
        // Must-have tokens get added 3 times (3x weight via repetition)
        must_have.push(token, token, token);
      } else if (preferredSet.has(token)) {
        preferred.push(token, token);
      } else {
        implied.push(token);
      }
    }

    return {
      must_have,
      preferred,
      implied,
      expanded: [...expandedTokens, ...domainTokens],
    };
  }

  _expandDomain(domain) {
    const domainLower = domain.toLowerCase();
    const DOMAIN_EXPANSION = {
      fintech: ['payment', 'banking', 'lending', 'credit', 'upi', 'kyc', 'aml', 'compliance', 'financial'],
      cybersecurity: ['security', 'threat', 'vulnerability', 'siem', 'soc', 'penetration', 'encryption', 'compliance'],
      saas: ['subscription', 'mrr', 'arr', 'churn', 'multi-tenant', 'self-serve', 'b2b', 'enterprise'],
      healthcare: ['clinical', 'patient', 'hipaa', 'ehr', 'telehealth', 'medical', 'pharma'],
      edtech: ['education', 'learning', 'lms', 'student', 'curriculum', 'course'],
      ecommerce: ['shopping', 'cart', 'checkout', 'order', 'fulfillment', 'catalog', 'marketplace'],
    };

    for (const [key, expansions] of Object.entries(DOMAIN_EXPANSION)) {
      if (domainLower.includes(key)) {
        return expansions;
      }
    }

    return [];
  }

  _detectRoleType(text) {
    const textLower = text.toLowerCase();
    if (textLower.includes('product manager') || textLower.includes('product management') || /\bpm\b/.test(textLower) || /\bapm\b/.test(textLower) || textLower.includes('product lead')) return 'pm';
    if (textLower.includes('engineer') || textLower.includes('developer') || textLower.includes('swe') || textLower.includes('programmer')) return 'engineer';
    if (textLower.includes('designer') || textLower.includes('ux') || textLower.includes('ui/ux')) return 'designer';
    if (textLower.includes('marketing') || textLower.includes('growth') || textLower.includes('demand gen')) return 'marketer';
    if (textLower.includes('sales') || textLower.includes('account executive') || /\bbdr\b/.test(textLower) || /\bsdr\b/.test(textLower)) return 'sales';
    if (textLower.includes('data scientist') || textLower.includes('data analyst') || textLower.includes('ml engineer') || textLower.includes('data engineer')) return 'data';
    if (textLower.includes('director') || textLower.includes('vp') || textLower.includes('head of') || textLower.includes('chief')) return 'executive';
    return 'default';
  }

  _detectDomain(text) {
    const textLower = text.toLowerCase();
    const DOMAIN_SIGNALS = {
      fintech: ['fintech', 'payment', 'banking', 'upi', 'lending', 'credit'],
      cybersecurity: ['security', 'cybersecurity', 'threat', 'vulnerability', 'soc'],
      saas: ['saas', 'b2b', 'subscription', 'multi-tenant'],
      healthcare: ['health', 'clinical', 'patient', 'hipaa', 'medical'],
      edtech: ['edtech', 'education', 'learning', 'lms', 'student'],
      ecommerce: ['ecommerce', 'e-commerce', 'marketplace', 'shopping'],
    };

    let bestDomain = null;
    let bestCount = 0;
    for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
      const count = signals.filter((s) => textLower.includes(s)).length;
      if (count > bestCount) {
        bestCount = count;
        bestDomain = domain;
      }
    }

    return bestDomain;
  }

  _emptyQuery() {
    return {
      tokens: [],
      baseTokens: [],
      tiers: { must_have: [], preferred: [], implied: [], expanded: [] },
      metadata: { roleType: 'default', domain: null, originalLength: 0, tokenCount: 0, expansionCount: 0 },
    };
  }
}
