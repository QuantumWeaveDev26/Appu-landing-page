import type { Queryable } from '../../db/types.js';

/**
 * BETA ONLY: lazily provisions a free, non-Razorpay "beta" plan/subscription for a household
 * so the normal subscription/entitlement/quota/FK machinery works unchanged. Reversible by
 * turning APPU_BETA_MODE off (this function then simply stops being called) -- existing beta
 * subscription rows are left in place for a manual migration to a real plan later.
 *
 * No-ops if the household already has a beta subscription row (checked first, not upserted
 * per-request, so this only writes once per household).
 */
export async function ensureBetaSubscription(
  db: Queryable,
  householdId: string,
  betaChatLimit: number
): Promise<void> {
  const existing = await db.query(
    `SELECT s.id FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.household_id = $1 AND p.code = 'beta'
     LIMIT 1`,
    [householdId]
  );
  if (existing.rows.length > 0) return;

  const planResult = await db.query<{ id: string }>(
    `INSERT INTO plans (code, name, description, amount_paise, is_active, is_public, checkout_enabled, provider_plan_id)
     VALUES ('beta', 'Beta Access', 'Free public beta testing access', 0, true, false, false, NULL)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  const planId = planResult.rows[0].id;

  const entitlements: Array<[string, string, unknown]> = [
    ['max_children', 'integer', 3],
    ['monthly_ai_sessions', 'integer', betaChatLimit],
    ['monthly_voice_minutes', 'integer', 60],
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

  await db.query(
    `INSERT INTO subscriptions (household_id, plan_id, provider, status, current_period_start, current_period_end)
     VALUES ($1, $2, 'beta', 'ACTIVE', now(), now() + interval '90 days')`,
    [householdId, planId]
  );
}
