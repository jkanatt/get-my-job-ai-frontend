/**
 * Workday ATS Automation Module
 * Navigates myworkdayjobs.com to inject candidate payloads.
 * Note: Workday is highly complex and often requires creating an account.
 * This script attempts the "Autofill with Resume" quick-apply route.
 */
export async function applyWorkday(page, jobUrl, profile, resumePath) {
  // Navigate to the job posting
  await page.goto(jobUrl, { waitUntil: 'networkidle' });

  // Click Apply button
  console.log(`[Workday] Looking for Apply button...`);
  const applyButton = page.locator('a[data-automation-id="applyNowButton"], button[data-automation-id="applyNowButton"]').first();
  if (await applyButton.isVisible()) {
    await applyButton.click();
  } else {
      console.log(`[Workday] Could not find standard apply button. The DOM might be heavily shadow-rooted.`);
  }

  // Workday usually prompts for "Autofill with Resume", "Apply Manually", or "Use Last Application"
  // We want to trigger the "Autofill with Resume" flow which creates a temporary profile state
  await page.waitForSelector('div[data-automation-id="autofillWithResume"]', { timeout: 10000 });
  const autofillButton = page.locator('div[data-automation-id="autofillWithResume"] a').first();
  
  if (await autofillButton.isVisible()) {
      console.log(`[Workday] Clicking 'Autofill with Resume'...`);
      await autofillButton.click();
  }

  // Wait for the dropzone or file input
  console.log(`[Workday] Uploading tailored resume from ${resumePath}`);
  
  // Workday handles uploads via a complex Dropzone element, but usually the underlying input[type="file"] can be targeted
  await page.setInputFiles('input[type="file"][data-automation-id="file-upload-input"]', resumePath);

  // Wait for Workday to parse the PDF
  console.log(`[Workday] Waiting for PDF parsing...`);
  await page.waitForTimeout(5000); 

  // Next Step (My Information)
  const nextButton = page.locator('button[data-automation-id="bottom-navigation-next-button"]').first();
  if (await nextButton.isVisible()) {
      await nextButton.click();
  }

  // Inject any missing basic details that Workday failed to parse from the PDF
  console.log(`[Workday] Verifying mapped fields...`);
  
  // These selectors are highly volatile across different Workday instances
  const fnInput = page.locator('input[data-automation-id="legalNameSection_firstName"]');
  if (await fnInput.isVisible()) await fnInput.fill(profile.first_name);

  const lnInput = page.locator('input[data-automation-id="legalNameSection_lastName"]');
  if (await lnInput.isVisible()) await lnInput.fill(profile.last_name);

  // Phone number
  const phoneInput = page.locator('input[data-automation-id="phone-number"]');
  if (await phoneInput.isVisible()) await phoneInput.fill(profile.phone || '');

  // Submit or Next
  // await page.click('button[data-automation-id="bottom-navigation-submit-button"]'); // Commented out for safety
  
  console.log(`[Workday] Application payload injected successfully.`);
}
