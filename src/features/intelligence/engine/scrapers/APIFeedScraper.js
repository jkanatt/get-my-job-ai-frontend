/**
 * API Feed Scraper — Integrates with free APIs for funding/startup data
 * ═══════════════════════════════════════════════════════════════════════
 * Targets: HackerNews, ProductHunt (public), GitHub Trending
 */

import axios from 'axios';
import crypto from 'crypto';
import { parseAmount, normalizeRoundType } from '../SourceRegistry.js';

const USER_AGENT = 'Get My Job-Intelligence/1.0';
const REQUEST_TIMEOUT = 15_000;

/**
 * Scrape HackerNews for funding-related stories.
 */
export async function scrapeHackerNews() {
  try {
    const { data: topIds } = await axios.get(
      'https://hacker-news.firebaseio.com/v0/newstories.json',
      { timeout: REQUEST_TIMEOUT }
    );

    const fundingKeywords = /\b(funding|raised|series [a-h]|seed round|venture|valuation|startup|ipo)\b/i;
    const items = [];

    // Check first 100 stories for funding-related content
    const storyIds = topIds.slice(0, 100);
    const batchSize = 10;

    for (let i = 0; i < storyIds.length; i += batchSize) {
      const batch = storyIds.slice(i, i + batchSize);
      const stories = await Promise.all(
        batch.map(id =>
          axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: REQUEST_TIMEOUT })
            .then(r => r.data)
            .catch(() => null)
        )
      );

      for (const story of stories) {
        if (!story || story.type !== 'story' || !story.title) continue;

        if (fundingKeywords.test(story.title)) {
          const fullText = `${story.title} ${story.text || ''}`;
          items.push({
            sourceId: 'hackernews',
            sourceName: 'Hacker News',
            sourceUrl: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
            title: story.title,
            description: story.text?.slice(0, 500) || '',
            publishedAt: story.time ? new Date(story.time * 1000).toISOString() : null,
            category: categorizeFundingText(fullText),
            companyName: extractCompanyFromTitle(story.title),
            funding: extractFundingInfo(fullText),
            region: 'global',
            dedupeHash: crypto.createHash('sha256').update(`hn:${story.id}`).digest('hex').slice(0, 32),
            rawData: { hnId: story.id, score: story.score, comments: story.descendants },
          });
        }
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    return { source: 'hackernews', success: true, itemCount: items.length, items };
  } catch (error) {
    return { source: 'hackernews', success: false, error: error.message, itemCount: 0, items: [] };
  }
}

/**
 * Scrape ProductHunt for recent product launches (identifies growing startups).
 */
export async function scrapeProductHunt() {
  try {
    // Use the public homepage feed (no API key needed)
    const { data: html } = await axios.get('https://www.producthunt.com/feed', {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/xml, text/xml, application/rss+xml',
      },
      responseType: 'text',
    });

    const items = [];
    // Parse as RSS if ProductHunt provides RSS, else skip gracefully
    const titleMatches = html.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g);

    for (const match of titleMatches) {
      const title = match[1];
      if (!title || title === 'Product Hunt') continue;

      items.push({
        sourceId: 'producthunt',
        sourceName: 'Product Hunt',
        sourceUrl: 'https://www.producthunt.com',
        title,
        description: '',
        publishedAt: new Date().toISOString(),
        category: 'product',
        companyName: title.split(' – ')[0]?.trim() || title.split(' - ')[0]?.trim() || title,
        funding: null,
        region: 'global',
        dedupeHash: crypto.createHash('sha256').update(`ph:${title}`).digest('hex').slice(0, 32),
        rawData: {},
      });
    }

    return { source: 'producthunt', success: true, itemCount: items.length, items };
  } catch (error) {
    return { source: 'producthunt', success: false, error: error.message, itemCount: 0, items: [] };
  }
}

/**
 * Scrape GitHub Trending to identify growing startups.
 */
export async function scrapeGitHubTrending() {
  try {
    const { data } = await axios.get('https://api.github.com/search/repositories', {
      params: {
        q: 'topic:startup topic:saas created:>2025-01-01',
        sort: 'stars',
        order: 'desc',
        per_page: 30,
      },
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const items = (data.items || []).map(repo => ({
      sourceId: 'github-trending',
      sourceName: 'GitHub Trending',
      sourceUrl: repo.html_url,
      title: `${repo.full_name}: ${repo.description || 'Trending repository'}`,
      description: repo.description || '',
      publishedAt: repo.created_at,
      category: 'product',
      companyName: repo.owner?.login || repo.full_name.split('/')[0],
      funding: null,
      region: 'global',
      dedupeHash: crypto.createHash('sha256').update(`gh:${repo.id}`).digest('hex').slice(0, 32),
      rawData: { stars: repo.stargazers_count, forks: repo.forks_count, language: repo.language },
    }));

    return { source: 'github-trending', success: true, itemCount: items.length, items };
  } catch (error) {
    return { source: 'github-trending', success: false, error: error.message, itemCount: 0, items: [] };
  }
}

/**
 * Run all API scrapers.
 */
export async function scrapeAllAPIs() {
  const results = await Promise.allSettled([
    scrapeHackerNews(),
    scrapeProductHunt(),
    scrapeGitHubTrending(),
  ]);

  return results.map(r => r.status === 'fulfilled' ? r.value : {
    source: 'unknown',
    success: false,
    error: r.reason?.message || 'Unknown error',
    itemCount: 0,
    items: [],
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────

function extractFundingInfo(text) {
  if (!text) return null;

  const amountMatch = text.match(/\$\s*([\d,.]+)\s*(million|mn|m|billion|bn|b|thousand|k)/i);
  if (!amountMatch) return null;

  const amount = parseAmount(`${amountMatch[1]} ${amountMatch[2]}`, 'usd');
  const roundMatch = text.match(/(?:series|round)\s+([a-h])/i) || text.match(/\b(seed|pre-seed|angel|bridge|ipo)\b/i);
  const round = roundMatch ? normalizeRoundType(roundMatch[1] || roundMatch[0]) : 'undisclosed';

  return { amount, amountUsd: amount, currency: 'USD', round };
}

function extractCompanyFromTitle(title) {
  if (!title) return null;
  const match = title.match(/^([A-Z][^,:;—\-]+?)\s+(?:raises?|secures?|closes?|announces?|launches?|gets?)\s/i);
  return match ? match[1].trim() : null;
}

function categorizeFundingText(text) {
  if (/\b(funding|raised|series|round|seed|investment|valuation)\b/i.test(text)) return 'funding';
  if (/\b(acquir|merger|bought|takeover)\b/i.test(text)) return 'ma';
  if (/\b(ipo|listing|public offering)\b/i.test(text)) return 'ipo';
  if (/\b(layoff|laid off|restructur|downsize)\b/i.test(text)) return 'workforce';
  if (/\b(launch|product|feature|release)\b/i.test(text)) return 'product';
  if (/\b(hir|recruit|appoint)\b/i.test(text)) return 'hiring';
  return 'other';
}
