/**
 * Types for Proactive WhatsApp Automations (Phase 2 & Phase D).
 */

export const DEFAULT_TEMPLATE_LANGUAGE = 'en';

export interface MetaTemplateParameter {
  type: 'text';
  text: string;
}

export interface EligibleHouseholdTarget {
  householdId: string;
  parentPhone: string;
  childId: string;
  preferredName: string;
  nickname: string | null;
  effectiveName: string;
  gradeBand: string;
  dob: string | null;
  favoriteSubjects: string[];
}

export interface WeeklyActivityMetrics {
  sessionCount: number;
  userQuestionCount: number;
  totalMessageCount: number;
  recentTopics: string[];
  favoriteSubjects: string[];
}

export interface BirthdayTarget {
  householdId: string;
  parentPhone: string;
  childId: string;
  preferredName: string;
  nickname: string | null;
  effectiveName: string;
  gradeBand: string;
  dob: string;
}

export interface ProactiveTargetPayload {
  householdId: string;
  childId: string;
  recipientPhone: string;
  templateName: string;
  templateLanguage: string;
  parameters: MetaTemplateParameter[];
}

export interface ProactiveJobResponse {
  success: boolean;
  jobType: string;
  generatedAt: string;
  count: number;
  targets: ProactiveTargetPayload[];
}
