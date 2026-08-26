import type { Queryable } from '../../db/types.js';
import { validateEntitlementValue } from '../entitlements/index.js';
import type { EntitlementsMap } from '../entitlements/types.js';
import {
  type Plan,
  type Subscription,
  type PaymentEvent,
  type CreateSubscriptionInput,
  type SubscriptionState,
  SubscriptionStates
} from './types.js';

interface PlanRow {
  id: string;
  code: string;
  tier_code?: string | null;
  tier_name?: string | null;
  name: string;
  description: string | null;
  currency: string;
  amount_paise: number;
  billing_interval: string;
  annual_savings_paise?: number | null;
  monthly_equivalent_paise?: number | null;
  is_active: boolean;
  is_public?: boolean | null;
  is_primary_card?: boolean | null;
  is_recommended?: boolean | null;
  checkout_enabled?: boolean | null;
  display_order?: number | null;
  cta_text?: string | null;
  cta_action?: string | null;
  provider_plan_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PlanEntitlementRow {
  plan_id: string;
  entitlement_key: string;
  value_type: string;
  value: unknown;
}

interface SubscriptionRow {
  id: string;
  household_id: string;
  plan_id: string;
  plan_code?: string;
  provider: string;
  provider_subscription_id: string | null;
  status: SubscriptionState;
  current_period_start: Date | string | null;
  current_period_end: Date | string | null;
  cancel_at_period_end: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PaymentEventRow {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  subscription_id: string | null;
  provider_subscription_id: string | null;
  status: string;
  payload_summary: unknown;
  processed_at: Date | string;
  created_at: Date | string;
}

function mapPlanRow(row: PlanRow, entitlements: EntitlementsMap = {}): Plan {
  return {
    id: row.id,
    code: row.code,
    tierCode: row.tier_code || row.code,
    tierName: row.tier_name || row.name,
    name: row.name,
    description: row.description,
    currency: row.currency,
    amountPaise: Number(row.amount_paise),
    billingInterval: row.billing_interval,
    annualSavingsPaise: row.annual_savings_paise !== undefined && row.annual_savings_paise !== null ? Number(row.annual_savings_paise) : 0,
    monthlyEquivalentPaise: row.monthly_equivalent_paise !== undefined && row.monthly_equivalent_paise !== null ? Number(row.monthly_equivalent_paise) : Number(row.amount_paise),
    isActive: Boolean(row.is_active),
    isPublic: row.is_public !== undefined && row.is_public !== null ? Boolean(row.is_public) : true,
    isPrimaryCard: row.is_primary_card !== undefined && row.is_primary_card !== null ? Boolean(row.is_primary_card) : true,
    isRecommended: Boolean(row.is_recommended),
    checkoutEnabled: row.checkout_enabled !== undefined && row.checkout_enabled !== null ? Boolean(row.checkout_enabled) : true,
    displayOrder: row.display_order !== undefined && row.display_order !== null ? Number(row.display_order) : 0,
    ctaText: row.cta_text || null,
    ctaAction: row.cta_action || 'checkout',
    providerPlanId: row.provider_plan_id,
    entitlements,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapSubscriptionRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    householdId: row.household_id,
    planId: row.plan_id,
    planCode: row.plan_code,
    provider: row.provider,
    providerSubscriptionId: row.provider_subscription_id,
    status: row.status,
    currentPeriodStart: row.current_period_start ? new Date(row.current_period_start) : null,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapPaymentEventRow(row: PaymentEventRow): PaymentEvent {
  return {
    id: row.id,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    eventType: row.event_type,
    subscriptionId: row.subscription_id,
    providerSubscriptionId: row.provider_subscription_id,
    status: row.status,
    payloadSummary: (row.payload_summary as Record<string, unknown>) ?? null,
    processedAt: new Date(row.processed_at),
    createdAt: new Date(row.created_at)
  };
}

export class SubscriptionRepository {
  /**
   * Lists all active plans along with their validated entitlements.
   */
  public static async listActivePlans(db: Queryable): Promise<Plan[]> {
    const plansResult = await db.query<PlanRow>(
      `SELECT id, code, tier_code, tier_name, name, description, currency, amount_paise, billing_interval,
              annual_savings_paise, monthly_equivalent_paise, is_active, is_public, is_primary_card,
              is_recommended, checkout_enabled, display_order, cta_text, cta_action, provider_plan_id,
              created_at, updated_at
       FROM plans
       WHERE is_active = TRUE
       ORDER BY display_order ASC, amount_paise ASC;`
    );

    if (plansResult.rows.length === 0) {
      return [];
    }

    const entitlementsResult = await db.query<PlanEntitlementRow>(
      `SELECT plan_id, entitlement_key, value_type, value
       FROM plan_entitlements;`
    );

    const entitlementsByPlanId = new Map<string, EntitlementsMap>();
    for (const row of entitlementsResult.rows) {
      if (!entitlementsByPlanId.has(row.plan_id)) {
        entitlementsByPlanId.set(row.plan_id, {});
      }
      try {
        const validatedVal = validateEntitlementValue(row.entitlement_key, row.value);
        entitlementsByPlanId.get(row.plan_id)![row.entitlement_key] = validatedVal;
      } catch {
        // Safe skip of malformed entitlement records
      }
    }

    return plansResult.rows.map((row) =>
      mapPlanRow(row, entitlementsByPlanId.get(row.id) ?? {})
    );
  }

  /**
   * Retrieves an active plan by its unique code (e.g. 'evolve_monthly').
   */
  public static async getPlanByCode(db: Queryable, code: string): Promise<Plan | null> {
    const result = await db.query<PlanRow>(
      `SELECT id, code, tier_code, tier_name, name, description, currency, amount_paise, billing_interval,
              annual_savings_paise, monthly_equivalent_paise, is_active, is_public, is_primary_card,
              is_recommended, checkout_enabled, display_order, cta_text, cta_action, provider_plan_id,
              created_at, updated_at
       FROM plans
       WHERE code = $1 AND is_active = TRUE;`,
      [code.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const planRow = result.rows[0];
    const entitlementsResult = await db.query<PlanEntitlementRow>(
      `SELECT plan_id, entitlement_key, value_type, value
       FROM plan_entitlements
       WHERE plan_id = $1;`,
      [planRow.id]
    );

    const entitlements: EntitlementsMap = {};
    for (const row of entitlementsResult.rows) {
      try {
        entitlements[row.entitlement_key] = validateEntitlementValue(row.entitlement_key, row.value);
      } catch {
        // Ignore invalid entries
      }
    }

    return mapPlanRow(planRow, entitlements);
  }

  /**
   * Retrieves a plan by its UUID.
   */
  public static async getPlanById(db: Queryable, planId: string): Promise<Plan | null> {
    const result = await db.query<PlanRow>(
      `SELECT id, code, tier_code, tier_name, name, description, currency, amount_paise, billing_interval,
              annual_savings_paise, monthly_equivalent_paise, is_active, is_public, is_primary_card,
              is_recommended, checkout_enabled, display_order, cta_text, cta_action, provider_plan_id,
              created_at, updated_at
       FROM plans
       WHERE id = $1;`,
      [planId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const planRow = result.rows[0];
    const entitlementsResult = await db.query<PlanEntitlementRow>(
      `SELECT plan_id, entitlement_key, value_type, value
       FROM plan_entitlements
       WHERE plan_id = $1;`,
      [planRow.id]
    );

    const entitlements: EntitlementsMap = {};
    for (const row of entitlementsResult.rows) {
      try {
        entitlements[row.entitlement_key] = validateEntitlementValue(row.entitlement_key, row.value);
      } catch {
        // Ignore
      }
    }

    return mapPlanRow(planRow, entitlements);
  }

  /**
   * Updates the external provider plan ID (e.g. Razorpay plan ID) for an active plan.
   */
  public static async updateProviderPlanId(
    db: Queryable,
    code: string,
    providerPlanId: string
  ): Promise<Plan | null> {
    const result = await db.query<PlanRow>(
      `UPDATE plans
       SET provider_plan_id = $1,
           updated_at = NOW()
       WHERE code = $2 AND is_active = TRUE
       RETURNING id, code, name, description, currency, amount_paise, billing_interval, is_active, provider_plan_id, created_at, updated_at;`,
      [providerPlanId.trim(), code.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapPlanRow(result.rows[0]);
  }

  /**
   * Creates a new subscription record.
   */
  public static async createSubscription(
    db: Queryable,
    input: CreateSubscriptionInput
  ): Promise<Subscription> {
    const status = input.status ?? SubscriptionStates.DRAFT;
    const provider = input.provider ?? 'razorpay';

    const result = await db.query<SubscriptionRow>(
      `INSERT INTO subscriptions (
        household_id, plan_id, provider, provider_subscription_id, status,
        current_period_start, current_period_end, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, household_id, plan_id, provider, provider_subscription_id, status,
                 current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at;`,
      [
        input.householdId,
        input.planId,
        provider,
        input.providerSubscriptionId ?? null,
        status,
        input.currentPeriodStart ?? null,
        input.currentPeriodEnd ?? null
      ]
    );

    return mapSubscriptionRow(result.rows[0]);
  }

  /**
   * Retrieves the active/latest subscription for a given household.
   */
  public static async getLatestSubscriptionForHousehold(
    db: Queryable,
    householdId: string
  ): Promise<Subscription | null> {
    const result = await db.query<SubscriptionRow>(
      `SELECT s.id, s.household_id, s.plan_id, p.code AS plan_code, s.provider, s.provider_subscription_id,
              s.status, s.current_period_start, s.current_period_end, s.cancel_at_period_end,
              s.created_at, s.updated_at
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.household_id = $1
       ORDER BY (CASE
                   WHEN s.status = 'ACTIVE' THEN 1
                   WHEN s.status = 'PAST_DUE' THEN 2
                   WHEN s.status = 'PAUSED' THEN 3
                   WHEN s.status = 'AUTHENTICATED' THEN 4
                   WHEN s.status = 'PENDING_PAYMENT' THEN 5
                   ELSE 6
                 END) ASC,
                s.created_at DESC
       LIMIT 1;`,
      [householdId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapSubscriptionRow(result.rows[0]);
  }

  /**
   * Retrieves a subscription by its primary UUID.
   */
  public static async getSubscriptionById(
    db: Queryable,
    subscriptionId: string
  ): Promise<Subscription | null> {
    const result = await db.query<SubscriptionRow>(
      `SELECT s.id, s.household_id, s.plan_id, p.code AS plan_code, s.provider, s.provider_subscription_id,
              s.status, s.current_period_start, s.current_period_end, s.cancel_at_period_end,
              s.created_at, s.updated_at
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = $1;`,
      [subscriptionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapSubscriptionRow(result.rows[0]);
  }

  /**
   * Retrieves a subscription by its Razorpay provider subscription ID (e.g. 'sub_xyz').
   */
  public static async getSubscriptionByProviderId(
    db: Queryable,
    providerSubscriptionId: string
  ): Promise<Subscription | null> {
    const result = await db.query<SubscriptionRow>(
      `SELECT s.id, s.household_id, s.plan_id, p.code AS plan_code, s.provider, s.provider_subscription_id,
              s.status, s.current_period_start, s.current_period_end, s.cancel_at_period_end,
              s.created_at, s.updated_at
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.provider_subscription_id = $1;`,
      [providerSubscriptionId.trim()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapSubscriptionRow(result.rows[0]);
  }

  /**
   * Updates subscription status and period timestamps.
   */
  public static async updateSubscription(
    db: Queryable,
    subscriptionId: string,
    updates: {
      status?: SubscriptionState;
      providerSubscriptionId?: string;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      cancelAtPeriodEnd?: boolean;
    }
  ): Promise<Subscription | null> {
    const fields: string[] = [];
    const values: any[] = [subscriptionId];
    let idx = 2;

    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }

    if (updates.providerSubscriptionId !== undefined) {
      fields.push(`provider_subscription_id = $${idx++}`);
      values.push(updates.providerSubscriptionId);
    }

    if (updates.currentPeriodStart !== undefined) {
      fields.push(`current_period_start = $${idx++}`);
      values.push(updates.currentPeriodStart);
    }

    if (updates.currentPeriodEnd !== undefined) {
      fields.push(`current_period_end = $${idx++}`);
      values.push(updates.currentPeriodEnd);
    }

    if (updates.cancelAtPeriodEnd !== undefined) {
      fields.push(`cancel_at_period_end = $${idx++}`);
      values.push(updates.cancelAtPeriodEnd);
    }

    if (fields.length === 0) {
      return this.getSubscriptionById(db, subscriptionId);
    }

    fields.push('updated_at = NOW()');

    const result = await db.query<SubscriptionRow>(
      `UPDATE subscriptions
       SET ${fields.join(', ')}
       WHERE id = $1
       RETURNING id, household_id, plan_id, provider, provider_subscription_id, status,
                 current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at;`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapSubscriptionRow(result.rows[0]);
  }

  /**
   * Records a payment/webhook event for idempotency and audit tracking.
   */
  public static async recordPaymentEvent(
    db: Queryable,
    input: {
      provider?: string;
      providerEventId: string;
      eventType: string;
      subscriptionId?: string | null;
      providerSubscriptionId?: string | null;
      status?: string;
      payloadSummary?: Record<string, unknown> | null;
    }
  ): Promise<PaymentEvent> {
    const provider = input.provider ?? 'razorpay';
    const status = input.status ?? 'PROCESSED';

    const result = await db.query<PaymentEventRow>(
      `INSERT INTO payment_events (
        provider, provider_event_id, event_type, subscription_id,
        provider_subscription_id, status, payload_summary, processed_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, provider, provider_event_id, event_type, subscription_id,
                 provider_subscription_id, status, payload_summary, processed_at, created_at;`,
      [
        provider,
        input.providerEventId.trim(),
        input.eventType.trim(),
        input.subscriptionId ?? null,
        input.providerSubscriptionId ?? null,
        status,
        input.payloadSummary ? JSON.stringify(input.payloadSummary) : null
      ]
    );

    return mapPaymentEventRow(result.rows[0]);
  }

  /**
   * Checks if a payment event has already been recorded (for webhook idempotency).
   */
  public static async getPaymentEvent(
    db: Queryable,
    provider: string,
    providerEventId: string
  ): Promise<PaymentEvent | null> {
    const result = await db.query<PaymentEventRow>(
      `SELECT id, provider, provider_event_id, event_type, subscription_id,
              provider_subscription_id, status, payload_summary, processed_at, created_at
       FROM payment_events
       WHERE provider = $1 AND provider_event_id = $2;`,
      [provider, providerEventId.trim()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapPaymentEventRow(result.rows[0]);
  }
}
