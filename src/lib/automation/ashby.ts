import { chromium } from 'playwright';
import type { UserData } from './engine';

export async function runAshbyWorkflow(url: string, user: UserData, pdfUrl: string) {
  const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS === 'true' });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url);

    // Ashby forms often use standard names or accessible labels
    // We try name-based first, then getByLabel for better resilience
    await page.fill('input[name="firstName"]', user.firstName);
    await page.fill('input[name="lastName"]', user.lastName);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="phone"]', user.phone);

    if (user.linkedInUrl) {
      const linkedIn = await page.$('input[name*="linkedin" i], input[placeholder*="LinkedIn" i]');
      if (linkedIn) await linkedIn.fill(user.linkedInUrl);
    }

    if (user.portfolioUrl) {
      const portfolio = await page.$('input[name*="website" i], input[placeholder*="Website" i], input[placeholder*="Portfolio" i]');
      if (portfolio) await portfolio.fill(user.portfolioUrl);
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

    // Short wait to visually confirm filling if in headed mode
    await page.waitForTimeout(2000);

    // Note: Clicking submit is disabled for safety in this version
    const screenshot = await page.screenshot({ fullPage: true });
    
    return { success: true, screenshot };
  } catch (error) {
    console.error('Ashby automation error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
