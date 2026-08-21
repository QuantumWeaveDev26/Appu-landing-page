export const FontPreferences = ['friendly', 'rounded', 'clean'] as const;
export type FontPreference = (typeof FontPreferences)[number];

export const LearningStyles = [
  'visual',
  'auditory',
  'kinesthetic',
  'reading_writing',
  'interactive'
] as const;
export type LearningStyle = (typeof LearningStyles)[number];

export const ResponseStyles = ['playful', 'balanced', 'focused'] as const;
export type ResponseStyle = (typeof ResponseStyles)[number];

export const ThemePreferences = ['auto', 'bright', 'calm'] as const;
export type ThemePreference = (typeof ThemePreferences)[number];

export interface ChildPersonalisation {
  id: string;
  householdId: string;
  childId: string;
  preferredLanguage: string;
  favoriteColor: string | null;
  fontPreference: FontPreference;
  learningStyle: LearningStyle;
  interests: string[];
  favoriteSubjects: string[];
  goals: string[];
  responseStyle: ResponseStyle;
  voicePreference: string;
  themePreference: ThemePreference;
  additionalContext: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateChildPersonalisationInput {
  preferredLanguage?: string;
  favoriteColor?: string | null;
  fontPreference?: FontPreference;
  learningStyle?: LearningStyle;
  interests?: string[];
  favoriteSubjects?: string[];
  goals?: string[];
  responseStyle?: ResponseStyle;
  voicePreference?: string;
  themePreference?: ThemePreference;
  additionalContext?: Record<string, unknown>;
}

export interface ChildAIContext {
  child: {
    id: string;
    preferredName: string;
    gradeBand: string;
  };
  preferences: {
    language: string;
    learningStyle: string;
    interests: string[];
    favoriteSubjects: string[];
    goals: string[];
    responseStyle: string;
  };
  presentation: {
    favoriteColor: string | null;
    fontPreference: string;
    themePreference: string;
  };
  entitlements: {
    multilingual: boolean;
    advancedPersonalisation: boolean;
    longTermContext: boolean;
  };
}
