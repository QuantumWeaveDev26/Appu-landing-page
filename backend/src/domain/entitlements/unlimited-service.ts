import type { Queryable } from '../../db/types.js';

export const DEFAULT_UNLIMITED_EMAILS: readonly string[] = [
  'ceo@brandmintai.io',
  'vishak.b7@gmail.com',
  'naveenreddy95190@gmail.com',
  'kaaranji@brandmintai.io'
];

/**
 * Parses raw comma-separated or array of emails into a normalized lowercased Set.
 */
export function parseUnlimitedEmails(raw?: string | string[] | Set<string>): Set<string> {
  if (raw instanceof Set) {
    return new Set(Array.from(raw).map((e) => String(e).trim().toLowerCase()).filter(Boolean));
  }
  if (Array.isArray(raw)) {
    return new Set(raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean));
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return new Set(
      raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    );
  }
  return new Set(DEFAULT_UNLIMITED_EMAILS.map((e) => e.toLowerCase()));
}

/**
 * Validates whether an authenticated user email belongs to the unlimited server-side allowlist.
 * Comparison is strictly case-insensitive and whitespace-trimmed.
 */
export function isUnlimitedEmail(
  email: string | null | undefined,
  allowlist?: string | string[] | Set<string>
): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const set = parseUnlimitedEmails(allowlist);
  return set.has(normalized);
}

/**
 * Ensures an active, uncapped 'unlimited' subscription and plan exists for the household.
 * If the household already has an active unlimited subscription, no-ops.
 * If the household has a beta or other subscription, upgrades it to active unlimited with 100-year validity.
 */
export async function ensureUnlimitedSubscription(
  db: Queryable,
  householdId: string
): Promise<void> {
  if (!householdId || typeof householdId !== 'string') return;

  const existing = await db.query(
    `SELECT s.id FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.household_id = $1 AND p.code = 'unlimited' AND s.status = 'ACTIVE'
     LIMIT 1`,
    [householdId]
  );
  if (existing.rows.length > 0) return;

  const planResult = await db.query<{ id: string }>(
    `INSERT INTO plans (code, name, description, amount_paise, is_active, is_public, checkout_enabled, provider_plan_id)
     VALUES ('unlimited', 'Admin Unlimited Access', 'Uncapped access for internal team and administrators', 0, true, false, false, NULL)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true
     RETURNING id`
  );
  const planId = planResult.rows[0].id;

  const entitlements: Array<[string, string, unknown]> = [
    ['max_children', 'integer', 999],
    ['monthly_ai_sessions', 'integer', 999999999],
    ['monthly_voice_minutes', 'integer', 999999999],
    ['multilingual', 'boolean', true],
    ['advanced_personalisation', 'boolean', true],
    ['parent_reports', 'boolean', true],
    ['long_term_context', 'boolean', true],
    ['premium_themes', 'boolean', true]
  ];

  for (const [key, valueType, value] of entitlements) {
    await db.query(
      `INSERT INTO plan_entitlements (id, plan_id, entitlement_key, value_type, value, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, now(), now())
       ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [planId, key, valueType, JSON.stringify(value)]
    );
  }

  const existingSub = await db.query<{ id: string }>(
    `SELECT id FROM subscriptions WHERE household_id = $1 LIMIT 1`,
    [householdId]
  );

  if (existingSub.rows.length > 0) {
    await db.query(
      `UPDATE subscriptions
       SET plan_id = $1, provider = 'unlimited', status = 'ACTIVE',
           current_period_start = now(), current_period_end = now() + interval '100 years',
           updated_at = now()
       WHERE id = $2`,
      [planId, existingSub.rows[0].id]
    );
  } else {
    await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, provider, status, current_period_start, current_period_end)
       VALUES ($1, $2, 'unlimited', 'ACTIVE', now(), now() + interval '100 years')`,
      [householdId, planId]
    );
  }
}
