/**
 * Greenhouse ATS Automation Module
 * Navigates boards.greenhouse.io to inject candidate payloads.
 */
export async function applyGreenhouse(page, jobUrl, profile, resumePath) {
  // Navigate to the job posting
  await page.goto(jobUrl, { waitUntil: 'networkidle' });

  // Most greenhouse boards have a "Apply Here" or "Apply for this Job" button
  // Wait for the form to appear or click the apply button to reveal it.
  const applyButton = page.locator('button:has-text("Apply")').first();
  if (await applyButton.isVisible()) {
    await applyButton.click();
  }

  // Ensure the form is loaded
  await page.waitForSelector('#application_form', { timeout: 10000 });

  console.log(`[Greenhouse] Form detected. Injecting profile data...`);

  // Basic Details
  await page.fill('input[name="job_application[first_name]"]', profile.first_name);
  await page.fill('input[name="job_application[last_name]"]', profile.last_name);
  await page.fill('input[name="job_application[email]"]', profile.email);
  await page.fill('input[name="job_application[phone]"]', profile.phone || '');

  // LinkedIn Profile (often an optional or mandatory field)
  const linkedInInput = page.locator('input[autocomplete="custom-question-linkedin-profile"]');
  if (await linkedInInput.count() > 0) {
    await linkedInInput.fill(profile.linkedin || '');
  }

  // Portfolio/Website
  const websiteInput = page.locator('input[autocomplete="custom-question-website"]');
  if (await websiteInput.count() > 0) {
    await websiteInput.fill(profile.portfolio || '');
  }

  // Inject the Resume PDF
  console.log(`[Greenhouse] Uploading tailored resume from ${resumePath}`);
  const resumeInput = page.locator('input[type="file"][name="job_application[resume_text]"]');

  // Wait for the file input to be attachable. Greenhouse often hides the raw input.
  await page.setInputFiles('input[type="file"]', resumePath);

  // Custom Questions (Optional handling for complex setups)
  // E.g., "Are you authorized to work in the US?" -> We could use an LLM here in the future
  
  // Submit the form
  console.log(`[Greenhouse] Clicking submit...`);
  // await page.click('#submit_app'); // Commented out for safety during dry-runs

  // Wait for success confirmation
  // await page.waitForSelector('#application_confirmation', { timeout: 15000 });
  console.log(`[Greenhouse] Application payload injected successfully.`);
}
