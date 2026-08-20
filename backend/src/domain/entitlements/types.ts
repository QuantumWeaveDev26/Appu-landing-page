export type EntitlementValueType = 'boolean' | 'integer' | 'string';

export type EntitlementValue = boolean | number | string;

export interface EntitlementDefinition {
  readonly key: string;
  readonly type: EntitlementValueType;
  readonly defaultValue: EntitlementValue;
  readonly description: string;
  readonly unit?: string;
  readonly min?: number;
  readonly max?: number;
  readonly allowedValues?: readonly string[];
}

export const InitialEntitlementKeys = {
  MAX_CHILDREN: 'max_children',
  MONTHLY_VOICE_MINUTES: 'monthly_voice_minutes',
  MONTHLY_AI_SESSIONS: 'monthly_ai_sessions',
  MULTILINGUAL: 'multilingual',
  ADVANCED_PERSONALISATION: 'advanced_personalisation',
  PARENT_REPORTS: 'parent_reports',
  LONG_TERM_CONTEXT: 'long_term_context',
  PREMIUM_THEMES: 'premium_themes'
} as const;

export type InitialEntitlementKey = (typeof InitialEntitlementKeys)[keyof typeof InitialEntitlementKeys];

export type EntitlementsMap = Record<string, EntitlementValue>;
