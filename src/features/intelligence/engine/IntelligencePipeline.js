/**
 * Intelligence Pipeline — Full End-to-End Orchestrator
 * ═══════════════════════════════════════════════════════════════════════
 * Coordinates: Scrapers → EntityResolver → Deduplicator → Verifier → DB
 *
 * Sources (8 connectors):
 *   RSS (12 feeds) → API (HN, PH, GH) → Web (Cheerio) → AI (ScrapeGraph)
 *   → SEC EDGAR (Form D) → GDELT (Global events) → NewsAPI → Company Websites
 *
 * Enrichment: Startup India / DPIIT registry
 * Fallback: LLM extraction via local gateway
 */

import { createClient } from '@supabase/supabase-js';
import { RSS_SOURCES, WEB_SOURCES } from './SourceRegistry.js';
import { scrapeAllRSSFeeds } from './scrapers/RSSFeedScraper.js';
import { scrapeAllAPIs } from './scrapers/APIFeedScraper.js';
import { scrapeAllWebSources } from './scrapers/WebScraper.js';
import { scrapeAllSECEdgar } from './scrapers/SECEdgarConnector.js';
import { scrapeAllGDELT } from './scrapers/GDELTConnector.js';
import { scrapeAllNewsAPI } from './scrapers/NewsAPIConnector.js';
import { scrapeCompanyWebsites } from './scrapers/CompanyWebsiteSource.js';
import { scrapeAllIndiaFunding } from './scrapers/IndiaFundingScrapers.js';
import { scrapeAllGlobalFunding } from './scrapers/GlobalFundingScrapers.js';
import { enrichWithDPIIT } from './scrapers/StartupIndiaConnector.js';
import { resolveCompany, normalizeInvestorName } from './EntityResolver.js';
import { deduplicateEvents, mergeNearDuplicates } from './EventDeduplicator.js';
import { verifyBatch, crossVerifyFunding } from './VerificationEngine.js';
import { matchCompanyToJobs, generateSignals } from './HiringAnalyzer.js';
import { toUSD, detectCurrency } from './CurrencyNormalizer.js';
import { extractFundingWithLLM, extractBatchCompanyNames, isGatewayAvailable } from './LLMExtractor.js';
import { withRetry, getSourceHealth, configureRateLimit } from './RetryPolicy.js';

/**
 * Get a service-role Supabase client for write operations.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials for intelligence pipeline');
  return createClient(url, key);
}

/**
 * Run the complete intelligence pipeline.
 *
 * @param {object} options
 * @param {string[]} options.sources - Which source types to run: ['rss', 'api', 'web', 'edgar', 'gdelt', 'newsapi', 'company-site']
 * @param {string} options.region - Filter by region: 'india' | 'global' | null
 * @param {boolean} options.useLLMFallback - Use LLM for ambiguous extractions
 * @param {boolean} options.dryRun - Log but don't store results
 * @returns {Promise<object>} Pipeline execution results
 */
