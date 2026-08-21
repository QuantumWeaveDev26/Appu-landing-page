import type { Queryable } from '../../db/types.js';
import type {
  ChildPersonalisation,
  UpdateChildPersonalisationInput,
  FontPreference,
  LearningStyle,
  ResponseStyle,
  ThemePreference
} from './types.js';

interface ChildPersonalisationRow {
  id: string;
  household_id: string;
  child_id: string;
  preferred_language: string;
  favorite_color: string | null;
  font_preference: string;
  learning_style: string;
  interests: unknown;
  favorite_subjects: unknown;
  goals: unknown;
  response_style: string;
  voice_preference: string;
  theme_preference: string;
  additional_context: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

function parseStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.filter((item) => typeof item === 'string');
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string');
      }
    } catch {
      return [];
    }
  }
  return [];
}

function mapPersonalisationRow(row: ChildPersonalisationRow): ChildPersonalisation {
  return {
    id: row.id,
    householdId: row.household_id,
    childId: row.child_id,
    preferredLanguage: row.preferred_language,
    favoriteColor: row.favorite_color,
    fontPreference: row.font_preference as FontPreference,
    learningStyle: row.learning_style as LearningStyle,
    interests: parseStringArray(row.interests),
    favoriteSubjects: parseStringArray(row.favorite_subjects),
    goals: parseStringArray(row.goals),
    responseStyle: row.response_style as ResponseStyle,
    voicePreference: row.voice_preference,
    themePreference: row.theme_preference as ThemePreference,
    additionalContext: (row.additional_context as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export class PersonalisationRepository {
  /**
   * Retrieves personalisation profile for a child strictly scoped to the household.
   */
  public static async getPersonalisation(
    db: Queryable,
    householdId: string,
    childId: string
  ): Promise<ChildPersonalisation | null> {
    const result = await db.query<ChildPersonalisationRow>(
      `SELECT id, household_id, child_id, preferred_language, favorite_color,
              font_preference, learning_style, interests, favorite_subjects,
              goals, response_style, voice_preference, theme_preference,
              additional_context, created_at, updated_at
       FROM child_personalisation
       WHERE household_id = $1 AND child_id = $2;`,
      [householdId, childId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapPersonalisationRow(result.rows[0]);
  }

  /**
   * Upserts personalisation profile for a child strictly scoped to the household.
   */
  public static async upsertPersonalisation(
    db: Queryable,
    householdId: string,
    childId: string,
    input: UpdateChildPersonalisationInput
  ): Promise<ChildPersonalisation> {
    const preferredLanguage = input.preferredLanguage ?? 'en';
    const favoriteColor = input.favoriteColor ?? null;
    const fontPreference = input.fontPreference ?? 'friendly';
    const learningStyle = input.learningStyle ?? 'visual';
    const interests = JSON.stringify(input.interests ?? []);
    const favoriteSubjects = JSON.stringify(input.favoriteSubjects ?? []);
    const goals = JSON.stringify(input.goals ?? []);
    const responseStyle = input.responseStyle ?? 'playful';
    const voicePreference = input.voicePreference ?? 'default';
    const themePreference = input.themePreference ?? 'auto';
    const additionalContext = JSON.stringify(input.additionalContext ?? {});

    const result = await db.query<ChildPersonalisationRow>(
      `INSERT INTO child_personalisation (
        household_id, child_id, preferred_language, favorite_color,
        font_preference, learning_style, interests, favorite_subjects,
        goals, response_style, voice_preference, theme_preference,
        additional_context, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       ON CONFLICT (household_id, child_id) DO UPDATE SET
        preferred_language = EXCLUDED.preferred_language,
        favorite_color = EXCLUDED.favorite_color,
        font_preference = EXCLUDED.font_preference,
        learning_style = EXCLUDED.learning_style,
        interests = EXCLUDED.interests,
        favorite_subjects = EXCLUDED.favorite_subjects,
        goals = EXCLUDED.goals,
        response_style = EXCLUDED.response_style,
        voice_preference = EXCLUDED.voice_preference,
        theme_preference = EXCLUDED.theme_preference,
        additional_context = EXCLUDED.additional_context,
        updated_at = NOW()
       RETURNING id, household_id, child_id, preferred_language, favorite_color,
                 font_preference, learning_style, interests, favorite_subjects,
                 goals, response_style, voice_preference, theme_preference,
                 additional_context, created_at, updated_at;`,
      [
        householdId,
        childId,
        preferredLanguage,
        favoriteColor,
        fontPreference,
        learningStyle,
        interests,
        favoriteSubjects,
        goals,
        responseStyle,
        voicePreference,
        themePreference,
        additionalContext
      ]
    );

    return mapPersonalisationRow(result.rows[0]);
  }
}
