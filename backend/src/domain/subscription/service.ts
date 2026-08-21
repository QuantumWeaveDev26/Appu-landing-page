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

const RAZORPAY_EVENT_TO_STATE: Record<string, SubscriptionState> = {
  'subscription.authenticated': SubscriptionStates.AUTHENTICATED,
  'subscription.activated': SubscriptionStates.ACTIVE,
  'subscription.charged': SubscriptionStates.ACTIVE,
  'subscription.pending': SubscriptionStates.PENDING_PAYMENT,
  'subscription.halted': SubscriptionStates.HALTED,
  'subscription.paused': SubscriptionStates.PAUSED,
  'subscription.resumed': SubscriptionStates.ACTIVE,
  'subscription.cancelled': SubscriptionStates.CANCELLED,
  'subscription.completed': SubscriptionStates.EXPIRED
};

export class SubscriptionService {
  /**
   * Creates a pending subscription for a household against a selected plan.
   * Creates the remote Razorpay subscription in TEST MODE.
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

    if (!plan.providerPlanId || plan.providerPlanId.trim().length === 0) {
      throw new BadRequestError(
        `Plan '${input.planCode}' has no configured provider plan ID. Please run plan synchronization.`
      );
    }

    const providerPlanId = plan.providerPlanId.trim();

    // 1. Create remote Razorpay subscription
    const rzpResult = await razorpayClient.createSubscription({
      planId: providerPlanId,
      totalCount: 12,
      customerNotify: true,
      notes: {
        household_id: input.householdId,
        plan_code: plan.code
      }
    });

    // 2. Persist local subscription in PENDING_PAYMENT state
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
      shortUrl: rzpResult.shortUrl
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
    // Find local subscription by provider_subscription_id and verify household ownership
    const subscription = await SubscriptionRepository.getSubscriptionByProviderId(
      db,
      input.subscriptionId
    );

    if (!subscription || subscription.householdId !== input.householdId) {
      throw new NotFoundError('Subscription not found for this household');
    }

    const isValid = razorpayClient.verifyCheckoutSignature({
      paymentId: input.paymentId,
      subscriptionId: subscription.providerSubscriptionId!,
      signature: input.signature
    });

    if (!isValid) {
      throw new BadRequestError('Invalid checkout verification signature');
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

    // 1. Idempotency Check: check if event has already been recorded
    const existingEvent = await SubscriptionRepository.getPaymentEvent(
      db,
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
        db,
        providerSubscriptionId
      );
    }

    // 3. Map event to target subscription state
    const targetState = RAZORPAY_EVENT_TO_STATE[eventType];

    if (localSubscription && targetState) {
      try {
        // Validate state transition rules
        SubscriptionStateMachine.validateTransition(localSubscription.status, targetState);

        const currentPeriodStart = subEntity?.current_start
          ? new Date(subEntity.current_start * 1000)
          : null;
        const currentPeriodEnd = subEntity?.current_end
          ? new Date(subEntity.current_end * 1000)
          : null;

        await SubscriptionRepository.updateSubscription(db, localSubscription.id, {
          status: targetState,
          currentPeriodStart,
          currentPeriodEnd
        });
      } catch (err: any) {
        console.warn(`[SubscriptionService] State transition error during webhook: ${err.message}`);
      }
    }

    // 4. Record event in payment_events for idempotency & audit
    await SubscriptionRepository.recordPaymentEvent(db, {
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
  }

  /**
   * Synchronizes external Razorpay plan IDs for known active plans.
   * Fails safely if required plan IDs are missing.
   * Idempotently updates only known plans.
   */
  public static async syncPlans(
    db: TransactionalQueryable,
    planMappings: {
      starterId?: string;
      growthId?: string;
      familyId?: string;
    }
  ): Promise<{ syncedCount: number; updatedPlans: string[] }> {
    const { starterId, growthId, familyId } = planMappings;

    if (!starterId?.trim() || !growthId?.trim() || !familyId?.trim()) {
      const missing: string[] = [];
      if (!starterId?.trim()) missing.push('RAZORPAY_PLAN_STARTER_ID');
      if (!growthId?.trim()) missing.push('RAZORPAY_PLAN_GROWTH_ID');
      if (!familyId?.trim()) missing.push('RAZORPAY_PLAN_FAMILY_ID');

      throw new Error(
        `Plan synchronization failed: missing required environment configuration for [${missing.join(', ')}]`
      );
    }

    const mapping: Record<string, string> = {
      starter: starterId.trim(),
      growth: growthId.trim(),
      family: familyId.trim()
    };

    const updatedPlans: string[] = [];

    for (const [code, planId] of Object.entries(mapping)) {
      const updated = await SubscriptionRepository.updateProviderPlanId(db, code, planId);
      if (updated) {
        updatedPlans.push(code);
      }
    }

    return {
      syncedCount: updatedPlans.length,
      updatedPlans
    };
  }
}
