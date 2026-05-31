import { chromium } from 'playwright';

import type { UserData } from './engine';

export async function runGreenhouseWorkflow(url: string, user: UserData, pdfUrl: string) {
  const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS === 'true' });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url);

    // Basic details
    await page.fill('input[id="first_name"]', user.firstName);
    await page.fill('input[id="last_name"]', user.lastName);
    await page.fill('input[id="email"]', user.email);
    await page.fill('input[id="phone"]', user.phone);

    if (user.linkedInUrl) {
      const linkedIn = await page.$(
        'input[id*="linkedin"], input[name*="linkedin"], input[placeholder*="LinkedIn" i]'
      );
      if (linkedIn) await linkedIn.fill(user.linkedInUrl);
    }

    if (user.portfolioUrl) {
      const website = await page.$(
        'input[id*="website"], input[name*="website"], input[placeholder*="Website" i], input[placeholder*="Portfolio" i]'
      );
      if (website) await website.fill(user.portfolioUrl);
    }

    // Resume Upload (Greenhouse usually has a file input or a button that opens a file picker)
    // For many Greenhouse forms, there's an input type="file"
    const fileInput = await page.$('input[type="file"][id="resume_upload"], input[type="file"][name="resume"]');
    if (fileInput) {
      // Since it's a remote URL, we might need to download it first or use a buffer
      // However, Playwright's setInputFiles can take an object with name, mimeType, and buffer
      const response = await fetch(pdfUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      await fileInput.setInputFiles({
        name: 'resume.pdf',
        mimeType: 'application/pdf',
        buffer: buffer
      });
    }

    // Wait a bit to ensure everything is filled
    await page.waitForTimeout(2000);

    // Note: We don't actually click submit in this demo to avoid spamming real ATS
    // In a real scenario, you'd find the submit button and click it.
    const screenshot = await page.screenshot({ fullPage: true });
    
    return { success: true, screenshot };
  } catch (error) {
    console.error('Greenhouse automation error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