export async function runPipeline(options = {}) {
  const {
    sources = ['rss', 'api', 'web'],
    region = null,
    useLLMFallback = true,
    dryRun = false,
  } = options;
  const startTime = Date.now();
  const supabase = getServiceClient();

  const stats = {
    startedAt: new Date().toISOString(),
    sourcesRun: 0,
    rawItemsCollected: 0,
    afterDedup: 0,
    companiesResolved: 0,
    companiesCreated: 0,
    fundingRoundsStored: 0,
    newsEventsStored: 0,
    errors: [],
  };

  console.log('[Pipeline] ═══ Intelligence Pipeline Starting ═══');

  try {
    // ── Step 1: Scrape all sources ──────────────────────────────────
    console.log('[Pipeline] Step 1: Scraping sources...');
    let allItems = [];

    if (sources.includes('rss')) {
      const rssResults = await scrapeAllRSSFeeds(
        region ? RSS_SOURCES.filter(s => s.region === region || s.region === 'both') : RSS_SOURCES
      );
      for (const r of rssResults) {
        if (r.success) allItems.push(...r.items);
        else stats.errors.push({ source: r.source, error: r.error });
      }
      stats.sourcesRun += rssResults.length;
    }

    if (sources.includes('api')) {
      const apiResults = await scrapeAllAPIs();
      for (const r of apiResults) {
        if (r.success) allItems.push(...r.items);
        else stats.errors.push({ source: r.source, error: r.error });
      }
      stats.sourcesRun += apiResults.length;
    }

    if (sources.includes('web')) {
      const webSources = region
        ? WEB_SOURCES.filter(s => s.region === region || s.region === 'both')
        : WEB_SOURCES;
      const webResults = await scrapeAllWebSources(webSources);
      for (const r of webResults) {
        if (r.success) allItems.push(...r.items);
        else stats.errors.push({ source: r.source, error: r.error });
      }
      stats.sourcesRun += webResults.length;
    }

    // ── New connectors: SEC EDGAR ──
    if (sources.includes('edgar')) {
      try {
        const edgarResults = await withRetry('sec-edgar', () => scrapeAllSECEdgar());
        for (const r of edgarResults) {
          if (r.success) allItems.push(...r.items);
          else stats.errors.push({ source: r.source, error: r.error });
        }
        stats.sourcesRun += 1;
        console.log(`[Pipeline] SEC EDGAR: +${edgarResults[0]?.count || 0} items`);
      } catch (err) {
        stats.errors.push({ source: 'sec-edgar', error: err.message });
      }
    }

    // ── New connectors: GDELT 2.0 ──
    if (sources.includes('gdelt')) {
      try {
        const gdeltResults = await withRetry('gdelt', () => scrapeAllGDELT());
        for (const r of gdeltResults) {
          if (r.success) allItems.push(...r.items);
          else stats.errors.push({ source: r.source, error: r.error });
        }
        stats.sourcesRun += 1;
        console.log(`[Pipeline] GDELT: +${gdeltResults[0]?.count || 0} items`);
      } catch (err) {
        stats.errors.push({ source: 'gdelt', error: err.message });
      }
    }

    // ── New connectors: NewsAPI ──
    if (sources.includes('newsapi')) {
      try {
        const newsapiResults = await withRetry('newsapi', () => scrapeAllNewsAPI());
        for (const r of newsapiResults) {
          if (r.success) allItems.push(...r.items);
          else stats.errors.push({ source: r.source, error: r.error });
        }
        stats.sourcesRun += 1;
        console.log(`[Pipeline] NewsAPI: +${newsapiResults[0]?.count || 0} items`);
      } catch (err) {
        stats.errors.push({ source: 'newsapi', error: err.message });
      }
    }

    // ── New connectors: India Web Scrapers ──
    if (sources.includes('india-web')) {
      try {
        const indiaResults = await withRetry('india-web', () => scrapeAllIndiaFunding());
        for (const r of indiaResults) {
          if (r.success) allItems.push(...r.items);
          else stats.errors.push({ source: r.source, error: r.error });
        }
        stats.sourcesRun += indiaResults.length;
        const totalIndiaItems = indiaResults.reduce((sum, r) => sum + (r.count || 0), 0);
        console.log(`[Pipeline] India Web: +${totalIndiaItems} items from ${indiaResults.length} scrapers`);
      } catch (err) {
        stats.errors.push({ source: 'india-web', error: err.message });
      }
    }

    // ── New connectors: Global Web Scrapers ──
    if (sources.includes('global-web')) {
      try {
        const globalResults = await withRetry('global-web', () => scrapeAllGlobalFunding());
        for (const r of globalResults) {
          if (r.success) allItems.push(...r.items);
          else stats.errors.push({ source: r.source, error: r.error });
        }
        stats.sourcesRun += globalResults.length;
        const totalGlobalItems = globalResults.reduce((sum, r) => sum + (r.count || 0), 0);
        console.log(`[Pipeline] Global Web: +${totalGlobalItems} items from ${globalResults.length} scrapers`);
      } catch (err) {
        stats.errors.push({ source: 'global-web', error: err.message });
      }
    }

    // ── Currency normalization pass ──
    console.log('[Pipeline] Normalizing currencies...');
    for (const item of allItems) {
      if (item.funding && item.funding.amount && !item.funding.amountUsd) {
        const currency = item.funding.currency || detectCurrency(`${item.title} ${item.description}`);
        const { amountUsd } = toUSD(item.funding.amount, '', currency);
        item.funding.amountUsd = amountUsd;
        item.funding.currency = currency;
      }
    }

    stats.rawItemsCollected = allItems.length;
    console.log(`[Pipeline] Collected ${allItems.length} raw items from ${stats.sourcesRun} sources`);

    if (allItems.length === 0) {
      console.log('[Pipeline] No items collected. Pipeline complete.');
      return { ...stats, duration: Date.now() - startTime };
    }

    // ── Step 1.5: LLM Company Name Enrichment ────────────────────────
    // Items with null companyName get sent to LLM for extraction
    if (useLLMFallback) {
      const gatewayUp = await isGatewayAvailable();
      if (gatewayUp) {
        const nullNameItems = allItems.filter(item => !item.companyName);
        if (nullNameItems.length > 0) {
          console.log(`[Pipeline] Step 1.5: LLM extracting company names for ${nullNameItems.length} items...`);
          try {
            const extracted = await extractBatchCompanyNames(
              nullNameItems.map(i => ({ title: i.title, description: i.description }))
            );
            nullNameItems.forEach((item, idx) => {
              if (extracted[idx]) {
                item.companyName = extracted[idx];
                item._llmExtracted = true;
              }
            });
            const fixed = extracted.filter(Boolean).length;
            console.log(`[Pipeline] LLM fixed ${fixed}/${nullNameItems.length} company names`);
          } catch (err) {
            console.warn('[Pipeline] LLM batch extraction failed:', err.message);
          }
        }
      } else {
        console.log('[Pipeline] LLM gateway unavailable, skipping name enrichment');
      }
    }

    // ── Step 2: Deduplicate ─────────────────────────────────────────
    console.log('[Pipeline] Step 2: Deduplicating...');
    let dedupedItems = deduplicateEvents(allItems);
    dedupedItems = mergeNearDuplicates(dedupedItems);
    stats.afterDedup = dedupedItems.length;
    console.log(`[Pipeline] ${allItems.length} → ${dedupedItems.length} after dedup`);

    // ── Step 3: Verify ──────────────────────────────────────────────
    console.log('[Pipeline] Step 3: Verifying...');
    const verifiedItems = verifyBatch(dedupedItems);

    // ── Step 4: Resolve entities and store ───────────────────────────
    console.log('[Pipeline] Step 4: Resolving entities and storing...');

    // Fetch existing companies for entity resolution
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('id, canonical_name, aliases, website, slug');

    const companiesCache = existingCompanies || [];

    for (const item of verifiedItems) {
      try {
        // Resolve company
        let companyId = null;
        if (item.companyName) {
          const resolution = resolveCompany(item.companyName, item.rawData || {}, companiesCache);

          if (resolution) {
            if (resolution.isExisting) {
              companyId = resolution.company.id;

              // Update alias if needed
              if (resolution.newAlias) {
                const updatedAliases = [...(resolution.company.aliases || []), resolution.newAlias];
                await supabase
                  .from('companies')
                  .update({ aliases: updatedAliases, updated_at: new Date().toISOString() })
                  .eq('id', companyId);
              }
            } else {
              // Insert new company
              const { data: newCompany, error: companyError } = await supabase
                .from('companies')
                .insert([resolution.company])
                .select('id, canonical_name, aliases, website, slug')
                .single();

              if (companyError) {
                console.error('[Pipeline] Company insert error:', companyError.message, '| Data:', JSON.stringify(resolution.company).slice(0, 200));
              } else if (newCompany) {
                companyId = newCompany.id;
                companiesCache.push(newCompany);
                stats.companiesCreated++;
              }
            }
            stats.companiesResolved++;
          }
        }

        // Store funding round if applicable
        if (item.category === 'funding' && item.funding) {
          const fundingRecord = {
            company_id: companyId,
            round_type: item.funding.round || 'undisclosed',
            amount: item.funding.amount,
            currency: item.funding.currency || 'USD',
            amount_usd: item.funding.amountUsd,
            funding_date: item.publishedAt ? item.publishedAt.split('T')[0] : null,
            lead_investor: item.funding.leadInvestor
              ? normalizeInvestorName(item.funding.leadInvestor)
              : null,
            other_investors: (item.funding.otherInvestors || []).map(normalizeInvestorName),
            source_urls: (item.sources || []).map(s => s.url).filter(Boolean),
            verification_status: item.verification_status || 'unverified',
            confidence_score: item.confidence_score || 0,
            source_count: item.sourceCount || 1,
            dedupe_hash: item.dedupeHash,
            raw_data: item.rawData || {},
          };

          const { error: fundingError } = await supabase
            .from('funding_rounds')
            .upsert([fundingRecord], { onConflict: 'dedupe_hash' });

          if (fundingError) {
            console.error('[Pipeline] Funding upsert error:', fundingError.message, '| Hash:', fundingRecord.dedupe_hash);
          } else {
            stats.fundingRoundsStored++;
          }
        }

        // Store as news event
        const newsRecord = {
          company_id: companyId,
          headline: item.title?.slice(0, 500),
          category: item.category || 'other',
          event_type: item.category || 'other',
          event_date: item.publishedAt ? item.publishedAt.split('T')[0] : null,
          publication_date: item.publishedAt ? item.publishedAt.split('T')[0] : null,
          summary: item.description?.slice(0, 1000),
          funding_amount: item.funding?.amountUsd,
          funding_currency: item.funding?.currency,
          investors: item.funding
            ? [item.funding.leadInvestor, ...(item.funding.otherInvestors || [])].filter(Boolean)
            : [],
          source_name: item.sourceName,
          source_url: item.sourceUrl,
          additional_sources: (item.sources || []).slice(1).map(s => s.url).filter(Boolean),
          verification_status: item.verification_status || 'unverified',
          confidence_score: item.confidence_score || 0,
          dedupe_hash: item.dedupeHash,
          raw_data: item.rawData || {},
        };

        const { error: newsError } = await supabase
          .from('news_events')
          .upsert([newsRecord], { onConflict: 'dedupe_hash' });

        if (newsError) {
          console.error('[Pipeline] News upsert error:', newsError.message, '| Hash:', newsRecord.dedupe_hash);
        } else {
          stats.newsEventsStored++;
        }

      } catch (itemError) {
        stats.errors.push({
          item: item.title?.slice(0, 100),
          error: itemError.message,
        });
      }
    }

    // ── Step 5: Update scrape source timestamps ─────────────────────
    console.log('[Pipeline] Step 5: Updating source timestamps...');
    for (const sourceType of sources) {
      await supabase
        .from('scrape_sources')
        .update({
          last_scraped_at: new Date().toISOString(),
          status: 'active',
          error_count: 0,
        })
        .eq('type', sourceType);
    }

  } catch (error) {
    stats.errors.push({ pipeline: true, error: error.message });
    console.error('[Pipeline] Fatal error:', error.message);
  }

  stats.duration = Date.now() - startTime;
  stats.completedAt = new Date().toISOString();

  console.log(`[Pipeline] ═══ Complete ═══`);
  console.log(`[Pipeline] Duration: ${stats.duration}ms`);
  console.log(`[Pipeline] Items: ${stats.rawItemsCollected} raw → ${stats.afterDedup} deduped`);
  console.log(`[Pipeline] Stored: ${stats.fundingRoundsStored} funding + ${stats.newsEventsStored} news`);
  console.log(`[Pipeline] Companies: ${stats.companiesResolved} resolved, ${stats.companiesCreated} new`);
  if (stats.errors.length) console.warn(`[Pipeline] Errors: ${stats.errors.length}`);

  return stats;
}

