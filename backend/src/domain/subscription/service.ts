import type { TransactionalQueryable } from '../../db/types.js';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../errors/index.js';
import type { RazorpayClient } from '../razorpay/types.js';
import { SubscriptionRepository } from './repository.js';
import { SubscriptionStateMachine } from './transitions.js';
import {
  type Subscription,
  type Plan,
  SubscriptionStates,
  type SubscriptionState
} from './types.js';

export interface CreateSubscriptionResult {
  subscription: Subscription;
  plan: Plan;
  providerSubscriptionId: string;
  shortUrl?: string;
  isFree?: boolean;
}

export interface VerifyCheckoutResult {
  subscription: Subscription;
  verified: boolean;
}

export interface WebhookProcessResult {
  status: 'processed' | 'already_processed' | 'ignored';
  eventType?: string;
  providerEventId?: string;
  subscriptionId?: string | null;
}

export interface ReconcileSubscriptionInput {
  providerSubscriptionId: string;
}

export interface ReconcileSubscriptionResult {
  reconciled: boolean;
  actionTaken: 'activated' | 'already_active' | 'updated_period' | 'no_change' | 'provider_not_active';
  providerStatus: string;
  previousStatus: string;
  currentStatus: string;
  subscriptionId: string;
  householdId: string;
  planCode: string;
}

export const RAZORPAY_PROVIDER_STATUS_TO_STATE: Readonly<Record<string, SubscriptionState>> = {
  'created': SubscriptionStates.PENDING_PAYMENT,
  'authenticated': SubscriptionStates.AUTHENTICATED,
  'active': SubscriptionStates.ACTIVE,
  'pending': SubscriptionStates.PENDING_PAYMENT,
  'past_due': SubscriptionStates.PAST_DUE,
  'halted': SubscriptionStates.HALTED,
  'paused': SubscriptionStates.PAUSED,
  'cancelled': SubscriptionStates.CANCELLED,
  'completed': SubscriptionStates.EXPIRED,
  'expired': SubscriptionStates.EXPIRED
};

export const RAZORPAY_EVENT_TO_STATE: Readonly<Record<string, SubscriptionState>> = {
  'subscription.authenticated': SubscriptionStates.AUTHENTICATED,
  'subscription.activated': SubscriptionStates.ACTIVE,
  'subscription.charged': SubscriptionStates.ACTIVE,
  'subscription.pending': SubscriptionStates.PENDING_PAYMENT,
  'subscription.halted': SubscriptionStates.HALTED,
  'subscription.paused': SubscriptionStates.PAUSED,
  'subscription.resumed': SubscriptionStates.ACTIVE,
  'subscription.cancelled': SubscriptionStates.CANCELLED,
  'subscription.completed': SubscriptionStates.EXPIRED,
  'subscription.expired': SubscriptionStates.EXPIRED
};

