import { chromium } from 'playwright';

import type { UserData } from './engine';

export async function runLeverWorkflow(url: string, user: UserData, pdfUrl: string) {
  const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS === 'true' });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url);

    // Lever usually has a "Apply for this job" button first
    const applyButton = await page.$('a.postings-btn:has-text("Apply for this job")');
    if (applyButton) await applyButton.click();

    await page.waitForSelector('input[name="name"]');

    // Lever often uses a single "name" field or split ones
    await page.fill('input[name="name"]', `${user.firstName} ${user.lastName}`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="phone"]', user.phone);

    if (user.linkedInUrl) {
      const linkedIn = await page.$('input[name*="urls[LinkedIn]"], input[name*="linkedin" i]');
      if (linkedIn) await linkedIn.fill(user.linkedInUrl);
    }

    if (user.portfolioUrl) {
      const portfolio = await page.$('input[name*="urls[Portfolio]"], input[name*="website" i]');
      if (portfolio) await portfolio.fill(user.portfolioUrl);
    }

    // Resume Upload
    const fileInput = await page.$('input[type="file"][name="resume"]');
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
    console.error('Lever automation error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