/**
 * Run a quick pipeline (RSS + GDELT — fast, free, high-volume).
 */
export async function runQuickPipeline(region = null) {
  return runPipeline({ sources: ['rss', 'gdelt'], region, useLLMFallback: true });
}

/**
 * Run a full pipeline (all sources including SEC EDGAR + NewsAPI).
 */
export async function runFullPipeline(region = null) {
  return runPipeline({
    sources: ['rss', 'api', 'web', 'edgar', 'gdelt', 'newsapi', 'india-web', 'global-web'],
    region,
    useLLMFallback: true,
  });
}

/**
 * Run company website corroboration pass.
 * Scrapes tracked companies' own websites to upgrade verification status.
 */
export async function runCorroborationPass() {
  const supabase = getServiceClient();

  // Get companies with websites that have recent funding events
  const { data: companies } = await supabase
    .from('companies')
    .select('id, canonical_name, website, aliases, location')
    .not('website', 'is', null)
    .limit(50);

  if (!companies?.length) {
    console.log('[Pipeline] No companies with websites to corroborate');
    return { corroborated: 0 };
  }

  const results = await scrapeCompanyWebsites(companies, 3);
  const items = results.flatMap(r => r.items || []);

  if (items.length > 0) {
    console.log(`[Pipeline] Corroboration found ${items.length} items — running through pipeline`);
    // Run these through the standard dedup/verify/store pipeline
    return runPipeline({
      sources: [], // No scraping, we already have the items
      _preloadedItems: items,
    });
  }

  return { corroborated: 0 };
}

