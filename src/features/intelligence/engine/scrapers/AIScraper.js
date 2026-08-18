/**
 * AI Scraper — Python subprocess wrapper for ScrapeGraphAI & Scrapling
 * ═══════════════════════════════════════════════════════════════════════
 * Spawns Python processes for AI-powered content extraction when
 * structured HTML parsing (Cheerio) is insufficient.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_DIR = path.resolve(__dirname, '../../../../../engines/python/intelligence');
const PYTHON_BIN = 'python3';
const SUBPROCESS_TIMEOUT = 60_000; // 60 seconds

/**
 * Run a Python subprocess and return its JSON output.
 * @param {string} scriptName - Python script filename
 * @param {object} inputData - Data to pass via stdin as JSON
 * @returns {Promise<object>} Parsed JSON output from Python
 */
async function runPythonScript(scriptName, inputData) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PYTHON_DIR, scriptName);
    const proc = spawn(PYTHON_BIN, [scriptPath], {
      cwd: PYTHON_DIR,
      env: { ...process.env, PYTHONPATH: PYTHON_DIR },
      timeout: SUBPROCESS_TIMEOUT,
    });

    let stdout = '';
    let stderr = '';

    proc.stdin.write(JSON.stringify(inputData));
    proc.stdin.end();

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script ${scriptName} exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${e.message}\nStdout: ${stdout.slice(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

/**
 * Use ScrapeGraphAI for intelligent web extraction.
 * Extracts structured data from complex/unstructured web pages.
 *
 * @param {string} url - URL to scrape
 * @param {object} schema - Extraction schema describing what to extract
 * @param {string} prompt - Natural language prompt for the AI
 * @returns {Promise<object>} Extracted data
 */
export async function scrapeWithAI(url, schema, prompt) {
  try {
    const result = await runPythonScript('ai_scraper.py', {
      url,
      schema,
      prompt: prompt || `Extract the following information from this page: ${JSON.stringify(schema)}`,
      method: 'scrapegraph',
    });

    return {
      success: true,
      data: result.data || result,
      url,
      method: 'scrapegraph',
    };
  } catch (error) {
    console.warn(`[AI Scraper] ScrapeGraphAI failed for ${url}: ${error.message}`);
    return { success: false, error: error.message, url, method: 'scrapegraph' };
  }
}

/**
 * Use Scrapling for stealth web scraping.
 * Handles anti-bot protection and JavaScript-rendered pages.
 *
 * @param {string} url - URL to scrape
 * @param {object} selectors - CSS selectors or extraction rules
 * @returns {Promise<object>} Extracted data
 */
export async function scrapeWithScrapling(url, selectors) {
  try {
    const result = await runPythonScript('scrapling_scraper.py', {
      url,
      selectors,
      method: 'scrapling',
    });

    return {
      success: true,
      data: result.data || result,
      url,
      method: 'scrapling',
    };
  } catch (error) {
    console.warn(`[AI Scraper] Scrapling failed for ${url}: ${error.message}`);
    return { success: false, error: error.message, url, method: 'scrapling' };
  }
}

/**
 * Extract company intelligence from a company website using AI.
 */
export async function extractCompanyIntelligence(companyUrl) {
  return scrapeWithAI(companyUrl, {
    company_name: 'the name of the company',
    description: 'a brief description of what the company does',
    industry: 'the industry or sector',
    products: 'main products or services',
    founded_year: 'year the company was founded',
    headquarters: 'headquarters location',
    team_size: 'approximate team or employee count',
    founders: 'list of founders with their roles',
    latest_news: 'any recent news or announcements',
  }, 'Extract comprehensive company information from this website');
}

/**
 * Extract funding information from a news article page using AI.
 */
export async function extractFundingFromArticle(articleUrl) {
  return scrapeWithAI(articleUrl, {
    company_name: 'the startup or company that received funding',
    funding_amount: 'the amount raised (number and currency)',
    funding_round: 'the funding round type (seed, series A, etc)',
    lead_investor: 'the lead investor',
    other_investors: 'list of other participating investors',
    valuation: 'the company valuation if mentioned',
    use_of_funds: 'what the company plans to use the funds for',
    company_description: 'brief description of the company',
    founded_year: 'year the company was founded',
    location: 'company headquarters location',
    previous_funding: 'any previous funding rounds mentioned',
  }, 'Extract all funding and investment details from this news article');
}

/**
 * Extract LinkedIn company data using Scrapling (stealth mode).
 */
export async function extractLinkedInCompany(linkedinUrl) {
  return scrapeWithScrapling(linkedinUrl, {
    company_name: '.org-top-card-summary__title',
    industry: '.org-top-card-summary-info-list__info-item',
    employee_count: '.org-top-card-summary-info-list__info-item:nth-child(3)',
    headquarters: '.org-top-card-summary-info-list__info-item:nth-child(2)',
    description: '.org-top-card-summary__tagline',
    specialties: '.org-page-details-module__description',
  });
}

/**
 * Check if Python dependencies are available.
 */
export async function checkPythonDependencies() {
  try {
    const result = await runPythonScript('check_deps.py', {});
    return result;
  } catch {
    return {
      scrapegraph: false,
      scrapling: false,
      message: 'Python dependencies not installed. Run: pip install -r engines/python/intelligence/requirements.txt',
    };
  }
}
