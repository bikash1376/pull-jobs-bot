import type { Prisma, User } from '@prisma/client';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { chatModel } from './ai';
import {
  getActiveProfileField,
  canApplyToJobs,
  type ProfileFieldKey,
} from '@/lib/profile';

const QUESTIONS: Record<ProfileFieldKey, string> = {
  wantsRemote: 'Are you looking for *remote-only* jobs? (yes / no)',
  location: 'Where are you based? (city & country)',
  experienceSummary:
    'Tell me about your experience — roles, years, main stack (a short paragraph is fine).',
  currentCtc: 'What is your *current* CTC or salary?',
  expectedCtc: 'What *expected* CTC or salary are you aiming for?',
  targetRole: 'What *role* are you looking for? (e.g. Senior React Developer)',
  firstName: 'What is your *first name*?',
  lastName: 'What is your *last name*?',
  email: 'What is your *email* for applications?',
  phone: 'What is your *phone number*? (include country code)',
  resumeUrl: 'Please send your resume as a *PDF file* in this chat (attach document).',
};

const SAVED_LABEL: Record<ProfileFieldKey, string> = {
  wantsRemote: 'Remote preference',
  location: 'Location',
  experienceSummary: 'Experience',
  currentCtc: 'Current CTC',
  expectedCtc: 'Expected CTC',
  targetRole: 'Target role',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  resumeUrl: 'Resume',
};

/** Use AI to parse the user's message based on the current context. */
export async function processProfileMessage(
  user: User,
  text: string
): Promise<{ reply: string; data?: Prisma.UserUpdateInput; profileComplete: boolean; isJobSearch?: boolean; searchQuery?: string }> {
  // Prevent commands from being parsed as data
  if (text.startsWith('/')) {
    return {
      reply: '',
      profileComplete: false
    };
  }

  const field = getActiveProfileField(user);

  // 1. Identify intent using AI
  const { object: intent } = await generateObject({
    model: chatModel,
    schema: z.object({
      intent: z.enum(['answer_profile', 'job_search', 'general_question', 'other']),
      searchQuery: z.string().optional().describe('The job role/title if intent is job_search'),
      extractedValue: z.string().optional().describe('The extracted value for the current profile field if intent is answer_profile. For yes/no, return "true" or "false".'),
      firstName: z.string().optional().describe('First name if intent is answer_profile and we are asking for name'),
      lastName: z.string().optional().describe('Last name if intent is answer_profile and we are asking for name'),
      explanation: z.string().optional().describe('Brief reason for this classification'),
    }),
    prompt: `You are a job application assistant. 
User is currently being asked: ${field ? QUESTIONS[field] : 'nothing (profile complete)'}
Current field: ${field ?? 'none'}

User message: "${text}"

Task:
1. Determine the user's intent:
   - 'answer_profile': Providing information for the current question.
   - 'job_search': Asking to find or search for jobs.
   - 'general_question': Asking about the bot, the process, or general help.
   - 'other': Anything else.
2. If intent is 'answer_profile', extract the value for '${field}'.
   - For 'wantsRemote', return "true" if they want remote, "false" if not.
   - For 'email', 'phone', 'location', etc., extract the clean value.
   - If the field is 'firstName' and they provided a full name, extract both 'firstName' and 'lastName'.
3. If intent is 'job_search', extract the 'searchQuery' (the job title/role).`,
  });

  // If profile is incomplete, force them to answer the questions first
  if (field && intent.intent === 'job_search') {
    return {
      reply: `I'd love to help you find jobs, but I need a few more details to complete your profile first. Let's finish that, and then we can search!`,
      profileComplete: false,
    };
  }

  if (intent.intent === 'job_search') {
    return {
      reply: '',
      isJobSearch: true,
      searchQuery: intent.searchQuery,
      profileComplete: !field,
    };
  }

  if (intent.intent === 'general_question' || intent.intent === 'other') {
    const { text: aiReply } = await generateText({
      model: chatModel,
      prompt: `You are AgentApply, a friendly job application assistant. 
The user is in the middle of ${field ? `setting up their profile (currently at ${field})` : 'searching for jobs'}.
User asked: "${text}"
Respond naturally to their question or comment. Keep it brief. 
If they seem stuck, guide them back to ${field ? `answering: ${QUESTIONS[field]}` : 'searching for jobs'}.`,
    });
    return {
      reply: aiReply,
      profileComplete: !field,
    };
  }

  if (!field) {
    return {
      reply: canApplyToJobs(user)
        ? 'Profile is done. Say `Find Jobs [role]` or tap Apply on a job listing.'
        : 'Send /start to continue setup.',
      profileComplete: true,
    };
  }

  // Handle profile answer
  if (intent.intent === 'answer_profile') {
    const data: Prisma.UserUpdateInput = {};
    const val = intent.extractedValue;

    if (val !== undefined) {
      switch (field) {
        case 'wantsRemote': {
          const sVal = String(val).toLowerCase();
          data.wantsRemote = sVal === 'true' || sVal === 'yes' || sVal === '1';
          break;
        }
        case 'email': data.email = String(val); break;
        case 'phone': data.phone = String(val); break;
        case 'firstName': {
          data.firstName = intent.firstName || String(val);
          if (intent.lastName) data.lastName = intent.lastName;
          break;
        }
        case 'lastName': data.lastName = String(val); break;
        case 'location': data.location = String(val); break;
        case 'experienceSummary': data.experienceSummary = String(val); break;
        case 'currentCtc': data.currentCtc = String(val); break;
        case 'expectedCtc': data.expectedCtc = String(val); break;
        case 'targetRole': data.targetRole = String(val); break;
      }

      return {
        reply: '',
        data,
        profileComplete: false,
      };
    }
  }

  // Fallback if AI couldn't extract but it looked like an answer
  return {
    reply: `I didn't quite catch that. ${QUESTIONS[field]}`,
    profileComplete: false,
  };
}