export class SubscriptionService {
  /**
   * Creates a pending subscription for a household against a selected plan.
   * Creates the remote Razorpay subscription in TEST MODE.
   * Free tier creates an immediate ACTIVE subscription without Razorpay.
   * Signature tier rejects self-service automated checkout.
   */
  public static async createSubscription(
    db: TransactionalQueryable,
    razorpayClient: RazorpayClient,
    input: {
      householdId: string;
      planCode: string;
    }
  ): Promise<CreateSubscriptionResult> {
    const plan = await SubscriptionRepository.getPlanByCode(db, input.planCode);
    if (!plan || !plan.isActive) {
      throw new BadRequestError(`Plan '${input.planCode}' is not active or does not exist`);
    }

    // 1. Signature tier is bespoke / non-self-service
    if (plan.checkoutEnabled === false || plan.code === 'signature') {
      throw new BadRequestError(
        `Plan '${input.planCode}' is a custom solution and cannot be purchased via automated checkout. Please apply for Signature.`
      );
    }

    // 2. Free tier activates immediately with zero payment method / Razorpay call
    if (plan.code === 'free' || plan.amountPaise === 0) {
      const existing = await SubscriptionRepository.getLatestSubscriptionForHousehold(
        db,
        input.householdId
      );

      if (existing && existing.status === SubscriptionStates.ACTIVE) {
        const existingPlan = await SubscriptionRepository.getPlanById(db, existing.planId);
        // If household already has an active paid plan, reject downgrade via ordinary free checkout
        if (existingPlan && (existingPlan.amountPaise > 0 || existingPlan.code !== 'free')) {
          throw new BadRequestError(
            `Household already has an active paid subscription ('${existingPlan.code}'). Downgrading to Free must use explicit cancellation flow.`
          );
        }

        // If household already has active Free subscription, return it idempotently
        return {
          subscription: existing,
          plan,
          providerSubscriptionId: '',
          isFree: true
        };
      }

      const now = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const subscription = await SubscriptionRepository.createSubscription(db, {
        householdId: input.householdId,
        planId: plan.id,
        provider: 'internal',
        providerSubscriptionId: null,
        status: SubscriptionStates.ACTIVE
      });

      await db.query(
        `UPDATE subscriptions
         SET current_period_start = $1, current_period_end = $2
         WHERE id = $3;`,
        [now.toISOString(), end.toISOString(), subscription.id]
      );
      subscription.currentPeriodStart = now;
      subscription.currentPeriodEnd = end;

      return {
        subscription,
        plan,
        providerSubscriptionId: '',
        isFree: true
      };
    }

    // 3. Paid self-service tiers require configured provider_plan_id
    if (!plan.providerPlanId || plan.providerPlanId.trim().length === 0) {
      throw new BadRequestError(
        `Plan '${input.planCode}' has no configured provider plan ID. Please run plan synchronization.`
      );
    }

    // Prevent duplicate checkout creation if household already has an ACTIVE subscription for this exact plan
    const existing = await SubscriptionRepository.getLatestSubscriptionForHousehold(
      db,
      input.householdId
    );

    if (existing && existing.status === SubscriptionStates.ACTIVE && existing.planId === plan.id) {
      return {
        subscription: existing,
        plan,
        providerSubscriptionId: existing.providerSubscriptionId || '',
        shortUrl: undefined,
        isFree: false
      };
    }

    const providerPlanId = plan.providerPlanId.trim();
    const totalCount = plan.billingInterval === 'yearly' ? 10 : 12;

    // Create remote Razorpay subscription
    const rzpResult = await razorpayClient.createSubscription({
      planId: providerPlanId,
      totalCount,
      customerNotify: true,
      notes: {
        household_id: input.householdId,
        plan_code: plan.code
      }
    });

    // Persist local subscription in PENDING_PAYMENT state
    const subscription = await SubscriptionRepository.createSubscription(db, {
      householdId: input.householdId,
      planId: plan.id,
      provider: 'razorpay',
      providerSubscriptionId: rzpResult.id,
      status: SubscriptionStates.PENDING_PAYMENT
    });

    return {
      subscription,
      plan,
      providerSubscriptionId: rzpResult.id,
      shortUrl: rzpResult.shortUrl,
      isFree: false
    };
  }

  /**
   * Verifies standard checkout signature:
   * HMAC_SHA256(payment_id + "|" + subscription_id, key_secret)
   *
   * SECURITY RULE:
   * Successful browser signature verification transitions state from
   * PENDING_PAYMENT -> AUTHENTICATED, but NEVER directly to ACTIVE.
   * Permanent ACTIVE status requires webhook verification or trusted charge event.
   */
  public static async verifyCheckoutSignature(
    db: TransactionalQueryable,
    razorpayClient: RazorpayClient,
    input: {
      householdId: string;
      paymentId: string;
      subscriptionId: string;
      signature: string;
    }
  ): Promise<VerifyCheckoutResult> {
    const providerSubId = input.subscriptionId.trim();
    if (!providerSubId) {
      throw new BadRequestError('subscriptionId is required');
    }

    let subscription = await SubscriptionRepository.getSubscriptionByProviderId(
      db,
      providerSubId
    );

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(providerSubId);
    if (!subscription && isUuid) {
      subscription = await SubscriptionRepository.getSubscriptionById(
        db,
        providerSubId
      );
    }

    if (!subscription || subscription.householdId !== input.householdId) {
      throw new NotFoundError('Subscription not found for this household');
    }

    const signatureSubId = subscription.providerSubscriptionId || providerSubId;

    const isValid = razorpayClient.verifyCheckoutSignature({
      paymentId: input.paymentId.trim(),
      subscriptionId: signatureSubId,
      signature: input.signature.trim()
    });

    if (!isValid) {
      throw new BadRequestError('Invalid checkout verification signature');
    }

    // Idempotent: If already in AUTHENTICATED or ACTIVE state, return verified without transition error
    if (
      subscription.status === SubscriptionStates.AUTHENTICATED ||
      subscription.status === SubscriptionStates.ACTIVE
    ) {
      return {
        subscription,
        verified: true
      };
    }

    // Validate state transition to AUTHENTICATED
    SubscriptionStateMachine.validateTransition(
      subscription.status,
      SubscriptionStates.AUTHENTICATED
    );

    const updated = await SubscriptionRepository.updateSubscription(db, subscription.id, {
      status: SubscriptionStates.AUTHENTICATED
    });

    return {
      subscription: updated!,
      verified: true
    };
  }

