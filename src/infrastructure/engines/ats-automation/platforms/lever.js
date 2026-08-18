/**
 * Lever ATS Automation Module
 * Navigates jobs.lever.co to inject candidate payloads.
 */
export async function applyLever(page, jobUrl, profile, resumePath) {
  // Navigate to the job posting
  await page.goto(jobUrl, { waitUntil: 'networkidle' });

  // Lever usually has an "Apply for this job" button that drops down the form
  const applyButton = page.locator('.postings-btn').first();
  if (await applyButton.isVisible()) {
    await applyButton.click();
  }

  // Ensure the form is loaded
  await page.waitForSelector('#application-form', { timeout: 10000 });

  console.log(`[Lever] Form detected. Injecting profile data...`);

  // Basic Details (Lever uses slightly different names)
  await page.fill('input[name="name"]', `${profile.first_name} ${profile.last_name}`);
  await page.fill('input[name="email"]', profile.email);
  await page.fill('input[name="phone"]', profile.phone || '');
  await page.fill('input[name="org"]', profile.company || '');
  
  // LinkedIn Profile
  await page.fill('input[name="urls[LinkedIn]"]', profile.linkedin || '');

  // Portfolio/Website
  await page.fill('input[name="urls[Portfolio]"]', profile.portfolio || '');
  await page.fill('input[name="urls[GitHub]"]', profile.portfolio || '');

  // Inject the Resume PDF
  console.log(`[Lever] Uploading tailored resume from ${resumePath}`);
  
  // Lever has a hidden input file element usually inside the resume-upload div
  await page.setInputFiles('input[type="file"][data-qa="resume-upload-input"]', resumePath);

  // Submit the form
  console.log(`[Lever] Clicking submit...`);
  // await page.click('button[data-qa="btn-submit"]'); // Commented out for safety during dry-runs
  
  console.log(`[Lever] Application payload injected successfully.`);
}
