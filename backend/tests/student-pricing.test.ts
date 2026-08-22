import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { SubscriptionRepository } from '../src/domain/subscription/repository.js';
import { SubscriptionService } from '../src/domain/subscription/service.js';
import { EntitlementEnforcementService } from '../src/domain/entitlements/enforcement-service.js';
import { MockRazorpayClient } from '../src/domain/razorpay/mock-client.js';
import { MockAuthVerifier } from '../src/domain/auth/mock-verifier.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { UsageRepository } from '../src/domain/usage/repository.js';
import { BadRequestError, QuotaExceededError } from '../src/errors/index.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';

function createTestDatabase(): TransactionalQueryable {
  const memDb = newDb();

  memDb.public.registerFunction({
    name: 'gen_random_uuid',
    returns: memDb.public.getType('uuid'),
    impure: true,
    implementation: () => crypto.randomUUID()
  });

  memDb.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [memDb.public.getType('int')],
    returns: memDb.public.getType('bool'),
    impure: true,
    implementation: () => true
  });

  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  const db: TransactionalQueryable = {
    async query<T = any>(sql: string, params: any[] = []) {
      const res = await pool.query<T>(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount
      };
    },

    async transaction<T>(work: (client: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const transactionDb: Queryable = {
        async query<TResult = any>(queryText: string, values: any[] = []) {
          const result = await client.query<TResult>(queryText, values);
          return {
            rows: result.rows as TResult[],
            rowCount: result.rowCount
          };
        }
      };

      try {
        await client.query('BEGIN');
        const result = await work(transactionDb);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async isHealthy(): Promise<boolean> {
      return true;
    },

    async close(): Promise<void> {
      await pool.end();
    }
  };

  return db;
}

describe('HR-Approved APPU AI Student Pricing & Tier Architecture', () => {
  let db: TransactionalQueryable;
  let mockRazorpay: MockRazorpayClient;

  before(async () => {
    db = createTestDatabase();
    mockRazorpay = new MockRazorpayClient();
    await runMigrations(db);
  });

  it('verifies all approved student plans exist and legacy plans are deactivated', async () => {
    const activePlans = await SubscriptionRepository.listActivePlans(db);
    const codes = activePlans.map((p) => p.code);

    // Active student catalogue
    assert.ok(codes.includes('free'), 'Free plan must be active');
    assert.ok(codes.includes('evolve_monthly'), 'Evolve monthly must be active');
    assert.ok(codes.includes('evolve_annual'), 'Evolve annual must be active');
    assert.ok(codes.includes('evolve_plus_monthly'), 'Evolve+ monthly must be active');
    assert.ok(codes.includes('evolve_plus_annual'), 'Evolve+ annual must be active');
    assert.ok(codes.includes('genesis_monthly'), 'Genesis monthly must be active');
    assert.ok(codes.includes('genesis_annual'), 'Genesis annual must be active');
    assert.ok(codes.includes('signature'), 'Signature bespoke plan must be active');

    // Deactivated legacy test fixture plans
    assert.ok(!codes.includes('starter'), 'Legacy starter plan must be deactivated');
    assert.ok(!codes.includes('growth'), 'Legacy growth plan must be deactivated');
    assert.ok(!codes.includes('family'), 'Legacy family plan must be deactivated');
  });

  it('verifies exact product tier metadata and pricing invariants', async () => {
    const free = await SubscriptionRepository.getPlanByCode(db, 'free');
    assert.ok(free);
    assert.equal(free.tierCode, 'free');
    assert.equal(free.amountPaise, 0);
    assert.equal(free.checkoutEnabled, true);
    assert.equal(free.isPrimaryCard, true);
    assert.equal(free.entitlements?.max_children, 1);
    assert.equal(free.entitlements?.monthly_ai_sessions, 20);
    assert.equal(free.entitlements?.monthly_voice_minutes, 5);

    const evolveMo = await SubscriptionRepository.getPlanByCode(db, 'evolve_monthly');
    assert.ok(evolveMo);
    assert.equal(evolveMo.tierCode, 'evolve');
    assert.equal(evolveMo.amountPaise, 49900);
    assert.equal(evolveMo.billingInterval, 'monthly');
    assert.equal(evolveMo.entitlements?.max_children, 1);
    assert.equal(evolveMo.entitlements?.monthly_ai_sessions, 150);
    assert.equal(evolveMo.entitlements?.monthly_voice_minutes, 45);

    const evolveYr = await SubscriptionRepository.getPlanByCode(db, 'evolve_annual');
    assert.ok(evolveYr);
    assert.equal(evolveYr.tierCode, 'evolve');
    assert.equal(evolveYr.amountPaise, 499900);
    assert.equal(evolveYr.billingInterval, 'yearly');
    assert.equal(evolveYr.annualSavingsPaise, 98900);
    assert.equal(evolveYr.monthlyEquivalentPaise, 41700);
    assert.equal(evolveYr.entitlements?.max_children, 1);
    assert.equal(evolveYr.entitlements?.monthly_ai_sessions, 150);
    assert.equal(evolveYr.entitlements?.monthly_voice_minutes, 45);

    const evolvePlusYr = await SubscriptionRepository.getPlanByCode(db, 'evolve_plus_annual');
    assert.ok(evolvePlusYr);
    assert.equal(evolvePlusYr.tierCode, 'evolve_plus');
    assert.equal(evolvePlusYr.amountPaise, 999900);
    assert.equal(evolvePlusYr.isRecommended, true);
    assert.equal(evolvePlusYr.annualSavingsPaise, 198900);
    assert.equal(evolvePlusYr.monthlyEquivalentPaise, 83300);
    assert.equal(evolvePlusYr.entitlements?.monthly_ai_sessions, 400);
    assert.equal(evolvePlusYr.entitlements?.monthly_voice_minutes, 120);

    const genesisYr = await SubscriptionRepository.getPlanByCode(db, 'genesis_annual');
    assert.ok(genesisYr);
    assert.equal(genesisYr.tierCode, 'genesis');
    assert.equal(genesisYr.isPrimaryCard, false, 'Genesis is contextual upsell, not primary card');
    assert.equal(genesisYr.amountPaise, 2499900);
    assert.equal(genesisYr.annualSavingsPaise, 498900);
    assert.equal(genesisYr.monthlyEquivalentPaise, 208300);
    assert.equal(genesisYr.entitlements?.monthly_ai_sessions, 1000);
    assert.equal(genesisYr.entitlements?.monthly_voice_minutes, 300);

    const sig = await SubscriptionRepository.getPlanByCode(db, 'signature');
    assert.ok(sig);
    assert.equal(sig.tierCode, 'signature');
    assert.equal(sig.checkoutEnabled, false, 'Signature standard checkout must be disabled');
    assert.equal(sig.isPrimaryCard, true, 'Signature is a primary marketing card');
  });

  it('FREE PLAN: creates instant ACTIVE subscription without calling Razorpay', async () => {
    const parentId = crypto.randomUUID();
    const onboard = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentId,
      householdName: 'Free Tier Household'
    });

    const result = await SubscriptionService.createSubscription(db, mockRazorpay, {
      householdId: onboard.household.id,
      planCode: 'free'
    });

    assert.equal(result.isFree, true);
    assert.equal(result.subscription.status, 'ACTIVE');
    assert.equal(result.subscription.provider, 'internal');
    assert.equal(result.subscription.providerSubscriptionId, null);

    // Verify entitlements resolved for household
    const entitlements = await EntitlementEnforcementService.getHouseholdEntitlements(
      db,
      onboard.household.id
    );
    assert.equal(entitlements.hasActiveSubscription, true);
    assert.equal(entitlements.planCode, 'free');
    assert.equal(entitlements.entitlements?.max_children, 1);
    assert.equal(entitlements.entitlements?.monthly_ai_sessions, 20);
    assert.equal(entitlements.entitlements?.monthly_voice_minutes, 5);
  });

  it('SIGNATURE PLAN: rejects automated self-service checkout creation', async () => {
    const parentId = crypto.randomUUID();
    const onboard = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentId,
      householdName: 'Signature Inquirer'
    });

    await assert.rejects(
      async () => {
        await SubscriptionService.createSubscription(db, mockRazorpay, {
          householdId: onboard.household.id,
          planCode: 'signature'
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /custom solution/i);
        return true;
      }
    );
  });

  it('ANNUAL BILLING: UsageRepository partitions annual period into calendar-month anniversary cycles', async () => {
    // Subscription anchored on 2026-08-22T10:00:00.000Z
    const pStart = new Date('2026-08-22T10:00:00.000Z');
    const pEnd = new Date('2027-08-22T10:00:00.000Z');

    const sub = {
      currentPeriodStart: pStart,
      currentPeriodEnd: pEnd,
      createdAt: pStart
    };

    // Cycle 1: 2026-08-22 -> 2026-09-22
    const period1 = UsageRepository.resolveUsagePeriod(sub, new Date('2026-08-25T12:00:00.000Z'));
    assert.equal(period1.source, 'provider');
    assert.equal(period1.startsAt.toISOString(), '2026-08-22T10:00:00.000Z');
    assert.equal(period1.endsAt.toISOString(), '2026-09-22T10:00:00.000Z');

    // Cycle 2: 2026-09-22 -> 2026-10-22 (30-day month)
    const period2 = UsageRepository.resolveUsagePeriod(sub, new Date('2026-09-25T12:00:00.000Z'));
    assert.equal(period2.startsAt.toISOString(), '2026-09-22T10:00:00.000Z');
    assert.equal(period2.endsAt.toISOString(), '2026-10-22T10:00:00.000Z');

    // Cycle 3: 2026-10-22 -> 2026-11-22 (31-day month)
    const period3 = UsageRepository.resolveUsagePeriod(sub, new Date('2026-10-25T12:00:00.000Z'));
    assert.equal(period3.startsAt.toISOString(), '2026-10-22T10:00:00.000Z');
    assert.equal(period3.endsAt.toISOString(), '2026-11-22T10:00:00.000Z');

    // Crossing year boundary: 2026-12-22 -> 2027-01-22
    const periodCrossYear = UsageRepository.resolveUsagePeriod(sub, new Date('2027-01-05T12:00:00.000Z'));
    assert.equal(periodCrossYear.startsAt.toISOString(), '2026-12-22T10:00:00.000Z');
    assert.equal(periodCrossYear.endsAt.toISOString(), '2027-01-22T10:00:00.000Z');

    // Final cycle clamped to pEnd: 2027-07-22 -> 2027-08-22
    const periodFinal = UsageRepository.resolveUsagePeriod(sub, new Date('2027-08-01T12:00:00.000Z'));
    assert.equal(periodFinal.startsAt.toISOString(), '2027-07-22T10:00:00.000Z');
    assert.equal(periodFinal.endsAt.toISOString(), '2027-08-22T10:00:00.000Z');
  });

  it('MONTH-END CLAMPING & RECOVERY: handles Jan 31 anniversary across Feb (leap & non-leap) and 30-day months', async () => {
    // 1. Non-leap year 2025: Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 -> May 31
    const anchor2025 = new Date('2025-01-31T15:30:00.000Z');
    const sub2025 = {
      currentPeriodStart: anchor2025,
      currentPeriodEnd: new Date('2026-01-31T15:30:00.000Z'),
      createdAt: anchor2025
    };

    // Jan cycle
    const pJan = UsageRepository.resolveUsagePeriod(sub2025, new Date('2025-02-10T00:00:00.000Z'));
    assert.equal(pJan.startsAt.toISOString(), '2025-01-31T15:30:00.000Z');
    assert.equal(pJan.endsAt.toISOString(), '2025-02-28T15:30:00.000Z', 'Clamps Jan 31 -> Feb 28 in non-leap year');

    // Feb cycle
    const pFeb = UsageRepository.resolveUsagePeriod(sub2025, new Date('2025-03-10T00:00:00.000Z'));
    assert.equal(pFeb.startsAt.toISOString(), '2025-02-28T15:30:00.000Z');
    assert.equal(pFeb.endsAt.toISOString(), '2025-03-31T15:30:00.000Z', 'Recovers original 31st for March');

    // Mar cycle
    const pMar = UsageRepository.resolveUsagePeriod(sub2025, new Date('2025-04-10T00:00:00.000Z'));
    assert.equal(pMar.startsAt.toISOString(), '2025-03-31T15:30:00.000Z');
    assert.equal(pMar.endsAt.toISOString(), '2025-04-30T15:30:00.000Z', 'Clamps to Apr 30');

    // Apr cycle
    const pApr = UsageRepository.resolveUsagePeriod(sub2025, new Date('2025-05-10T00:00:00.000Z'));
    assert.equal(pApr.startsAt.toISOString(), '2025-04-30T15:30:00.000Z');
    assert.equal(pApr.endsAt.toISOString(), '2025-05-31T15:30:00.000Z', 'Recovers original 31st for May');

    // 2. Leap year 2024: Jan 31 -> Feb 29 -> Mar 31
    const anchor2024 = new Date('2024-01-31T12:00:00.000Z');
    const sub2024 = {
      currentPeriodStart: anchor2024,
      currentPeriodEnd: new Date('2025-01-31T12:00:00.000Z'),
      createdAt: anchor2024
    };

    const pLeapFeb = UsageRepository.resolveUsagePeriod(sub2024, new Date('2024-02-15T00:00:00.000Z'));
    assert.equal(pLeapFeb.startsAt.toISOString(), '2024-01-31T12:00:00.000Z');
    assert.equal(pLeapFeb.endsAt.toISOString(), '2024-02-29T12:00:00.000Z', 'Clamps Jan 31 -> Feb 29 in leap year');

    const pLeapMar = UsageRepository.resolveUsagePeriod(sub2024, new Date('2024-03-15T00:00:00.000Z'));
    assert.equal(pLeapMar.startsAt.toISOString(), '2024-02-29T12:00:00.000Z');
    assert.equal(pLeapMar.endsAt.toISOString(), '2024-03-31T12:00:00.000Z', 'Recovers original 31st for March');
  });

  it('QUOTA BOUNDARY PRECISION: resets quota exactly at the period boundary millisecond', async () => {
    const pStart = new Date('2026-08-22T00:00:00.000Z');
    const pEnd = new Date('2027-08-22T00:00:00.000Z');
    const sub = { currentPeriodStart: pStart, currentPeriodEnd: pEnd, createdAt: pStart };

    // 1 millisecond before boundary (2026-09-21T23:59:59.999Z) -> Cycle 1
    const justBefore = new Date('2026-09-21T23:59:59.999Z');
    const periodBefore = UsageRepository.resolveUsagePeriod(sub, justBefore);
    assert.equal(periodBefore.startsAt.toISOString(), '2026-08-22T00:00:00.000Z');
    assert.equal(periodBefore.endsAt.toISOString(), '2026-09-22T00:00:00.000Z');

    // Exactly at boundary (2026-09-22T00:00:00.000Z) -> Cycle 2
    const exactBoundary = new Date('2026-09-22T00:00:00.000Z');
    const periodAt = UsageRepository.resolveUsagePeriod(sub, exactBoundary);
    assert.equal(periodAt.startsAt.toISOString(), '2026-09-22T00:00:00.000Z');
    assert.equal(periodAt.endsAt.toISOString(), '2026-10-22T00:00:00.000Z');
  });

  it('LEGACY PLAN COMPATIBILITY: starter/growth/family are deactivated, readable for historical records, and rejected for new checkout', async () => {
    // 1. Inactive in catalogue
    const activePlans = await SubscriptionRepository.listActivePlans(db);
    const legacyCodes = ['starter', 'growth', 'family'];
    for (const code of legacyCodes) {
      assert.equal(activePlans.some((p) => p.code === code), false, `Legacy plan ${code} must not be in active catalogue`);
    }

    // 2. Reject new checkout creation for legacy plan
    const parentId = crypto.randomUUID();
    const onboard = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentId,
      householdName: 'Legacy Inquirer'
    });

    await assert.rejects(
      async () => {
        await SubscriptionService.createSubscription(db, mockRazorpay, {
          householdId: onboard.household.id,
          planCode: 'starter'
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /not active/i);
        return true;
      }
    );

    // 3. Historical active subscription on legacy plan remains readable without crashing
    const legacyPlan = await db.query<{ id: string }>(
      "SELECT id FROM plans WHERE code = 'growth' LIMIT 1;"
    );
    assert.ok(legacyPlan.rows.length > 0);

    const legacySubId = crypto.randomUUID();
    await db.query(
      `INSERT INTO subscriptions (
        id, household_id, plan_id, status, provider, provider_subscription_id,
        current_period_start, current_period_end, created_at, updated_at
      ) VALUES ($1, $2, $3, 'ACTIVE', 'razorpay', 'sub_legacy_historical_1', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW());`,
      [legacySubId, onboard.household.id, legacyPlan.rows[0].id]
    );

    const current = await EntitlementEnforcementService.getHouseholdEntitlements(db, onboard.household.id);
    assert.equal(current.hasActiveSubscription, true);
    assert.equal(current.planCode, 'growth');
    assert.equal(current.entitlements?.max_children, 2);
    assert.equal(current.entitlements?.monthly_voice_minutes, 90);
  });

  it('ONE LEARNER INVARIANT: Enforces exactly 1 child profile per student plan', async () => {
    const parentId = crypto.randomUUID();
    const onboard = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentId,
      householdName: 'Student Household'
    });

    await SubscriptionService.createSubscription(db, mockRazorpay, {
      householdId: onboard.household.id,
      planCode: 'free'
    });

    // 1st child succeeds
    await TenancyRepository.createChildProfile(db, {
      householdId: onboard.household.id,
      preferredName: 'First Learner',
      gradeBand: 'Grade 5'
    });

    // 2nd child rejected by quota
    await assert.rejects(
      async () => {
        await EntitlementEnforcementService.enforceChildCreationLimit(db, onboard.household.id);
      },
      (err: any) => {
        assert.ok(err instanceof QuotaExceededError);
        assert.equal(err.details?.limit, 1);
        return true;
      }
    );
  });

  it('syncPlans: selectively synchronizes paid self-service plans while skipping free and signature', async () => {
    const mappings = {
      evolve_monthly: 'plan_TSjT9Ifa8DTh7Z',
      evolve_annual: 'plan_TSjUXWPgXzcgq8',
      evolve_plus_monthly: 'plan_TSjVjSNRMup7HO',
      evolve_plus_annual: 'plan_TSjZ318E9ZXK2O',
      genesis_monthly: 'plan_TSja9QfOGIJzZz',
      genesis_annual: 'plan_TSjbfa4D4Iemuo'
    };

    const syncResult = await SubscriptionService.syncPlans(db, mappings);
    assert.equal(syncResult.syncedCount, 6);
    assert.deepEqual(syncResult.updatedPlans.sort(), [
      'evolve_annual',
      'evolve_monthly',
      'evolve_plus_annual',
      'evolve_plus_monthly',
      'genesis_annual',
      'genesis_monthly'
    ].sort());

    // Verify DB updated with exact provider IDs
    const evolveMo = await SubscriptionRepository.getPlanByCode(db, 'evolve_monthly');
    assert.equal(evolveMo?.providerPlanId, 'plan_TSjT9Ifa8DTh7Z');

    const evolveYr = await SubscriptionRepository.getPlanByCode(db, 'evolve_annual');
    assert.equal(evolveYr?.providerPlanId, 'plan_TSjUXWPgXzcgq8');

    const evolvePlusMo = await SubscriptionRepository.getPlanByCode(db, 'evolve_plus_monthly');
    assert.equal(evolvePlusMo?.providerPlanId, 'plan_TSjVjSNRMup7HO');

    const evolvePlusYr = await SubscriptionRepository.getPlanByCode(db, 'evolve_plus_annual');
    assert.equal(evolvePlusYr?.providerPlanId, 'plan_TSjZ318E9ZXK2O');

    const genesisMo = await SubscriptionRepository.getPlanByCode(db, 'genesis_monthly');
    assert.equal(genesisMo?.providerPlanId, 'plan_TSja9QfOGIJzZz');

    const genesisYr = await SubscriptionRepository.getPlanByCode(db, 'genesis_annual');
    assert.equal(genesisYr?.providerPlanId, 'plan_TSjbfa4D4Iemuo');

    // FREE and SIGNATURE must have no provider plan ID
    const freePlan = await SubscriptionRepository.getPlanByCode(db, 'free');
    assert.equal(freePlan?.providerPlanId, null, 'Free plan must have null providerPlanId');

    const sigPlan = await SubscriptionRepository.getPlanByCode(db, 'signature');
    assert.equal(sigPlan?.providerPlanId, null, 'Signature plan must have null providerPlanId');
  });

  it('PUBLIC CONTRACT: GET /api/plans removes max_children from all public plan entitlements', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '3000',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: 'secret'
    });

    const app = buildApp(config, {
      database: db,
      authVerifier: new MockAuthVerifier(),
      razorpayClient: mockRazorpay
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/plans'
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.plans));
    assert.equal(body.plans.length, 8);

    for (const plan of body.plans) {
      assert.equal(
        plan.entitlements?.max_children,
        undefined,
        `Plan '${plan.code}' must NOT expose max_children in public API response`
      );
      if (plan.code !== 'signature') {
        assert.ok(
          typeof plan.entitlements?.monthly_ai_sessions === 'number',
          `Plan '${plan.code}' must retain monthly_ai_sessions`
        );
        assert.ok(
          typeof plan.entitlements?.monthly_voice_minutes === 'number',
          `Plan '${plan.code}' must retain monthly_voice_minutes`
        );
      }
    }

    await app.close();
  });

  describe('Subscription Lifecycle & Invariant Hardening', () => {
    it('creating Free cannot replace an existing paid ACTIVE plan (rejects downgrade)', async () => {
      const parentId = crypto.randomUUID();
      const onboard = await TenancyService.createHouseholdWithOwner(db, {
        userId: parentId,
        householdName: 'Active Paid Household'
      });

      // Synchronize provider plan IDs for testing
      await SubscriptionService.syncPlans(db, {
        evolve_monthly: 'plan_TSjT9Ifa8DTh7Z',
        evolve_annual: 'plan_TSjUXWPgXzcgq8',
        evolve_plus_monthly: 'plan_TSjVjSNRMup7HO',
        evolve_plus_annual: 'plan_TSjZ318E9ZXK2O',
        genesis_monthly: 'plan_TSja9QfOGIJzZz',
        genesis_annual: 'plan_TSjbfa4D4Iemuo'
      });

      // 1. Create paid subscription order and activate via webhook
      mockRazorpay.nextSubscriptionId = `sub_paid_test_${crypto.randomUUID()}`;
      const createPaid = await SubscriptionService.createSubscription(db, mockRazorpay, {
        householdId: onboard.household.id,
        planCode: 'evolve_monthly'
      });

      const activateWebhookPayload = {
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: createPaid.providerSubscriptionId,
              status: 'active',
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor(Date.now() / 1000) + 30 * 86400
            }
          }
        }
      };

      const rawBody = JSON.stringify(activateWebhookPayload);
      const signature = crypto
        .createHmac('sha256', mockRazorpay.webhookSecret)
        .update(rawBody)
        .digest('hex');

      await SubscriptionService.processWebhook(db, mockRazorpay, {
        rawBody,
        signature,
        eventIdHeader: `evt_test_${Date.now()}`
      });

      // Verify Evolve Monthly is ACTIVE
      const currentSub = await SubscriptionRepository.getLatestSubscriptionForHousehold(
        db,
        onboard.household.id
      );
      assert.equal(currentSub?.status, 'ACTIVE');
      assert.equal(currentSub?.planCode, 'evolve_monthly');

      // 2. Attempting to call createSubscription('free') must throw BadRequestError and NOT downgrade
      await assert.rejects(
        async () => {
          await SubscriptionService.createSubscription(db, mockRazorpay, {
            householdId: onboard.household.id,
            planCode: 'free'
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestError);
          assert.match(err.message, /active paid subscription/i);
          return true;
        }
      );

      // Verify paid plan is STILL active and untouched
      const subAfterAttempt = await SubscriptionRepository.getLatestSubscriptionForHousehold(
        db,
        onboard.household.id
      );
      assert.equal(subAfterAttempt?.status, 'ACTIVE');
      assert.equal(subAfterAttempt?.planCode, 'evolve_monthly');
    });

    it('creating Free for an already-active Free household is idempotent and creates no duplicate rows', async () => {
      const parentId = crypto.randomUUID();
      const onboard = await TenancyService.createHouseholdWithOwner(db, {
        userId: parentId,
        householdName: 'Idempotent Free Household'
      });

      // 1. Initial Free activation
      const first = await SubscriptionService.createSubscription(db, mockRazorpay, {
        householdId: onboard.household.id,
        planCode: 'free'
      });
      assert.equal(first.subscription.status, 'ACTIVE');

      // 2. Re-trigger Free activation
      const second = await SubscriptionService.createSubscription(db, mockRazorpay, {
        householdId: onboard.household.id,
        planCode: 'free'
      });
      assert.equal(second.subscription.id, first.subscription.id, 'Must return same subscription idempotently');

      // Verify total count in database is exactly 1
      const countRes = await db.query(
        `SELECT COUNT(*) as count FROM subscriptions WHERE household_id = $1;`,
        [onboard.household.id]
      );
      assert.equal(Number(countRes.rows[0].count), 1);
    });

    it('failed or abandoned checkout leaves existing active plan untouched and entitled', async () => {
      const parentId = crypto.randomUUID();
      const onboard = await TenancyService.createHouseholdWithOwner(db, {
        userId: parentId,
        householdName: 'Abandoned Checkout Household'
      });

      // 1. User starts with Free plan
      await SubscriptionService.createSubscription(db, mockRazorpay, {
        householdId: onboard.household.id,
        planCode: 'free'
      });

      // 2. User initiates Evolve+ checkout (PENDING_PAYMENT)
      mockRazorpay.nextSubscriptionId = `sub_abandoned_${crypto.randomUUID()}`;
      const paidOrder = await SubscriptionService.createSubscription(db, mockRazorpay, {
        householdId: onboard.household.id,
        planCode: 'evolve_plus_monthly'
      });
      assert.equal(paidOrder.subscription.status, 'PENDING_PAYMENT');

      // 3. User abandons checkout without paying
      // Verify household entitlements are STILL active from original Free plan
      const entitlements = await EntitlementEnforcementService.getHouseholdEntitlements(
        db,
        onboard.household.id
      );
      assert.equal(entitlements.hasActiveSubscription, true);
      assert.equal(entitlements.planCode, 'free');
      assert.equal(entitlements.entitlements?.monthly_ai_sessions, 20);
    });

    it('successful paid activation expires previous Free plan and guarantees exactly 1 ACTIVE subscription', async () => {
      const parentId = crypto.randomUUID();
      const onboard = await TenancyService.createHouseholdWithOwner(db, {
        userId: parentId,
        householdName: 'Upgraded Household'
      });

      // 1. User starts with Free
      const freeResult = await SubscriptionService.createSubscription(db, mockRazorpay, {
        householdId: onboard.household.id,
        planCode: 'free'
      });
      assert.equal(freeResult.subscription.status, 'ACTIVE');

      // 2. User creates paid subscription
      mockRazorpay.nextSubscriptionId = `sub_upgrade_${crypto.randomUUID()}`;
      const paidOrder = await SubscriptionService.createSubscription(db, mockRazorpay, {
        householdId: onboard.household.id,
        planCode: 'evolve_monthly'
      });

      // 3. Webhook confirms payment and activates paid subscription
      const rawBody = JSON.stringify({
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: paidOrder.providerSubscriptionId,
              status: 'active',
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor(Date.now() / 1000) + 30 * 86400
            }
          }
        }
      });
      const signature = crypto
        .createHmac('sha256', mockRazorpay.webhookSecret)
        .update(rawBody)
        .digest('hex');

      await SubscriptionService.processWebhook(db, mockRazorpay, {
        rawBody,
        signature,
        eventIdHeader: `evt_upgrade_${Date.now()}`
      });

      // 4. Assert exactly ONE ACTIVE subscription exists for this household
      const activeSubsRes = await db.query(
        `SELECT id, status, provider FROM subscriptions WHERE household_id = $1 AND status = 'ACTIVE';`,
        [onboard.household.id]
      );
      assert.equal(activeSubsRes.rows.length, 1, 'Exactly one subscription must be ACTIVE');
      assert.equal(activeSubsRes.rows[0].id, paidOrder.subscription.id);
      assert.equal(activeSubsRes.rows[0].provider, 'razorpay');

      // 5. Assert previous Free subscription was expired
      const oldFreeRes = await db.query(
        `SELECT id, status FROM subscriptions WHERE id = $1;`,
        [freeResult.subscription.id]
      );
      assert.equal(oldFreeRes.rows[0].status, 'EXPIRED');

      // 6. Entitlements reflect paid plan
      const entitlements = await EntitlementEnforcementService.getHouseholdEntitlements(
        db,
        onboard.household.id
      );
      assert.equal(entitlements.planCode, 'evolve_monthly');
      assert.equal(entitlements.entitlements?.monthly_ai_sessions, 150);
      assert.equal(entitlements.entitlements?.monthly_voice_minutes, 45);
    });
  });
});