export function getQuestionForField(field: ProfileFieldKey): string {
  return QUESTIONS[field];
}

/** Generate a natural-sounding question using AI. */
export async function buildNextQuestion(field: ProfileFieldKey, user: User, justSavedLabel?: string): Promise<string> {
  const q = QUESTIONS[field];
  
  // Special handling for Name field to ask for "Full Name"
  const targetQuestion = (field === 'firstName' && !user.lastName) ? 'What is your full name?' : q;

  const { text } = await generateText({
    model: chatModel,
    prompt: `You are AgentApply, a friendly, human-like job assistant.
${justSavedLabel ? `You just successfully saved the user's ${justSavedLabel}.` : ''}
Now you need to ask them for their ${field}.
The base question is: "${targetQuestion}"

Write a natural, warm, and brief response that ${justSavedLabel ? 'acknowledges the save and ' : ''}asks the next question.
Do not use robotic placeholders. Use emojis occasionally if appropriate.`,
  });

  return text;
}

export async function buildAfterSaveMessage(savedField: ProfileFieldKey, user: User): Promise<string> {
  const label = SAVED_LABEL[savedField];
  const next = getActiveProfileField(user);

  if (!next) {
    const { text } = await generateText({
      model: chatModel,
      prompt: `You are AgentApply, a friendly job assistant. 
The user just finished their profile. Acknowledge this warmly.
Tell them they can now:
1. Search for jobs by saying "Find Jobs [role]"
2. View their profile with /me
3. View their applications with /myapps
Keep it very brief and natural.`,
    });
    return text;
  }

  return await buildNextQuestion(next, user, label);
}

export async function buildWelcomeBackMessage(user: User): Promise<string> {
  const next = getActiveProfileField(user);
  if (!next) {
    return `Welcome back! Profile complete. Use \`Find Jobs ${user.targetRole ?? '[role]'}\` or tap Apply on listings.`;
  }

  const { text } = await generateText({
    model: chatModel,
    prompt: `You are AgentApply. The user just returned to the chat.
They still need to fill out their ${next}.
Ask them naturally to continue where they left off. 
The next question is: "${QUESTIONS[next]}"`,
  });
  
  return text;
}

export function wantsToFindJobs(text: string): boolean {
  return false; 
}

export function extractJobQuery(text: string, user: User): string {
  const fromCmd = text.replace(/^\/findjobs\s*/i, '').replace(/^find jobs\s*/i, '').trim();
  if (fromCmd) return fromCmd;
  if (user.targetRole) return user.targetRole;
  return '';
}

export function buildReplyAfterUpdate(savedField: ProfileFieldKey, updatedUser: User): Promise<string> {
  return buildAfterSaveMessage(savedField, updatedUser);
}
