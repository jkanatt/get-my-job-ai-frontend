import { humanType } from './humanizer.js';
import { fetchLatestOTP } from '../../services/imap-client.js';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Setup Supabase Client for tracking ATS accounts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Generates a highly secure password that meets enterprise ATS requirements.
 */
function generateStrongPassword() {
    return `Get My Job_${randomUUID().slice(0, 8)}#9!`;
}

export async function checkExistingCredentials(domain) {
    try {
        const credFilePath = path.join(process.cwd(), 'ats_credentials.json');
        if (fs.existsSync(credFilePath)) {
            const creds = JSON.parse(fs.readFileSync(credFilePath, 'utf-8'));
            // Find explicit match for domain, or wildcard match for global ATS
            const match = creds.find(c => domain.includes(c.domain));
            if (match) return match;
        }
    } catch (e) {
        console.error(`[AuthMachine] Error checking credentials vault: ${e.message}`);
    }
    return null;
}

/**
 * Detects if the current page is a login wall or account creation screen.
 * Resolves Glassdoor intercept logic.
 * 
 * @param {import('playwright').Page} page 
 * @param {Object} profile 
 * @returns {boolean} true if authenticated/bypassed, false on failure.
 */
export async function handleLoginWall(page, profile) {
    const url = page.url();
    
    // Check for existing manual credentials injected from the Portals Dashboard
    const existingCreds = await checkExistingCredentials(new URL(url).hostname);

    // 1. Glassdoor Intercept
    if (url.includes('glassdoor.com/job-listing')) {
        console.log('[AuthMachine] Detected Glassdoor aggregate link. Attempting to extract source link...');
        try {
            // Click "Apply on employer site" button if present
            const externalLink = await page.$('a[data-test="applyButton"]');
            if (externalLink) {
                const [newPage] = await Promise.all([
                    page.context().waitForEvent('page'),
                    externalLink.click()
                ]);
                console.log(`[AuthMachine] Bypassed Glassdoor. New URL: ${newPage.url()}`);
                page = newPage; // Swap focus
            }
        } catch (e) {
            console.log('[AuthMachine] Failed to bypass Glassdoor. Continuing on current page.');
        }
    }

    // 2. Workday Account Creation Detect
    if (url.includes('myworkdayjobs.com')) {
        console.log('[AuthMachine] Detected Workday login wall.');
        
        if (existingCreds) {
            console.log(`[AuthMachine] Found pre-configured credentials for ${existingCreds.domain}. Routing to Sign In flow.`);
            await executeWorkdayLogin(page, existingCreds);
            return true;
        }

        console.log('[AuthMachine] No credentials found. Routing to Account Creation flow.');
        return await executeWorkdayRegistration(page, profile);
    }

    if (url.includes('smartrecruiters.com')) {
        console.log('[AuthMachine] Detected SmartRecruiters wall. (Scaffolding ready)');
        // TODO: SmartRecruiters login injection
        return false;
    }

    if (url.includes('bamboohr.com') || url.includes('jobs.ashbyhq.com')) {
         console.log('[AuthMachine] Detected native flow ATS (Ashby/Bamboo). No login wall expected.');
         return false;
    }

    return false;
}

/**
 * Handles explicit Sign In for Workday using injected Portals credentials
 */
async function executeWorkdayLogin(page, credentials) {
    try {
        console.log('[AuthMachine] Injecting credentials into Workday Sign In form...');
        await page.waitForSelector('input[data-automation-id="email"]', { timeout: 10000 });
        await humanType(page, 'input[data-automation-id="email"]', credentials.email);
        await humanType(page, 'input[data-automation-id="password"]', credentials.password);
        await page.click('button[data-automation-id="signInSubmitButton"]');
        await page.waitForNavigation({ waitUntil: 'networkidle' });
        console.log('[AuthMachine] Workday Sign In successful.');
    } catch (e) {
        console.error('[AuthMachine] Workday Sign In failed: ', e.message);
        throw e;
    }
}

/**
 * Specifically handles the Workday or Generic Account Creation flow.
 * 
 * @param {import('playwright').Page} page 
 * @param {Object} profile 
 */
async function executeWorkdayRegistration(page, profile) {
    try {
        // Look for the "Create Account" button
        const createAccountBtn = await page.$('button[data-automation-id="createAccountLink"]');
        if (createAccountBtn) {
            await createAccountBtn.click();
            await page.waitForTimeout(2000);
            
            const password = generateStrongPassword();
            console.log(`[AuthMachine] Generated temporary password: ${password}`);

            // Fill form
            await humanType(page, 'input[type="email"]', profile.email);
            await page.waitForTimeout(500);
            await humanType(page, 'input[type="password"]', password);
            await page.waitForTimeout(500);
            
            // Verify password (if exists)
            const verifyPass = await page.$('input[data-automation-id="verifyPassword"]');
            if (verifyPass) {
                await humanType(page, 'input[data-automation-id="verifyPassword"]', password);
            }

            // Click Create
            await page.click('button[data-automation-id="createAccountSubmitButton"]');
            
            // Store credentials securely for future status checks
            const domain = new URL(page.url()).hostname;
            const accountRecord = {
                email: profile.email,
                domain: domain,
                password: password,
                created_at: new Date().toISOString()
            };

            // 1. Database Logging (Supabase)
            if (supabase) {
                try {
                    await supabase.from('ats_accounts').insert(accountRecord);
                    console.log(`[AuthMachine] Credentials logged to Supabase for ${domain}`);
                } catch (dbErr) {
                    console.warn(`[AuthMachine] Supabase logging failed: ${dbErr.message}`);
                }
            }

            // 2. Foolproof Local Record Keeping (ats_credentials.json)
            try {
                const credFilePath = path.join(process.cwd(), 'ats_credentials.json');
                let creds = [];
                if (fs.existsSync(credFilePath)) {
                    creds = JSON.parse(fs.readFileSync(credFilePath, 'utf-8'));
                }
                creds.push(accountRecord);
                fs.writeFileSync(credFilePath, JSON.stringify(creds, null, 2), 'utf-8');
                console.log(`[AuthMachine] Credentials safely recorded locally in ats_credentials.json`);
            } catch (fsErr) {
                console.error(`[AuthMachine] Failed to write local credentials file: ${fsErr.message}`);
            }

            console.log('[AuthMachine] Waiting for OTP Email Verification...');
            
            // We give IMAP up to 60 seconds to catch the email
            const otpCode = await fetchLatestOTP(profile.email, 60000);
            
            if (otpCode) {
                console.log(`[AuthMachine] Intercepted OTP: ${otpCode}. Injecting...`);
                // Wait for the verification code input
                await page.waitForSelector('input[data-automation-id="verificationCode"]', { timeout: 10000 });
                await humanType(page, 'input[data-automation-id="verificationCode"]', otpCode);
                await page.click('button[data-automation-id="verifySubmitButton"]');
                console.log('[AuthMachine] Successfully broke through the login wall.');
                return true;
            } else {
                console.error('[AuthMachine] Failed to retrieve OTP within 60 seconds. Halting.');
                return false;
            }
        } else {
            console.log('[AuthMachine] Already signed in or no create account button found.');
            return true;
        }
    } catch (e) {
        console.error('[AuthMachine] Critical failure during Auth state machine:', e);
        return false;
    }
}
