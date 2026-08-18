/**
 * Company Enricher — Deep Scan Engine
 * ═══════════════════════════════════════════════════════════════════════
 * Given a company name, orchestrates multiple enrichment strategies:
 *   1. LLM knowledge base → industry, founders, description
 *   2. Website discovery → scrape careers page for job count
 *   3. Cross-reference with existing data in DB
 *
 * Triggered by the "Deep Scan" button on company detail pages.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { deepEnrichCompany } from '@/features/intelligence/engine/LLMExtractor';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

// ─── Main Enrichment Orchestrator ──────────────────────────────────────

/**
 * Fully enrich a company by ID.
 * Returns the enriched data and updates the company record in DB.
 *
 * @param {string} companyId - Company UUID
 * @returns {Promise<object>} Enrichment results
 */
export async function enrichCompanyById(companyId) {
  const supabase = getServiceClient();
  const startTime = Date.now();

  // Fetch existing company data
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error || !company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  console.log(`[Enricher] Starting deep scan for: ${company.canonical_name}`);

  const enrichment = {
    companyId,
    companyName: company.canonical_name,
    startedAt: new Date().toISOString(),
    steps: [],
    updates: {},
  };

  // ── Step 1: LLM Knowledge Enrichment ──
  try {
    console.log('[Enricher] Step 1: LLM knowledge enrichment...');
    const llmData = await deepEnrichCompany(company.canonical_name, {
      description: company.description,
      website: company.website,
    });

    if (llmData) {
      enrichment.steps.push({ step: 'llm', success: true, data: llmData });

      // Only update fields that are currently empty
      if (!company.website && llmData.website) enrichment.updates.website = llmData.website;
      if (!company.industry && llmData.industry) enrichment.updates.industry = llmData.industry;
      if (!company.description && llmData.description) enrichment.updates.description = llmData.description;
      if (!company.location && llmData.location) enrichment.updates.location = llmData.location;
      if (!company.founded_year && llmData.founded_year) enrichment.updates.founded_year = llmData.founded_year;
      if (!company.employee_count && llmData.employee_count) enrichment.updates.employee_count = llmData.employee_count;
      if (!company.stage && llmData.stage) enrichment.updates.stage = llmData.stage;

      // Store structured data in metadata
      enrichment.updates.metadata = {
        ...(company.metadata || {}),
        enrichment: {
          lastRun: new Date().toISOString(),
          founders: llmData.founders || [],
          products: llmData.products || [],
          competitors: llmData.competitors || [],
          techStack: llmData.tech_stack || [],
          subIndustry: llmData.sub_industry || null,
          isIndian: llmData.is_indian || false,
        },
      };
    } else {
      enrichment.steps.push({ step: 'llm', success: false, reason: 'No data returned' });
    }
  } catch (err) {
    enrichment.steps.push({ step: 'llm', success: false, error: err.message });
  }

  // ── Step 2: Website Careers Page Scrape ──
  const websiteUrl = enrichment.updates.website || company.website;
  if (websiteUrl) {
    try {
      console.log(`[Enricher] Step 2: Scraping careers at ${websiteUrl}...`);
      const careerData = await scrapeCareerPage(websiteUrl);
      enrichment.steps.push({ step: 'careers', success: true, data: careerData });

      if (careerData.jobCount > 0) {
        enrichment.updates.metadata = {
          ...(enrichment.updates.metadata || company.metadata || {}),
          careers: {
            jobCount: careerData.jobCount,
            departments: careerData.departments,
            lastScraped: new Date().toISOString(),
          },
        };
      }
    } catch (err) {
      enrichment.steps.push({ step: 'careers', success: false, error: err.message });
    }
  }

  // ── Step 3: Update company record in DB ──
  if (Object.keys(enrichment.updates).length > 0) {
    try {
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          ...enrichment.updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (updateError) {
        enrichment.steps.push({ step: 'db-update', success: false, error: updateError.message });
      } else {
        enrichment.steps.push({ step: 'db-update', success: true, fieldsUpdated: Object.keys(enrichment.updates) });
        console.log(`[Enricher] Updated ${Object.keys(enrichment.updates).length} fields for ${company.canonical_name}`);
      }
    } catch (err) {
      enrichment.steps.push({ step: 'db-update', success: false, error: err.message });
    }
  }

  enrichment.completedAt = new Date().toISOString();
  enrichment.duration = Date.now() - startTime;
  enrichment.fieldsEnriched = Object.keys(enrichment.updates).length;

  console.log(`[Enricher] Deep scan complete for ${company.canonical_name} in ${enrichment.duration}ms (${enrichment.fieldsEnriched} fields enriched)`);

  return enrichment;
}

// ─── Career Page Scraper ───────────────────────────────────────────────

async function scrapeCareerPage(baseUrl) {
  const careersUrls = [
    `${baseUrl}/careers`,
    `${baseUrl}/jobs`,
    `${baseUrl}/career`,
    `${baseUrl}/join-us`,
    `${baseUrl}/work-with-us`,
    `${baseUrl}/openings`,
  ];

  for (const url of careersUrls) {
    try {
      const { data } = await axios.get(url, {
        timeout: 10_000,
        headers: { 'User-Agent': USER_AGENT },
        maxRedirects: 3,
        validateStatus: (s) => s < 400,
      });

      const $ = cheerio.load(data);
      const text = $('body').text();

      // Count job listings
      const jobCards = $(
        '.job-card, .job-listing, .position, .opening, [class*="job"], [class*="position"], [class*="opening"], [class*="career"]'
      ).length;

      // Extract departments
      const departments = new Set();
      $('h2, h3, h4, .department, .team, [class*="department"], [class*="team"]').each((_, el) => {
        const dept = $(el).text().trim();
        if (dept.length > 2 && dept.length < 40 && /engineering|product|design|marketing|sales|operations|data|finance|hr|legal/i.test(dept)) {
          departments.add(dept);
        }
      });

      // Count by looking for common patterns
      const jobCountMatch = text.match(/(\d+)\s*(?:open\s+)?(?:positions?|jobs?|openings?|roles?)/i);
      const jobCount = jobCountMatch ? parseInt(jobCountMatch[1]) : (jobCards || 0);

      if (jobCount > 0 || departments.size > 0) {
        return {
          jobCount,
          departments: [...departments],
          url,
        };
      }
    } catch {
      // Try next URL
    }
  }

  return { jobCount: 0, departments: [], url: null };
}
