import { runGreenhouseWorkflow } from './greenhouse';
import { runLeverWorkflow } from './lever';
import { runAshbyWorkflow } from './ashby';
import { runWorkableWorkflow } from './workable';
import { chromium } from 'playwright';

export interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location?: string;
  linkedInUrl?: string | null;
  portfolioUrl?: string | null;
  currentTitle?: string;
}

export async function automateApplication(url: string, user: UserData, pdfUrl: string): Promise<{ success: boolean; screenshot?: Buffer }> {
  const lowercaseUrl = url.toLowerCase();

  // 1. Handle ATS platforms directly
  if (lowercaseUrl.includes('greenhouse.io')) {
    return await runGreenhouseWorkflow(url, user, pdfUrl);
  }
  if (lowercaseUrl.includes('lever.co')) {
    return await runLeverWorkflow(url, user, pdfUrl);
  }
  if (lowercaseUrl.includes('ashbyhq.com')) {
    return await runAshbyWorkflow(url, user, pdfUrl);
  }
  if (lowercaseUrl.includes('workable.com')) {
    return await runWorkableWorkflow(url, user, pdfUrl);
  }

  // 2. Handle Remotive redirects
  if (lowercaseUrl.includes('remotive.com')) {
    const resolvedUrl = await resolveRemotiveRedirect(url);
    if (resolvedUrl === url) {
        throw new Error('Remotive did not redirect to a supported platform.');
    }
    return await automateApplication(resolvedUrl, user, pdfUrl);
  }

  throw new Error(`Unsupported platform: ${url}. Only Greenhouse, Lever, Ashby, and Workable are supported.`);
}

async function resolveRemotiveRedirect(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADLESS === 'true' });
  const page = await browser.newPage();
  try {
    await page.goto(url);
    const applyButton = await page.$('a.apply-button, a:has-text("Apply for this job"), a:has-text("Apply")');
    if (!applyButton) return url;

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      applyButton.click(),
    ]);

    return page.url();
  } catch {
    return url;
  } finally {
    await browser.close();
  }
}
