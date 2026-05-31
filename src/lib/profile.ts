import type { User } from '@prisma/client';

export type ProfileFieldKey =
  | 'wantsRemote'
  | 'location'
  | 'experienceSummary'
  | 'currentCtc'
  | 'expectedCtc'
  | 'targetRole'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'resumeUrl';

const FIELD_ORDER: ProfileFieldKey[] = [
  'wantsRemote',
  'location',
  'experienceSummary',
  'currentCtc',
  'expectedCtc',
  'targetRole',
  'firstName',
  'lastName',
  'email',
  'phone',
  'resumeUrl',
];

export function isFieldMissing(user: User, key: ProfileFieldKey): boolean {
  switch (key) {
    case 'wantsRemote':
      return user.wantsRemote === null || user.wantsRemote === undefined;
    case 'resumeUrl':
      return !user.resumeUrl;
    default:
      return !(user[key] as string | null | undefined)?.toString().trim();
  }
}

export function getActiveProfileField(user: User): ProfileFieldKey | null {
  for (const key of FIELD_ORDER) {
    if (isFieldMissing(user, key)) return key;
  }
  return null;
}

export function getMissingProfileFields(user: User): string[] {
  const labels: Record<ProfileFieldKey, string> = {
    wantsRemote: 'remote preference',
    location: 'location',
    experienceSummary: 'experience',
    currentCtc: 'current CTC',
    expectedCtc: 'expected CTC',
    targetRole: 'target role',
    firstName: 'first name',
    lastName: 'last name',
    email: 'email',
    phone: 'phone',
    resumeUrl: 'resume PDF',
  };
  return FIELD_ORDER.filter((k) => isFieldMissing(user, k)).map((k) => labels[k]);
}

export function canSearchJobs(user: User): boolean {
  return Boolean(user.targetRole?.trim());
}

export function canApplyToJobs(user: User): boolean {
  return getActiveProfileField(user) === null;
}

export type ApplicationUserData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedInUrl?: string | null;
  portfolioUrl?: string | null;
  currentTitle?: string | null;
};

export function toApplicationUserData(user: User): ApplicationUserData {
  return {
    firstName: user.firstName!,
    lastName: user.lastName!,
    email: user.email!,
    phone: user.phone!,
    location: user.location!,
    linkedInUrl: user.linkedInUrl,
    portfolioUrl: user.portfolioUrl,
    currentTitle: user.currentTitle,
  };
}
