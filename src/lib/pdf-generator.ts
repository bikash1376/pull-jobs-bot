import { generateText } from 'ai';
import { chatModel } from '@/lib/ai';
import puppeteer from 'puppeteer-core';
import { utapi } from './uploadthing-server';

export interface ResumeData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  experienceSummary: string;
  skills: string[];
  location?: string;
  currentTitle?: string;
  linkedInUrl?: string | null;
  portfolioUrl?: string | null;
}

export interface JobData {
  title: string;
  company_name: string;
  /** Job context (Coral remotive.jobs has no description column — use search/tags/url). */
  description: string;
}

/**
 * Tailors a resume for a specific job using AI.
 */
export async function tailorResumeData(user: ResumeData, job: JobData): Promise<string> {
  const { text } = await generateText({
    model: chatModel,
    prompt: `
      You are an expert resume writer. Tailor the following user's experience for the specific job description provided.
      
      User Profile:
      - Name: ${user.firstName} ${user.lastName}
      - Email: ${user.email}
      - Phone: ${user.phone}
      - Location: ${user.location ?? 'N/A'}
      - Current title: ${user.currentTitle ?? 'N/A'}
      - LinkedIn: ${user.linkedInUrl ?? 'N/A'}
      - Portfolio: ${user.portfolioUrl ?? 'N/A'}
      - Skills: ${user.skills.join(', ')}
      - Experience Summary: ${user.experienceSummary}

      Job Details:
      - Title: ${job.title}
      - Company: ${job.company_name}
      - Description: ${job.description}

      Task:
      Rewrite the user's experience summary into 4-5 high-impact, ATS-optimized bullet points that highlight the most relevant skills and achievements for this specific job. 
      Use professional, action-oriented language. 
      ONLY return the bullet points in markdown format, nothing else.
    `,
  });

  return text;
}

/**
 * Generates a PDF from tailored resume data and uploads it to UploadThing.
 */
export async function generateAndUploadResume(user: ResumeData, tailoredExperience: string, jobTitle: string): Promise<string> {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.tailwindcss.com"></script>
      <title>Resume - ${user.firstName} ${user.lastName}</title>
    </head>
    <body class="bg-white p-10 font-sans">
      <div class="max-w-4xl mx-auto border-b-2 border-gray-800 pb-4 mb-6">
        <h1 class="text-4xl font-bold uppercase">${user.firstName} ${user.lastName}</h1>
        <p class="text-gray-600">${user.currentTitle ?? ''}</p>
        <p class="text-gray-600">${user.email} | ${user.phone}${user.location ? ` | ${user.location}` : ''}</p>
        ${user.linkedInUrl || user.portfolioUrl ? `<p class="text-sm text-gray-500">${[user.linkedInUrl, user.portfolioUrl].filter(Boolean).join(' · ')}</p>` : ''}
      </div>
      
      <div class="mb-8">
        <h2 class="text-xl font-bold uppercase border-b border-gray-300 mb-2">Professional Summary</h2>
        <div class="prose max-w-none text-gray-800">
          ${tailoredExperience.replace(/\n/g, '<br/>')}
        </div>
      </div>

      <div class="mb-8">
        <h2 class="text-xl font-bold uppercase border-b border-gray-300 mb-2">Core Skills</h2>
        <div class="flex flex-wrap gap-2">
          ${user.skills.map(skill => `<span class="bg-gray-100 px-3 py-1 rounded text-sm">${skill}</span>`).join('')}
        </div>
      </div>
      
      <div class="text-xs text-gray-400 mt-10">
        Generated for: ${jobTitle}
      </div>
    </body>
    </html>
  `;

  let browser;
  try {
    // In a production environment like Vercel, you'd use @sparticuz/chromium
    // For local dev, we assume chrome is available or use a standard path
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Adjust for Windows
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    
    // Convert Buffer to File-like object for UploadThing
    const file = new File([pdfBuffer as any], `Resume_${user.lastName}_${jobTitle.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' });
    
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (uploadResponse[0].error) {
      throw new Error(`UploadThing error: ${uploadResponse[0].error.message}`);
    }

    return uploadResponse[0].data.url;
  } catch (error) {
    console.error('PDF Generation/Upload Error:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}
