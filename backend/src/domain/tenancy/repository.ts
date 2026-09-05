import type { Queryable } from '../../db/types.js';
import type {
  Household,
  HouseholdMember,
  ChildProfile,
  CreateHouseholdInput,
  CreateHouseholdMemberInput,
  CreateChildProfileInput,
  UpdateChildProfileInput,
  HouseholdNotificationPreferences,
  UpdateHouseholdNotificationInput
} from './types.js';

// ==========================================
// DATABASE ROW INTERFACES (snake_case)
// ==========================================

interface HouseholdRow {
  id: string;
  name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface HouseholdMemberRow {
  id: string;
  household_id: string;
  user_id: string;
  role: 'OWNER' | 'PARENT';
  created_at: Date | string;
  updated_at: Date | string;
}

interface ChildProfileRow {
  id: string;
  household_id: string;
  preferred_name: string;
  grade_band: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  created_at: Date | string;
  updated_at: Date | string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function mapHouseholdRow(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapHouseholdMemberRow(row: HouseholdMemberRow): HouseholdMember {
  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id,
    role: row.role,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapChildProfileRow(row: ChildProfileRow): ChildProfile {
  return {
    id: row.id,
    householdId: row.household_id,
    preferredName: row.preferred_name,
    gradeBand: row.grade_band,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

// ==========================================
// TENANCY REPOSITORY IMPLEMENTATION
// ==========================================

export class TenancyRepository {
  /**
   * Creates a new household (the root tenant boundary).
   */
  public static async createHousehold(
    db: Queryable,
    input: CreateHouseholdInput = {}
  ): Promise<Household> {
    const result = await db.query<HouseholdRow>(
      `INSERT INTO households (name, created_at, updated_at)
       VALUES ($1, NOW(), NOW())
       RETURNING id, name, created_at, updated_at;`,
      [input.name ?? null]
    );

    return mapHouseholdRow(result.rows[0]);
  }

  /**
   * Retrieves a household by its primary key ID.
   */
  public static async getHouseholdById(
    db: Queryable,
    householdId: string
  ): Promise<Household | null> {
    const result = await db.query<HouseholdRow>(
      `SELECT id, name, created_at, updated_at
       FROM households
       WHERE id = $1;`,
      [householdId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapHouseholdRow(result.rows[0]);
  }

  /**
   * Adds a user to a household with a specific role (e.g. OWNER or PARENT).
   */
  public static async createHouseholdMember(
    db: Queryable,
    input: CreateHouseholdMemberInput
  ): Promise<HouseholdMember> {
    const result = await db.query<HouseholdMemberRow>(
      `INSERT INTO household_members (household_id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, household_id, user_id, role, created_at, updated_at;`,
      [input.householdId, input.userId, input.role]
    );

    return mapHouseholdMemberRow(result.rows[0]);
  }

  /**
   * Lists all members belonging to a household.
   */
  public static async getHouseholdMembers(
    db: Queryable,
    householdId: string
  ): Promise<HouseholdMember[]> {
    const result = await db.query<HouseholdMemberRow>(
      `SELECT id, household_id, user_id, role, created_at, updated_at
       FROM household_members
       WHERE household_id = $1
       ORDER BY created_at ASC;`,
      [householdId]
    );

    return result.rows.map(mapHouseholdMemberRow);
  }

  /**
   * Checks if a user is a member of a specific household.
   */
  public static async findMembership(
    db: Queryable,
    householdId: string,
    userId: string
  ): Promise<HouseholdMember | null> {
    const result = await db.query<HouseholdMemberRow>(
      `SELECT id, household_id, user_id, role, created_at, updated_at
       FROM household_members
       WHERE household_id = $1 AND user_id = $2;`,
      [householdId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapHouseholdMemberRow(result.rows[0]);
  }

  /**
   * Finds all household memberships belonging to a specific user.
   */
  public static async findMembershipsByUserId(
    db: Queryable,
    userId: string
  ): Promise<HouseholdMember[]> {
    const result = await db.query<HouseholdMemberRow>(
      `SELECT id, household_id, user_id, role, created_at, updated_at
       FROM household_members
       WHERE user_id = $1
       ORDER BY created_at ASC;`,
      [userId]
    );

    return result.rows.map(mapHouseholdMemberRow);
  }

  /**
   * Consolidated single-roundtrip query resolving a user's primary household and active membership.
   */
  public static async getPrimaryHouseholdForUser(
    db: Queryable,
    userId: string
  ): Promise<{ household: Household; member: HouseholdMember } | null> {
    const result = await db.query<HouseholdMemberRow & HouseholdRow & { member_id: string; member_created_at: Date | string; member_updated_at: Date | string }>(
      `SELECT hm.id AS member_id, hm.household_id, hm.user_id, hm.role, hm.created_at AS member_created_at, hm.updated_at AS member_updated_at,
              h.id, h.name, h.created_at, h.updated_at
       FROM household_members hm
       JOIN households h ON h.id = hm.household_id
       WHERE hm.user_id = $1
       ORDER BY hm.created_at ASC
       LIMIT 1;`,
      [userId.trim()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      household: {
        id: row.id,
        name: row.name,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      member: {
        id: row.member_id,
        householdId: row.household_id,
        userId: row.user_id,
        role: row.role,
        createdAt: new Date(row.member_created_at),
        updatedAt: new Date(row.member_updated_at)
      }
    };
  }

  /**
   * Creates a child profile strictly under a household.
   */
  public static async createChildProfile(
    db: Queryable,
    input: CreateChildProfileInput
  ): Promise<ChildProfile> {
    const status = input.status ?? 'ACTIVE';

    const result = await db.query<ChildProfileRow>(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, household_id, preferred_name, grade_band, status, created_at, updated_at;`,
      [input.householdId, input.preferredName, input.gradeBand, status]
    );

    return mapChildProfileRow(result.rows[0]);
  }

  /**
   * Retrieves a child profile.
   * STRICT REQUIREMENT: Must provide BOTH householdId and childId.
   * Will return null if the child does not belong to the given household.
   */
  public static async getChildProfile(
    db: Queryable,
    householdId: string,
    childId: string
  ): Promise<ChildProfile | null> {
    const result = await db.query<ChildProfileRow>(
      `SELECT id, household_id, preferred_name, grade_band, status, created_at, updated_at
       FROM child_profiles
       WHERE household_id = $1 AND id = $2;`,
      [householdId, childId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapChildProfileRow(result.rows[0]);
  }

  /**
   * Lists all child profiles belonging to a specific household.
   */
  public static async listChildProfilesByHousehold(
    db: Queryable,
    householdId: string
  ): Promise<ChildProfile[]> {
    const result = await db.query<ChildProfileRow>(
      `SELECT id, household_id, preferred_name, grade_band, status, created_at, updated_at
       FROM child_profiles
       WHERE household_id = $1
       ORDER BY created_at ASC;`,
      [householdId]
    );

    return result.rows.map(mapChildProfileRow);
  }

  /**
   * Counts total child profiles belonging to a specific household.
   */
  public static async countChildProfilesByHousehold(
    db: Queryable,
    householdId: string
  ): Promise<number> {
    const result = await db.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count
       FROM child_profiles
       WHERE household_id = $1;`,
      [householdId]
    );

    if (result.rows.length === 0) {
      return 0;
    }

    return parseInt(String(result.rows[0].count), 10) || 0;
  }

  /**
   * Updates a child profile.
   * STRICT REQUIREMENT: Scoped by both householdId and childId.
   */
  public static async updateChildProfile(
    db: Queryable,
    householdId: string,
    childId: string,
    input: UpdateChildProfileInput
  ): Promise<ChildProfile | null> {
    const fields: string[] = [];
    const values: any[] = [householdId, childId];
    let idx = 3;

    if (input.preferredName !== undefined) {
      fields.push(`preferred_name = $${idx++}`);
      values.push(input.preferredName);
    }

    if (input.gradeBand !== undefined) {
      fields.push(`grade_band = $${idx++}`);
      values.push(input.gradeBand);
    }

    if (input.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(input.status);
    }

    if (fields.length === 0) {
      return TenancyRepository.getChildProfile(db, householdId, childId);
    }

    fields.push('updated_at = NOW()');

    const result = await db.query<ChildProfileRow>(
      `UPDATE child_profiles
       SET ${fields.join(', ')}
       WHERE household_id = $1 AND id = $2
       RETURNING id, household_id, preferred_name, grade_band, status, created_at, updated_at;`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapChildProfileRow(result.rows[0]);
  }

  /**
   * Deletes a child profile.
   * STRICT REQUIREMENT: Scoped by both householdId and childId.
   */
  public static async deleteChildProfile(
    db: Queryable,
    householdId: string,
    childId: string
  ): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM child_profiles
       WHERE household_id = $1 AND id = $2;`,
      [householdId, childId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Retrieves household-scoped notification and WhatsApp communication preferences.
   */
  public static async getNotificationPreferences(
    db: Queryable,
    householdId: string
  ): Promise<HouseholdNotificationPreferences> {
    const result = await db.query<{
      parent_phone: string | null;
      whatsapp_consent: boolean | null;
      whatsapp_consent_at: Date | string | null;
    }>(
      `SELECT parent_phone, whatsapp_consent, whatsapp_consent_at
       FROM households
       WHERE id = $1;`,
      [householdId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Household not found: ${householdId}`);
    }

    const row = result.rows[0];
    return {
      parentPhone: row.parent_phone ?? null,
      whatsappConsent: Boolean(row.whatsapp_consent),
      whatsappConsentAt: row.whatsapp_consent_at ? new Date(row.whatsapp_consent_at) : null
    };
  }

  /**
   * Updates household parent phone and WhatsApp opt-in consent.
   */
  public static async updateNotificationPreferences(
    db: Queryable,
    householdId: string,
    input: UpdateHouseholdNotificationInput
  ): Promise<HouseholdNotificationPreferences> {
    const current = await TenancyRepository.getNotificationPreferences(db, householdId);

    let parentPhone: string | null = current.parentPhone;
    if (input.parentPhone !== undefined) {
      parentPhone = normalizePhoneNumber(input.parentPhone);
    }

    const whatsappConsent = input.whatsappConsent !== undefined
      ? Boolean(input.whatsappConsent)
      : current.whatsappConsent;

    // Invariant: Consent cannot be granted without a valid parent phone
    if (whatsappConsent && !parentPhone) {
      throw new Error('Parent phone number is required when granting WhatsApp consent');
    }

    let whatsappConsentAt: Date | null = current.whatsappConsentAt;
    if (whatsappConsent) {
      // If newly granted or missing timestamp, record current time
      if (!current.whatsappConsent || !whatsappConsentAt) {
        whatsappConsentAt = new Date();
      }
    } else {
      // Explicit revocation clears the consent timestamp
      whatsappConsentAt = null;
    }

    const result = await db.query<{
      parent_phone: string | null;
      whatsapp_consent: boolean | null;
      whatsapp_consent_at: Date | string | null;
    }>(
      `UPDATE households
       SET parent_phone = $2,
           whatsapp_consent = $3,
           whatsapp_consent_at = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING parent_phone, whatsapp_consent, whatsapp_consent_at;`,
      [householdId, parentPhone, whatsappConsent, whatsappConsentAt]
    );

    if (result.rows.length === 0) {
      throw new Error(`Household not found: ${householdId}`);
    }

    const row = result.rows[0];
    return {
      parentPhone: row.parent_phone ?? null,
      whatsappConsent: Boolean(row.whatsapp_consent),
      whatsappConsentAt: row.whatsapp_consent_at ? new Date(row.whatsapp_consent_at) : null
    };
  }
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/;
const INDIAN_10_DIGIT_REGEX = /^[6-9]\d{9}$/;

export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Remove whitespace, hyphens, and parentheses
  const cleaned = trimmed.replace(/[\s\-()]/g, '');
  if (!cleaned) return null;

  // If Indian 10-digit without country code, prepend +91
  if (INDIAN_10_DIGIT_REGEX.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If starts with 91 and has 12 digits, prepend +
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If already starts with +
  if (cleaned.startsWith('+')) {
    if (!E164_REGEX.test(cleaned)) {
      throw new Error(`Invalid phone number format. Expected international E.164 format (e.g. +919876543210), got "${raw}"`);
    }
    return cleaned;
  }

  // Otherwise, if plain digits between 7 and 15 digits, prepend +
  if (!/^\d{7,15}$/.test(cleaned)) {
    throw new Error(`Invalid phone number format. Expected international E.164 format (e.g. +919876543210), got "${raw}"`);
  }

  const withPlus = `+${cleaned}`;
  if (!E164_REGEX.test(withPlus)) {
    throw new Error(`Invalid phone number format. Expected international E.164 format (e.g. +919876543210), got "${raw}"`);
  }
  return withPlus;
}

