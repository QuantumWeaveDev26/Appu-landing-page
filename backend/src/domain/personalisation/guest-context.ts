import type { GuestMentorContext, GuestProfileInput } from './types.js';

/**
 * Builds the guest MentorContext. Without a profile it is the minimal three-field
 * context; a landing-page guest may add a nickname, class and favourite subject.
 */
export function buildGuestMentorContext(primaryLanguage: string, profile?: GuestProfileInput | null): GuestMentorContext {
  const context: GuestMentorContext = { mode: 'guest', primaryLanguage, personalizationEnabled: false };
  if (!profile) return context;
  if (profile.nickname) context.learnerName = profile.nickname;
  if (profile.grade) context.grade = 'Grade ' + profile.grade;
  if (profile.favoriteSubject) context.favoriteSubjects = [profile.favoriteSubject];
  return context;
}
