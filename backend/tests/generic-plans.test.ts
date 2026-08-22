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
import { TenancyService } from '../src/domain/tenancy/service.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { BadRequestError, QuotaExceededError } from '../src/errors/index.js';

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
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }
  };

  return db;
}

describe('Generic Plan Catalogue & Arbitrary Provider Mapping Architecture', () => {
  let db: TransactionalQueryable;
  const mockRazorpay = new MockRazorpayClient();

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
  });

  describe('Provider Mapping Parser (SubscriptionService.parsePlanMappings)', () => {
    it('parses JSON string mappings for arbitrary plan codes', () => {
      const json = '{"solo_learner":"plan_solo_123","annual_pack":"plan_ann_456"}';
      const parsed = SubscriptionService.parsePlanMappings(json);

      assert.equal(parsed['solo_learner'], 'plan_solo_123');
      assert.equal(parsed['annual_pack'], 'plan_ann_456');
    });

    it('parses comma-separated key-value pairs', () => {
      const csv = 'basic:plan_basic_99, enterprise:plan_ent_88 ';
      const parsed = SubscriptionService.parsePlanMappings(csv);

      assert.equal(parsed['basic'], 'plan_basic_99');
      assert.equal(parsed['enterprise'], 'plan_ent_88');
    });

    it('merges legacy individual environment variables as fallbacks', () => {
      const parsed = SubscriptionService.parsePlanMappings(
        '{"custom_tier":"plan_custom_77"}',
        {
          starterId: 'plan_starter_legacy',
          growthId: 'plan_growth_legacy',
          familyId: 'plan_family_legacy'
        }
      );

      assert.equal(parsed['custom_tier'], 'plan_custom_77');
      assert.equal(parsed['starter'], 'plan_starter_legacy');
      assert.equal(parsed['growth'], 'plan_growth_legacy');
      assert.equal(parsed['family'], 'plan_family_legacy');
    });
  });

  describe('Arbitrary Plan Catalogue Support (1, 2, 4+ Plans)', () => {
    it('supports a single custom plan in the catalogue', async () => {
      const customCode = `solo_${Date.now()}`;
      const planRes = await db.query(
        `INSERT INTO plans (code, name, description, currency, amount_paise, billing_interval, is_active, provider_plan_id)
         VALUES ($1, 'Solo Explorer', 'One learner plan', 'INR', 19900, 'monthly', true, 'plan_solo_test')
         RETURNING id;`,
        [customCode]
      );
      const planId = planRes.rows[0].id;

      await db.query(
        `INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
         VALUES ($1, 'max_children', 'integer', '1'),
                ($1, 'monthly_ai_sessions', 'integer', '50'),
                ($1, 'monthly_voice_minutes', 'integer', '15');`,
        [planId]
      );

      const plan = await SubscriptionRepository.getPlanByCode(db, customCode);
      assert.ok(plan);
      assert.equal(plan.code, customCode);
      assert.equal(plan.entitlements.max_children, 1);
      assert.equal(plan.entitlements.monthly_ai_sessions, 50);

      const { household } = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Single Plan Household'
      });

      const subResult = await SubscriptionService.createSubscription(db, mockRazorpay, {
        householdId: household.id,
        planCode: customCode
      });

      assert.equal(subResult.plan.code, customCode);
      assert.equal(subResult.subscription.status, 'PENDING_PAYMENT');
    });

    it('supports 4+ arbitrary plans with dynamic price and custom entitlement limits', async () => {
      const planCodes = [`tier_a_${Date.now()}`, `tier_b_${Date.now()}`, `tier_c_${Date.now()}`, `tier_d_${Date.now()}`];

      for (let i = 0; i < planCodes.length; i++) {
        const code = planCodes[i];
        const maxChildren = i + 1;
        const aiSessions = (i + 1) * 100;
        const planRes = await db.query(
          `INSERT INTO plans (code, name, description, currency, amount_paise, billing_interval, is_active, provider_plan_id)
           VALUES ($1, $2, 'Tier description', 'INR', $3, 'monthly', true, $4)
           RETURNING id;`,
          [
            code,
            `Tier ${i + 1}`,
            (i + 1) * 25000,
            `plan_provider_${code}`
          ]
        );
        const planId = planRes.rows[0].id;

        await db.query(
          `INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
           VALUES ($1, 'max_children', 'integer', $2),
                  ($1, 'monthly_ai_sessions', 'integer', $3),
                  ($1, 'monthly_voice_minutes', 'integer', '60');`,
          [planId, String(maxChildren), String(aiSessions)]
        );
      }

      const activePlans = await SubscriptionRepository.listActivePlans(db);
      assert.ok(activePlans.length >= 4);

      // Verify that the 4th tier plan strictly enforces its own 4-learner quota from database
      const fourthPlanCode = planCodes[3];
      const fourthPlan = await SubscriptionRepository.getPlanByCode(db, fourthPlanCode);
      assert.equal(fourthPlan?.entitlements.max_children, 4);

      const { household } = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Multi Plan Household'
      });

      const subResult = await SubscriptionService.createSubscription(db, mockRazorpay, {
        householdId: household.id,
        planCode: fourthPlanCode
      });

      // Simulate webhook activation to ACTIVE
      await db.query(
        `UPDATE subscriptions SET status = 'ACTIVE' WHERE id = $1;`,
        [subResult.subscription.id]
      );

      const entitlementsContext = await EntitlementEnforcementService.getHouseholdEntitlements(db, household.id);
      assert.equal(entitlementsContext.hasActiveSubscription, true);
      assert.equal(entitlementsContext.planCode, fourthPlanCode);
      assert.equal(entitlementsContext.entitlements?.max_children, 4);
      assert.equal(entitlementsContext.entitlements?.monthly_ai_sessions, 400);

      // Add 4 children - all 4 should succeed
      for (let i = 0; i < 4; i++) {
        await EntitlementEnforcementService.enforceChildCreationLimit(db, household.id);
        await TenancyRepository.createChildProfile(db, {
          householdId: household.id,
          displayName: `Child ${i + 1}`,
          preferredName: `Child ${i + 1}`,
          gradeBand: 'GRADE_1_2'
        });
      }

      // 5th child must be rejected by database-derived quota (limit = 4)
      await assert.rejects(
        async () => {
          await EntitlementEnforcementService.enforceChildCreationLimit(db, household.id);
        },
        (err: any) => {
          return err instanceof QuotaExceededError && err.details?.limit === 4 && err.details?.current === 4;
        }
      );
    });
  });

  describe('Missing Provider Mapping & Inactive Plan Protection', () => {
    it('fails safely when subscribing to a plan missing provider_plan_id', async () => {
      const unmappedCode = `unmapped_${Date.now()}`;
      await db.query(
        `INSERT INTO plans (code, name, description, currency, amount_paise, billing_interval, is_active, provider_plan_id)
         VALUES ($1, 'Unmapped Plan', 'No provider ID', 'INR', 39900, 'monthly', true, NULL);`,
        [unmappedCode]
      );

      const { household } = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Unmapped Test Household'
      });

      await assert.rejects(
        async () => {
          await SubscriptionService.createSubscription(db, mockRazorpay, {
            householdId: household.id,
            planCode: unmappedCode
          });
        },
        (err: any) => {
          return err instanceof BadRequestError && err.message.includes('has no configured provider plan ID');
        }
      );
    });

    it('rejects subscription creation for an inactive plan (is_active = false)', async () => {
      const inactiveCode = `retired_${Date.now()}`;
      await db.query(
        `INSERT INTO plans (code, name, description, currency, amount_paise, billing_interval, is_active, provider_plan_id)
         VALUES ($1, 'Retired Plan', 'Inactive', 'INR', 39900, 'monthly', false, 'plan_retired');`,
        [inactiveCode]
      );

      const { household } = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Inactive Test Household'
      });

      await assert.rejects(
        async () => {
          await SubscriptionService.createSubscription(db, mockRazorpay, {
            householdId: household.id,
            planCode: inactiveCode
          });
        },
        (err: any) => {
          return err instanceof BadRequestError && err.message.includes('is not active');
        }
      );
    });

    it('syncPlans idempotently updates all active plans and detects missing mappings safely', async () => {
      const testCode = `sync_test_${Date.now()}`;
      await db.query(
        `INSERT INTO plans (code, name, description, currency, amount_paise, billing_interval, is_active, provider_plan_id)
         VALUES ($1, 'Sync Test Plan', 'desc', 'INR', 29900, 'monthly', true, NULL);`,
        [testCode]
      );

      // Attempt sync with missing mapping for this newly added active plan
      await assert.rejects(
        async () => {
          await SubscriptionService.syncPlans(db, {
            starter: 'plan_starter_test',
            growth: 'plan_growth_test',
            family: 'plan_family_test'
            // missing testCode
          });
        },
        (err: any) => {
          return err.message.includes(testCode) && err.message.includes('missing provider plan ID');
        }
      );

      // Provide mapping for all active plans
      const activePlans = await SubscriptionRepository.listActivePlans(db);
      const fullMapping: Record<string, string> = {};
      for (const p of activePlans) {
        fullMapping[p.code] = `rzp_${p.code}_synced`;
      }

      const syncResult = await SubscriptionService.syncPlans(db, fullMapping);
      assert.ok(syncResult.syncedCount >= 1);
      assert.ok(syncResult.updatedPlans.includes(testCode));

      // Check that the database now contains the synced ID
      const updatedPlan = await SubscriptionRepository.getPlanByCode(db, testCode);
      assert.equal(updatedPlan?.providerPlanId, `rzp_${testCode}_synced`);

      // Second run is completely idempotent
      const idempotentResult = await SubscriptionService.syncPlans(db, fullMapping);
      assert.equal(idempotentResult.syncedCount, syncResult.syncedCount);
    });
  });
});
