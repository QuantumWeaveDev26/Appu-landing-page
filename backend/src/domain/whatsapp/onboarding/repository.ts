import type { Queryable } from '../../../db/types.js';
import { normalizePhoneNumber, TenancyRepository } from '../../tenancy/repository.js';
import { PersonalisationRepository } from '../../personalisation/repository.js';
import type { ChildProfile, HouseholdWithConsent } from '../../tenancy/types.js';
import type { ChildPersonalisation, UpdateChildPersonalisationInput } from '../../personalisation/types.js';

export class WhatsAppOnboardingRepository {
  /**
   * Resolves a household by normalized parent phone number, irrespective of whether WhatsApp consent has been granted.
   * Returns null if no match or invalid phone.
   */
  public static async findHouseholdByPhone(
    db: Queryable,
    rawPhone: string
  ): Promise<HouseholdWithConsent | null> {
    let normalized: string | null = null;
    try {
      normalized = normalizePhoneNumber(rawPhone);
    } catch {
      return null;
    }

    if (!normalized) {
      return null;
    }

    const result = await db.query<{
      id: string;
      name: string | null;
      parent_phone: string | null;
      whatsapp_consent: boolean | null;
      whatsapp_consent_at: Date | string | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT id, name, parent_phone, whatsapp_consent, whatsapp_consent_at, created_at, updated_at
       FROM households
       WHERE parent_phone = $1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1;`,
      [normalized]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      parentPhone: row.parent_phone ?? null,
      whatsappConsent: Boolean(row.whatsapp_consent),
      whatsappConsentAt: row.whatsapp_consent_at ? new Date(row.whatsapp_consent_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Atomically creates a phone-only household without a Supabase auth member.
   */
  public static async createPhoneOnlyHousehold(
    db: Queryable,
    normalizedPhone: string,
    name?: string | null
  ): Promise<HouseholdWithConsent> {
    const result = await db.query<{
      id: string;
      name: string | null;
      parent_phone: string | null;
      whatsapp_consent: boolean | null;
      whatsapp_consent_at: Date | string | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `INSERT INTO households (name, parent_phone, whatsapp_consent, created_at, updated_at)
       VALUES ($1, $2, FALSE, NOW(), NOW())
       RETURNING id, name, parent_phone, whatsapp_consent, whatsapp_consent_at, created_at, updated_at;`,
      [name ?? 'Learner Household', normalizedPhone]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      parentPhone: row.parent_phone ?? null,
      whatsappConsent: Boolean(row.whatsapp_consent),
      whatsappConsentAt: row.whatsapp_consent_at ? new Date(row.whatsapp_consent_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Resolves the primary active child profile for the household.
   */
  public static async findActiveChild(
    db: Queryable,
    householdId: string
  ): Promise<ChildProfile | null> {
    const children = await TenancyRepository.listChildProfilesByHousehold(db, householdId);
    if (!children || children.length === 0) {
      return null;
    }
    return children.find((c) => c.status === 'ACTIVE') || children[0];
  }

  /**
   * Creates a default child profile for a phone-only household.
   */
  public static async createChildProfile(
    db: Queryable,
    householdId: string,
    preferredName: string = 'Learner',
    gradeBand: string = 'Not set'
  ): Promise<ChildProfile> {
    return TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName,
      gradeBand,
      status: 'ACTIVE'
    });
  }

  /**
   * Updates household name if not explicitly customized.
   */
  public static async updateHouseholdName(
    db: Queryable,
    householdId: string,
    name: string
  ): Promise<void> {
    await db.query(
      `UPDATE households
       SET name = $2, updated_at = NOW()
       WHERE id = $1;`,
      [householdId, name]
    );
  }

  /**
   * Updates notification consent for the household.
   */
  public static async updateWhatsAppConsent(
    db: Queryable,
    householdId: string,
    consent: boolean
  ): Promise<void> {
    const consentAt = consent ? 'NOW()' : 'NULL';
    await db.query(
      `UPDATE households
       SET whatsapp_consent = $2,
           whatsapp_consent_at = ${consentAt},
           updated_at = NOW()
       WHERE id = $1;`,
      [householdId, consent]
    );
  }

  /**
   * Incrementally updates personalization by merging existing data with new fields.
   */
  public static async mergePersonalisation(
    db: Queryable,
    householdId: string,
    childId: string,
    patch: UpdateChildPersonalisationInput
  ): Promise<ChildPersonalisation> {
    const existing = await PersonalisationRepository.getPersonalisation(db, householdId, childId);

    const mergedInput: UpdateChildPersonalisationInput = {
      preferredLanguage: patch.preferredLanguage ?? existing?.preferredLanguage ?? 'en',
      favoriteColor: patch.favoriteColor !== undefined ? patch.favoriteColor : existing?.favoriteColor ?? null,
      fontPreference: patch.fontPreference ?? existing?.fontPreference ?? 'friendly',
      learningStyle: patch.learningStyle ?? existing?.learningStyle ?? 'visual',
      interests: patch.interests ?? existing?.interests ?? [],
      favoriteSubjects: patch.favoriteSubjects ?? existing?.favoriteSubjects ?? [],
      goals: patch.goals ?? existing?.goals ?? [],
      responseStyle: patch.responseStyle ?? existing?.responseStyle ?? 'playful',
      voicePreference: patch.voicePreference ?? existing?.voicePreference ?? 'default',
      themePreference: patch.themePreference ?? existing?.themePreference ?? 'auto',
      additionalContext: patch.additionalContext ?? existing?.additionalContext ?? {}
    };

    return PersonalisationRepository.upsertPersonalisation(db, householdId, childId, mergedInput);
  }
}
