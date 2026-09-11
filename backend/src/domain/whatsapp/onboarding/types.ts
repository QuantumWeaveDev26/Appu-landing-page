import type { LearningStyle, ResponseStyle } from '../../personalisation/types.js';

export const REQUIRED_ONBOARDING_FIELDS = [
  'name',
  'grade',
  'dob',
  'preferredLanguage',
  'favoriteSubjects',
  'interests',
  'learningStyle',
  'responseStyle',
  'goals',
  'whatsappConsent'
] as const;

export type WhatsAppRequiredField = (typeof REQUIRED_ONBOARDING_FIELDS)[number];

export const SUPPORTED_ONBOARDING_FIELDS = [
  ...REQUIRED_ONBOARDING_FIELDS,
  'nickname'
] as const;

export type WhatsAppSupportedField = (typeof SUPPORTED_ONBOARDING_FIELDS)[number];

export interface WhatsAppPersonalisationState {
  name: string | null;
  nickname: string | null;
  grade: string | null;
  dob: string | null;
  preferredLanguage: string;
  favoriteSubjects: string[];
  interests: string[];
  learningStyle: LearningStyle | null;
  responseStyle: ResponseStyle | null;
  goals: string[];
  whatsappConsent: boolean;
}

export interface WhatsAppOnboardingStateResult {
  recognized: boolean;
  complete: boolean;
  missingFields: WhatsAppRequiredField[];
  nextPromptField: WhatsAppRequiredField | null;
  householdId: string | null;
  childId: string | null;
  personalisation: WhatsAppPersonalisationState | null;
}

export interface WhatsAppSaveStepSingleInput {
  phone: string;
  field: WhatsAppSupportedField;
  value: unknown;
}

export interface WhatsAppSaveStepBatchInput {
  phone: string;
  fields: Partial<Record<WhatsAppSupportedField, unknown>>;
}

export type WhatsAppSaveStepInput = WhatsAppSaveStepSingleInput | WhatsAppSaveStepBatchInput;

export interface WhatsAppSaveStepResult extends WhatsAppOnboardingStateResult {
  success: boolean;
}
