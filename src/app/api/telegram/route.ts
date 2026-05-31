import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendMessage, sendAction, answerCallbackQuery } from '@/lib/telegram';
import { markTelegramUpdateProcessed } from '@/lib/telegram-updates';
import { searchRemotiveJobs, getRemotiveJobById } from '@/lib/remotive';
import { canApplyToJobs, getActiveProfileField } from '@/lib/profile';
import {
  processProfileMessage,
  buildReplyAfterUpdate,
  buildWelcomeBackMessage,
  extractJobQuery,
  getQuestionForField,
} from '@/lib/conversation';
import { runJobApplication, resumePendingApplication } from '@/lib/apply-job';
import { downloadTelegramFile, uploadResumeBuffer } from '@/lib/telegram-files';

const WELCOME =
  'Hi! I\'m AgentApply — find remote jobs and apply with *your* resume (no rewriting).\n\nI\'ll ask one question at a time.\n\nAre you looking for *remote-only* jobs? Reply *yes* or *no*.';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updateId = body.update_id as number | undefined;

    if (updateId !== undefined) {
      const isNew = await markTelegramUpdateProcessed(updateId);
      if (!isNew) {
        return NextResponse.json({ ok: true });
      }
    }

    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id.toString();

    if (message.document) {
      await handleDocumentMessage(chatId, message);
      return NextResponse.json({ ok: true });
    }

    if (!message.text) {
      return NextResponse.json({ ok: true });
    }

    const text = message.text.trim();

    if (text === '/start') {
      await handleStart(chatId);
      return NextResponse.json({ ok: true });
    }

    await handleTextMessage(chatId, text);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram Webhook Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

async function getOrCreateUser(chatId: string): Promise<{ user: Awaited<ReturnType<typeof prisma.user.findUnique>> & object; isNew: boolean }> {
  let user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (user) return { user, isNew: false };
  user = await prisma.user.create({ data: { telegramChatId: chatId } });
  return { user, isNew: true };
}

async function handleStart(chatId: string) {
  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (!user) {
    await prisma.user.create({ data: { telegramChatId: chatId } });
    await sendMessage(chatId, WELCOME);
    return;
  }
  await sendMessage(chatId, await buildWelcomeBackMessage(user));
}

async function handleDocumentMessage(
  chatId: string,
  message: { document: { file_id: string; file_name?: string; mime_type?: string } }
) {
  const doc = message.document;
  const isPdf =
    doc.mime_type === 'application/pdf' || doc.file_name?.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    await sendMessage(chatId, 'Please send your resume as a *PDF* file.');
    return;
  }

  const { user: existing } = await getOrCreateUser(chatId);
  let user = existing;
  await sendAction(chatId, 'upload_document');

  try {
    const { buffer, fileName } = await downloadTelegramFile(doc.file_id);
    const resumeUrl = await uploadResumeBuffer(buffer, doc.file_name ?? fileName);
    user = await prisma.user.update({
      where: { id: user.id },
      data: { resumeUrl },
    });

    const reply = await buildReplyAfterUpdate('resumeUrl', user);
    await sendMessage(chatId, reply);

    if (canApplyToJobs(user) && user.pendingApplyJobId) {
      await resumePendingApplication(user, chatId);
    }
  } catch (error) {
    console.error('Resume upload error:', error);
    await sendMessage(chatId, 'Could not save your resume. Please try sending the PDF again.');
  }
}

async function handleTextMessage(chatId: string, text: string) {
  const { user: initial, isNew } = await getOrCreateUser(chatId);
  if (isNew) {
    await sendMessage(chatId, WELCOME);
    return;
  }
  let user = initial;

  // Manual command override
  const cmd = text.toLowerCase().split(' ')[0];
  switch (cmd) {
    case '/findjobs':
      if (!canApplyToJobs(user)) {
        await sendMessage(chatId, "I need to finish your profile before we can search for jobs! Let's get that done first.");
        return;
      }
      await handleFindJobs(user, chatId, text);
      return;
    case '/me':
      await handleMe(user, chatId);
      return;
    case '/myapps':
      await handleMyApps(user, chatId);
      return;
    case '/resume':
      await sendMessage(chatId, 'Please send your resume as a *PDF file* (attach as document). I will update your profile automatically.');
      return;
    case '/help':
      await handleHelp(chatId);
      return;
  }

  const activeField = getActiveProfileField(user);
  
  // Use AI to process the message
  await sendAction(chatId, 'typing');
  const result = await processProfileMessage(user, text);

  // If AI detected a job search intent
  if (result.isJobSearch) {
    if (!canApplyToJobs(user)) {
      await sendMessage(chatId, result.reply || "I need to finish your profile before we can search for jobs! Let's get that done first.");
      return;
    }
    await handleFindJobs(user, chatId, result.searchQuery ?? text);
    return;
  }

  // If AI provided a direct reply (general question or fallback)
  if (result.reply && !result.data) {
    await sendMessage(chatId, result.reply);
    return;
  }

  // If AI extracted profile data
  if (result.data) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: result.data,
    });

    const reply = await buildReplyAfterUpdate(activeField!, user);
    await sendMessage(chatId, reply);

    if (canApplyToJobs(user) && user.pendingApplyJobId) {
      const fresh = await prisma.user.findUnique({ where: { id: user.id } });
      if (fresh) await resumePendingApplication(fresh, chatId);
    }
    return;
  }

  // Final fallback (should rarely happen with AI)
  if (!activeField) {
    await sendMessage(
      chatId,
      'Profile complete. Use `Find Jobs [role]` or tap *Apply* on a job from search results.'
    );
  } else {
    await sendMessage(chatId, await buildNextQuestion(activeField, user));
  }
}

