import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { applyGreenhouse } from './platforms/greenhouse.js';
import { applyLever } from './platforms/lever.js';
import { applyWorkday } from './platforms/workday.js';
import { setupHumanCursor } from './humanizer.js';
import { handleLoginWall } from './authMachine.js';
import { answerCustomQuestions } from './generativeFiller.js';

// Add stealth plugin to bypass Cloudflare/bot-protections on ATS sites
chromium.use(stealthPlugin());

// Add recaptcha plugin — audio-bypass mode only (no paid solving service).
// NOTE: Without a valid 2captcha token, page.solveRecaptchas() will attempt
// the free audio challenge bypass but will SILENTLY FAIL on v3 invisible reCAPTCHAs.
// To enable full solving, set RECAPTCHA_TOKEN env var with a valid 2captcha API key.
chromium.use(
  RecaptchaPlugin({
    provider: {
      id: '2captcha',
      token: process.env.RECAPTCHA_TOKEN || 'audio-bypass-only'
    },
    visualFeedback: true // colorize reCAPTCHAs for debugging
  })
);

// Global state for Slow-Drip Queue System
let lastExecutionTime = 0;
const MIN_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes between applications to stay under IP radar

/**
 * Executes a headless ATS application workflow.
 * @param {Object} params 
 * @param {string} params.jobUrl - The target job URL
 * @param {Object} params.profile - User profile data (profile_data.json)
 * @param {string} params.resumePath - Absolute path to the tailored PDF
 * @param {boolean} params.headless - Run invisibly or show UI (for debugging)
 */
export async function executeATSWorker({ jobUrl, profile, resumePath, headless = true, forceInstant = false }) {
  console.log(`[ATS Engine] Spawning Headless Chromium for: ${jobUrl}`);
  
  // Slow-Drip Queue Enforcement
  if (!forceInstant) {
      const now = Date.now();
      const timeSinceLast = now - lastExecutionTime;
      if (timeSinceLast < MIN_INTERVAL_MS) {
          const waitTime = MIN_INTERVAL_MS - timeSinceLast;
          console.log(`[ATS Queue] Cloudflare evasion active. Waiting ${Math.round(waitTime / 1000 / 60)} minutes before applying...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      lastExecutionTime = Date.now();
  }

  // Launch the browser with specific arguments to avoid bot detection
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-blink-features=AutomationControlled'
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    permissions: ['geolocation'],
    locale: 'en-US'
  });

  const page = await context.newPage();
  
  try {
    console.log(`[ATS Engine] Navigating to target DOM: ${jobUrl}`);
    
    // Navigate to the job URL FIRST — login wall detection requires the actual page
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Initialize Ghost Cursor
    const cursor = await setupHumanCursor(page);
    
    // Attempt Auth / Login Wall bypass (now on the actual page, not about:blank)
    const authSuccess = await handleLoginWall(page, profile);
    if (!authSuccess) {
        throw new Error('[ATS Engine] Failed to bypass login/auth wall.');
    }

    // Solve any CAPTCHAs that appear
    await page.solveRecaptchas();

    // Route to the specific platform logic based on the URL signature
    if (jobUrl.includes('boards.greenhouse.io')) {
      console.log(`[ATS Engine] Detected Platform: Greenhouse`);
      await applyGreenhouse(page, jobUrl, profile, resumePath);
    } 
    else if (jobUrl.includes('jobs.lever.co')) {
      console.log(`[ATS Engine] Detected Platform: Lever`);
      await applyLever(page, jobUrl, profile, resumePath);
    } 
    else if (jobUrl.includes('myworkdayjobs.com') || jobUrl.includes('myworkday.com')) {
      console.log(`[ATS Engine] Detected Platform: Workday`);
      await applyWorkday(page, jobUrl, profile, resumePath);
    }
    else {
      throw new Error(`[ATS Engine] Unsupported ATS Platform: ${jobUrl}`);
    }

    // ─── GENERATIVE AUTOFILL PHASE ───
    // Before submitting, look for unknown custom text areas and use Obsidian RAG to answer them
    await answerCustomQuestions(page, profile);

    console.log(`[ATS Engine] Application submitted successfully!`);
    return { success: true };

  } catch (error) {
    console.error(`[ATS Engine] Fatal Error during DOM traversal:`, error);
    // Take a screenshot of the failure state for debugging
    await page.screenshot({ path: `ats-failure-${Date.now()}.png`, fullPage: true });
    return { success: false, error: error.message };
  } finally {
    console.log(`[ATS Engine] Tearing down browser context.`);
    await context.close();
    await browser.close();
  }
}