  /**
   * Processes a verified Razorpay webhook event with idempotency guarantees.
   */
  public static async processWebhook(
    db: TransactionalQueryable,
    razorpayClient: RazorpayClient,
    input: {
      rawBody: string;
      signature?: string;
      eventIdHeader?: string;
    }
  ): Promise<WebhookProcessResult> {
    if (!input.signature) {
      throw new UnauthorizedError('Missing X-Razorpay-Signature header');
    }

    const isValidSignature = razorpayClient.verifyWebhookSignature({
      rawBody: input.rawBody,
      signature: input.signature
    });

    if (!isValidSignature) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(input.rawBody);
    } catch {
      throw new BadRequestError('Invalid JSON in webhook body');
    }

    const eventType: string = payload.event;
    const providerEventId: string =
      input.eventIdHeader || payload.event_id || `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return await db.transaction(async (tx) => {
      // 1. Idempotency Check: check if event has already been recorded
      const existingEvent = await SubscriptionRepository.getPaymentEvent(
        tx,
        'razorpay',
        providerEventId
      );

      if (existingEvent) {
        return {
          status: 'already_processed',
          eventType,
          providerEventId
        };
      }

      // 2. Resolve subscription from payload entity
      const subEntity = payload.payload?.subscription?.entity;
      const providerSubscriptionId: string | null = subEntity?.id ?? null;
      let localSubscription: Subscription | null = null;

      if (providerSubscriptionId) {
        localSubscription = await SubscriptionRepository.getSubscriptionByProviderId(
          tx,
          providerSubscriptionId
        );
      }

      // 3. Resolve target state:
      // Priority 1: Authoritative Razorpay subscription entity status when present in payload
      let targetState: SubscriptionState | undefined;
      const entityStatus = subEntity?.status ? String(subEntity.status).toLowerCase().trim() : undefined;
      if (entityStatus && RAZORPAY_PROVIDER_STATUS_TO_STATE[entityStatus]) {
        targetState = RAZORPAY_PROVIDER_STATUS_TO_STATE[entityStatus];
      } else if (eventType && RAZORPAY_EVENT_TO_STATE[eventType]) {
        targetState = RAZORPAY_EVENT_TO_STATE[eventType];
      }

      if (localSubscription && targetState) {
        // Invariant 1: If subscription is ALREADY in target state (e.g. ACTIVE -> ACTIVE on subscription.charged or duplicate webhook),
        // handle idempotently as a successful no-op. Update billing periods if provided.
        if (localSubscription.status === targetState) {
          const currentPeriodStart = subEntity?.current_start
            ? new Date(subEntity.current_start * 1000)
            : null;
          const currentPeriodEnd = subEntity?.current_end
            ? new Date(subEntity.current_end * 1000)
            : null;

          if (currentPeriodStart || currentPeriodEnd) {
            await SubscriptionRepository.updateSubscription(tx, localSubscription.id, {
              status: targetState,
              currentPeriodStart: currentPeriodStart || localSubscription.currentPeriodStart,
              currentPeriodEnd: currentPeriodEnd || localSubscription.currentPeriodEnd
            });
          }
        } else if (!SubscriptionStateMachine.canTransition(localSubscription.status, targetState)) {
          // Invariant 2: Disallowed transitions by state machine (e.g. out-of-order webhook, downgrade attempt, or terminal state)
          // - Never downgrade ACTIVE -> AUTHENTICATED on delayed subscription.authenticated
          // - Never resurrect CANCELLED / EXPIRED -> ACTIVE on delayed subscription.activated
          // Keep current state, record the payment event, and acknowledge idempotently without error.
        } else {
          // Normal valid cross-state transition
          SubscriptionStateMachine.validateTransition(localSubscription.status, targetState);

          const currentPeriodStart = subEntity?.current_start
            ? new Date(subEntity.current_start * 1000)
            : null;
          const currentPeriodEnd = subEntity?.current_end
            ? new Date(subEntity.current_end * 1000)
            : null;

          await SubscriptionRepository.updateSubscription(tx, localSubscription.id, {
            status: targetState,
            currentPeriodStart,
            currentPeriodEnd
          });

          // Expire older active subscriptions for the household only when transitioning to ACTIVE
          if (targetState === SubscriptionStates.ACTIVE && localSubscription.householdId) {
            await tx.query(
              `UPDATE subscriptions
               SET status = 'EXPIRED', updated_at = NOW()
               WHERE household_id = $1 AND id != $2 AND status = 'ACTIVE';`,
              [localSubscription.householdId, localSubscription.id]
            );
          }
        }
      }

      // 4. Record event in payment_events for idempotency & audit atomically
      await SubscriptionRepository.recordPaymentEvent(tx, {
        provider: 'razorpay',
        providerEventId,
        eventType,
        subscriptionId: localSubscription?.id ?? null,
        providerSubscriptionId,
        status: 'PROCESSED',
        payloadSummary: {
          event: eventType,
          subscription_id: providerSubscriptionId,
          status: subEntity?.status
        }
      });

      return {
        status: 'processed',
        eventType,
        providerEventId,
        subscriptionId: localSubscription?.id ?? null
      };
    });
  }

  /**
   * Safe operator-side reconciliation for a paid subscription against authoritative Razorpay state.
   * NEVER promotes a subscription unless Razorpay authoritative status is 'active'.
   */
  public static async reconcileSubscription(
    db: TransactionalQueryable,
    razorpayClient: RazorpayClient,
    input: ReconcileSubscriptionInput
  ): Promise<ReconcileSubscriptionResult> {
    if (!input.providerSubscriptionId || !input.providerSubscriptionId.trim()) {
      throw new BadRequestError('providerSubscriptionId is required');
    }

    const providerSubId = input.providerSubscriptionId.trim();

    return await db.transaction(async (tx) => {
      // 1. Load local subscription by provider_subscription_id
      const localSubscription = await SubscriptionRepository.getSubscriptionByProviderId(
        tx,
        providerSubId
      );

      if (!localSubscription) {
        throw new NotFoundError(`No local subscription found with provider ID '${providerSubId}'`);
      }

      let planCode = localSubscription.planCode;
      if (!planCode) {
        const plan = await SubscriptionRepository.getPlanById(tx, localSubscription.planId);
        planCode = plan?.code || 'unknown';
      }

      // 2. Fetch authoritative status directly from Razorpay (server-to-server)
      const rzpSub = await razorpayClient.getSubscription(providerSubId);
      const providerStatus = (rzpSub.status || '').toLowerCase();

      // 3. Reconcile based on authoritative Razorpay status
      if (providerStatus === 'active') {
        const currentPeriodStart = rzpSub.currentStart
          ? new Date(rzpSub.currentStart * 1000)
          : localSubscription.currentPeriodStart || new Date();
        const currentPeriodEnd = rzpSub.currentEnd
          ? new Date(rzpSub.currentEnd * 1000)
          : localSubscription.currentPeriodEnd || new Date(Date.now() + 30 * 86400 * 1000);

        if (localSubscription.status === SubscriptionStates.ACTIVE) {
          // Already active - update period if dates differ
          await SubscriptionRepository.updateSubscription(tx, localSubscription.id, {
            status: SubscriptionStates.ACTIVE,
            currentPeriodStart,
            currentPeriodEnd
          });

          return {
            reconciled: true,
            actionTaken: 'already_active',
            providerStatus,
            previousStatus: localSubscription.status,
            currentStatus: SubscriptionStates.ACTIVE,
            subscriptionId: localSubscription.id,
            householdId: localSubscription.householdId,
            planCode
          };
        }

        // Local state is AUTHENTICATED or PENDING_PAYMENT -> promote to ACTIVE
        SubscriptionStateMachine.validateTransition(
          localSubscription.status,
          SubscriptionStates.ACTIVE
        );

        await SubscriptionRepository.updateSubscription(tx, localSubscription.id, {
          status: SubscriptionStates.ACTIVE,
          currentPeriodStart,
          currentPeriodEnd
        });

        // Expire any other ACTIVE subscription for that household
        if (localSubscription.householdId) {
          await tx.query(
            `UPDATE subscriptions
             SET status = 'EXPIRED', updated_at = NOW()
             WHERE household_id = $1 AND id != $2 AND status = 'ACTIVE';`,
            [localSubscription.householdId, localSubscription.id]
          );
        }

        return {
          reconciled: true,
          actionTaken: 'activated',
          providerStatus,
          previousStatus: localSubscription.status,
          currentStatus: SubscriptionStates.ACTIVE,
          subscriptionId: localSubscription.id,
          householdId: localSubscription.householdId,
          planCode
        };
      }

      // Provider is NOT active (e.g. 'created', 'authenticated', 'cancelled', 'expired')
      // Invariant: Do NOT promote to ACTIVE
      return {
        reconciled: false,
        actionTaken: 'provider_not_active',
        providerStatus,
        previousStatus: localSubscription.status,
        currentStatus: localSubscription.status,
        subscriptionId: localSubscription.id,
        householdId: localSubscription.householdId,
        planCode
      };
    });
  }

  /**
   * Parses arbitrary provider plan mappings from JSON strings, key-value strings, or objects.
   * Merges legacy env vars (RAZORPAY_PLAN_STARTER_ID, etc.) for backward compatibility.
   */
  public static parsePlanMappings(
    input?: string | Record<string, string | undefined> | null,
    legacyFallbacks?: {
      starterId?: string;
      growthId?: string;
      familyId?: string;
      [key: string]: string | undefined;
    }
  ): Record<string, string> {
    const result: Record<string, string> = {};

    // 1. Process primary input
    if (typeof input === 'string' && input.trim().length > 0) {
      const trimmed = input.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof k === 'string' && typeof v === 'string' && v.trim()) {
                result[k.trim().toLowerCase()] = v.trim();
              }
            }
          }
        } catch {
          // Fall through to delimiter parsing
        }
      }

      if (Object.keys(result).length === 0) {
        // Parse format "starter:plan_123,growth:plan_456"
        const pairs = trimmed.split(',');
        for (const pair of pairs) {
          const [k, v] = pair.split(':');
          if (k && v && k.trim() && v.trim()) {
            result[k.trim().toLowerCase()] = v.trim();
          }
        }
      }
    } else if (input && typeof input === 'object') {
      for (const [k, v] of Object.entries(input)) {
        if (typeof k === 'string' && typeof v === 'string' && v.trim()) {
          result[k.trim().toLowerCase()] = v.trim();
        }
      }
    }

    // 2. Merge legacy fallbacks if provided and not already present
    if (legacyFallbacks) {
      if (legacyFallbacks.starterId?.trim() && !result['starter']) {
        result['starter'] = legacyFallbacks.starterId.trim();
      }
      if (legacyFallbacks.growthId?.trim() && !result['growth']) {
        result['growth'] = legacyFallbacks.growthId.trim();
      }
      if (legacyFallbacks.familyId?.trim() && !result['family']) {
        result['family'] = legacyFallbacks.familyId.trim();
      }
      for (const [k, v] of Object.entries(legacyFallbacks)) {
        if (k !== 'starterId' && k !== 'growthId' && k !== 'familyId' && typeof v === 'string' && v.trim() && !result[k.toLowerCase()]) {
          result[k.toLowerCase()] = v.trim();
        }
      }
    }

    return result;
  }

  /**
   * Synchronizes external Razorpay plan IDs for all active plans in the database.
   * Dynamically inspects whatever active plans exist in the database.
   * Fails safely if any active plan lacks a corresponding provider mapping.
   * Idempotently updates provider_plan_id in the plans table.
   */
  public static async syncPlans(
    db: TransactionalQueryable,
    planMappings:
      | string
      | Record<string, string | undefined>
      | {
          starterId?: string;
          growthId?: string;
          familyId?: string;
          [key: string]: string | undefined;
        }
  ): Promise<{ syncedCount: number; updatedPlans: string[]; unmappedPlans: string[] }> {
    const activePlans = await SubscriptionRepository.listActivePlans(db);
    if (activePlans.length === 0) {
      return { syncedCount: 0, updatedPlans: [], unmappedPlans: [] };
    }

    const mapping = typeof planMappings === 'object' && !('starterId' in planMappings || 'growthId' in planMappings || 'familyId' in planMappings)
      ? this.parsePlanMappings(planMappings as Record<string, string>)
      : this.parsePlanMappings(
          typeof planMappings === 'string' ? planMappings : undefined,
          typeof planMappings === 'object' ? (planMappings as any) : undefined
        );

    const updatedPlans: string[] = [];
    const missing: string[] = [];

    for (const plan of activePlans) {
      // Free and custom non-checkout plans (like Signature) do not have or require a provider plan ID
      if (plan.amountPaise === 0 || plan.code === 'free' || plan.checkoutEnabled === false) {
        continue;
      }

      const planCode = plan.code.toLowerCase();
      const providerPlanId = mapping[planCode];

      if (!providerPlanId || !providerPlanId.trim()) {
        missing.push(plan.code);
      } else {
        const updated = await SubscriptionRepository.updateProviderPlanId(
          db,
          plan.code,
          providerPlanId.trim()
        );
        if (updated) {
          updatedPlans.push(plan.code);
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Plan synchronization failed: missing provider plan ID for active plan(s) [${missing.join(', ')}]. Please configure provider plan mapping in RAZORPAY_PLAN_MAPPINGS.`
      );
    }

    return {
      syncedCount: updatedPlans.length,
      updatedPlans,
      unmappedPlans: []
    };
  }
}