/**
 * Run Startup India DPIIT enrichment for Indian companies.
 */
export async function runDPIITEnrichment() {
  const supabase = getServiceClient();

  const { data: companies } = await supabase
    .from('companies')
    .select('id, canonical_name, location, website')
    .or('location.ilike.%india%,location.ilike.%bangalore%,location.ilike.%mumbai%,location.ilike.%delhi%,location.ilike.%bengaluru%')
    .limit(30);

  if (!companies?.length) return { enriched: 0 };

  const enrichments = await enrichWithDPIIT(companies);
  let enriched = 0;

  for (const { companyId, enrichment } of enrichments) {
    const { error } = await supabase
      .from('companies')
      .update({
        founded_year: enrichment.foundedYear,
        industry: enrichment.sector,
        dpiit_number: enrichment.dpiitNumber,
        is_dpiit_recognized: enrichment.isRecognized,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId);

    if (!error) enriched++;
  }

  console.log(`[Pipeline] DPIIT enrichment: ${enriched}/${companies.length} companies`);
  return { enriched };
}

/**
 * Get pipeline health status including source circuit breaker states.
 */
export function getPipelineHealth() {
  return {
    sourceHealth: getSourceHealth(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Link companies to existing jobs in the database.
 * Should be run after funding data is stored.
 */
export async function linkCompaniesToJobs() {
  const supabase = getServiceClient();

  // Get all companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, canonical_name, aliases');

  // Get all jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, company, title, location, created_at');

  if (!companies?.length || !jobs?.length) return { linked: 0 };

  let linked = 0;

  for (const company of companies) {
    const { matchedJobs } = matchCompanyToJobs(company.canonical_name, jobs);

    for (const job of matchedJobs) {
      const { error } = await supabase
        .from('company_job_links')
        .upsert([{
          company_id: company.id,
          job_id: job.id,
          match_confidence: 0.9,
          matched_by: 'name',
        }], { onConflict: 'company_id,job_id' });

      if (!error) linked++;
    }
  }

  console.log(`[Pipeline] Linked ${linked} jobs to intelligence companies`);
  return { linked };
}
