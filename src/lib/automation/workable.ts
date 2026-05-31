import { chromium } from 'playwright';
import type { UserData } from './engine';

export async function runWorkableWorkflow(url: string, user: UserData, pdfUrl: string) {
  const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS === 'true' });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url);

    // Workable usually has an "Apply for this job" button that needs clicking
    const applyButton = await page.$('[data-ui="apply-button"], button:has-text("Apply for this job")');
    if (applyButton) {
      await applyButton.click();
      // Wait for form to transition
      await page.waitForTimeout(1000);
    }

    // Standard Workable selectors
    await page.fill('input[name="firstname"]', user.firstName);
    await page.fill('input[name="lastname"]', user.lastName);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="phone"]', user.phone);

    if (user.linkedInUrl) {
      const linkedIn = await page.$('input[name*="linkedin" i]');
      if (linkedIn) await linkedIn.fill(user.linkedInUrl);
    }

    // Resume Upload
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      const response = await fetch(pdfUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      await fileInput.setInputFiles({
        name: 'resume.pdf',
        mimeType: 'application/pdf',
        buffer: buffer
      });
    }

    await page.waitForTimeout(2000);

    const screenshot = await page.screenshot({ fullPage: true });
    
    return { success: true, screenshot };
  } catch (error) {
    console.error('Workable automation error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