async function handleMe(user: User, chatId: string) {
  const lines = [
    `*Your Profile*`,
    `👤 Name: ${[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}`,
    `📧 Email: ${user.email || '—'}`,
    `📱 Phone: ${user.phone || '—'}`,
    `📍 Location: ${user.location || '—'}`,
    `🏠 Remote: ${user.wantsRemote ? 'Yes' : 'No'}`,
    `🎯 Target Role: ${user.targetRole || '—'}`,
    `💰 Current: ${user.currentCtc || '—'}`,
    `🚀 Expected: ${user.expectedCtc || '—'}`,
    `📄 Resume: ${user.resumeUrl ? '[View PDF](' + user.resumeUrl + ')' : 'Not uploaded'}`,
  ];
  await sendMessage(chatId, lines.join('\n'));
}

async function handleMyApps(user: User, chatId: string) {
  const apps = await prisma.applicationLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (apps.length === 0) {
    await sendMessage(chatId, "You haven't applied to any jobs yet. Say `Find Jobs [role]` to start!");
    return;
  }

  const lines = [`*Recent Applications*`];
  apps.forEach((app, i) => {
    const status = app.status === 'APPLIED' ? '✅ Applied' : 
                   app.status === 'FAILED' ? '❌ Failed' : 
                   '⏳ In progress';
    lines.push(`${i + 1}. *${app.jobTitle}* at ${app.companyName}\n   Status: ${status}`);
  });

  await sendMessage(chatId, lines.join('\n\n'));
}

async function handleHelp(chatId: string) {
  const lines = [
    `*Available Commands*`,
    `🔍 \`Find Jobs [role]\` - Search for new jobs`,
    `👤 /me - View your current profile details`,
    `📄 /resume - Upload a new resume PDF`,
    `📊 /myapps - View your application history`,
    `❓ /help - Show this help message`,
    `🚀 /start - Restart or continue setup`,
    `\nYou can also just talk to me! Ask me anything about your job search or the application process.`,
  ];
  await sendMessage(chatId, lines.join('\n'));
}

async function handleFindJobs(user: User, chatId: string, text: string) {
  const query = extractJobQuery(text, user);

  if (!query) {
    const roleField = getActiveProfileField(user);
    if (roleField === 'targetRole') {
      await sendMessage(chatId, 'Tell me the role first — e.g. "Senior React Developer".');
      return;
    }
    await sendMessage(chatId, 'Which role should I search for? e.g. `Find Jobs Senior React Developer`');
    return;
  }

  if (!user.targetRole) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { targetRole: query },
    });
  }

  await sendAction(chatId, 'typing');

  const jobs = await searchRemotiveJobs({
    query,
    category: user.targetCategory,
    skills: user.skills,
    limit: 5,
  });

  if (jobs.length === 0) {
    await sendMessage(chatId, `No matches for "${query}" right now. Try different keywords.`);
    return;
  }

  let responseText = `*Matches for "${query}"* (Coral → Remotive)\n\n`;
  const inlineKeyboard = {
    inline_keyboard: jobs.map((job, index) => {
      const location = job.candidate_required_location ?? 'Worldwide';
      responseText += `${index + 1}. *${job.title}* at ${job.company_name}\n📍 ${location}\n[Listing](${job.url})\n\n`;
      return [{ text: `Apply #${index + 1}`, callback_data: `apply_${job.id}` }];
    }),
  };

  responseText += '_Source: [Remotive](https://remotive.com)_';

  await sendMessage(chatId, responseText, inlineKeyboard);
}

async function handleCallbackQuery(callbackQuery: {
  id: string;
  data: string;
  message: { chat: { id: number } };
}) {
  await answerCallbackQuery(callbackQuery.id);

  const chatId = callbackQuery.message.chat.id.toString();
  const data = callbackQuery.data;

  if (!data.startsWith('apply_')) return;

  const jobId = Number(data.replace('apply_', ''));
  if (!Number.isFinite(jobId)) return;

  const job = await getRemotiveJobById(jobId);
  if (!job) {
    await sendMessage(chatId, "That job isn't available anymore. Search again with `Find Jobs`.");
    return;
  }

  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (!user) {
    await prisma.user.create({ data: { telegramChatId: chatId } });
    await sendMessage(chatId, WELCOME);
    return;
  }

  if (!canApplyToJobs(user)) {
    const field = getActiveProfileField(user)!;
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingApplyJobId: String(jobId) },
    });
    await sendMessage(
      chatId,
      `To apply to *${job.title}*, I need a few details first.\n\n${await buildNextQuestion(field, user)}`
    );
    return;
  }

  try {
    await runJobApplication(user, job, chatId);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await sendMessage(chatId, `Could not apply: ${msg}`);
  }
}

/** Helper to generate next question using AI if needed. */
async function buildNextQuestion(field: any, user: User) {
  const { buildNextQuestion: b } = await import('@/lib/conversation');
  return await b(field, user);
}
