import { prisma } from '@/lib/prisma';
import { sendMessage, sendAction } from '@/lib/telegram';
import type { RemotiveJob } from '@/lib/remotive';
import { getRemotiveJobById } from '@/lib/remotive';
import { automateApplication } from '@/lib/automation/engine';
import { canApplyToJobs, toApplicationUserData } from '@/lib/profile';
import type { User } from '@prisma/client';

export async function runJobApplication(user: User, job: RemotiveJob, chatId: string) {
  if (!canApplyToJobs(user)) {
    throw new Error('Profile incomplete — finish the chat setup and upload your resume PDF first.');
  }

  if (!user.resumeUrl) {
    throw new Error('Please send your resume as a PDF document in this chat.');
  }

  const profile = toApplicationUserData(user);
  const resumeUrl = user.resumeUrl;

  await sendMessage(chatId, `Applying to *${job.title}* at ${job.company_name} with your uploaded resume...`);

  await prisma.applicationLog.create({
    data: {
      userId: user.id,
      jobId: String(job.id),
      companyName: job.company_name,
      jobTitle: job.title,
      resumeUrl,
      status: 'RESUME_GENERATED',
    },
  });

  await sendMessage(chatId, `Resume on file: [View resume](${resumeUrl})`);

  if (job.url.includes('greenhouse.io') || job.url.includes('lever.co')) {
    await sendMessage(chatId, 'Filling the application form in the browser...');
    await sendAction(chatId, 'typing');

    const result = await automateApplication(
      job.url,
      {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        linkedInUrl: profile.linkedInUrl,
        portfolioUrl: profile.portfolioUrl,
        currentTitle: profile.currentTitle ?? undefined,
      },
      resumeUrl
    );

    if (result.success) {
      await prisma.applicationLog.updateMany({
        where: { userId: user.id, jobId: String(job.id) },
        data: { status: 'APPLYING' },
      });
      await sendMessage(
        chatId,
        'Form auto-filled with your details and resume. Review the page and submit when ready.'
      );
    }
  } else {
    await sendMessage(
      chatId,
      `This job uses a custom portal. Apply manually with your resume: ${job.url}`
    );
  }
}

export async function resumePendingApplication(user: User, chatId: string): Promise<boolean> {
  if (!user.pendingApplyJobId) return false;

  const jobId = Number(user.pendingApplyJobId);
  const job = await getRemotiveJobById(jobId);

  await prisma.user.update({
    where: { id: user.id },
    data: { pendingApplyJobId: null },
  });

  if (!job) {
    await sendMessage(chatId, 'That saved job is no longer available. Ask me to find jobs again.');
    return true;
  }

  if (!canApplyToJobs(user)) {
    await sendMessage(chatId, "Almost there — I still need a few details before I can apply. I'll keep asking in our chat.");
    return true;
  }

  await runJobApplication(user, job, chatId);
  return true;
}
