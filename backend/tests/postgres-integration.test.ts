import 'dotenv/config';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createDatabase, type PostgresDatabase } from '../src/db/client.js';
import { runMigrations, MigrationChecksumMismatchError } from '../src/db/migrator.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { HouseholdRoles, ChildStatuses } from '../src/domain/tenancy/types.js';
import { UsageRepository } from '../src/domain/usage/repository.js';
import { UsageService } from '../src/domain/usage/service.js';
import { AppuRequestService } from '../src/domain/appu-request/service.js';
import { AppuRequestRepository } from '../src/domain/appu-request/repository.js';
import { AppuRequestStates } from '../src/domain/appu-request/types.js';
import { GuestRepository } from '../src/domain/guest/repository.js';
import { GuestSessionService } from '../src/domain/guest/service.js';
import { SubscriptionRepository } from '../src/domain/subscription/repository.js';
import { SubscriptionStates } from '../src/domain/subscription/types.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { MockRazorpayClient } from '../src/domain/razorpay/mock-client.js';
import { MockN8nClient } from '../src/domain/gateway/mock-client.js';
import { QuotaExceededError } from '../src/errors/index.js';

const testDbUrl = process.env.TEST_DATABASE_URL?.trim();

describe('Real PostgreSQL Integration Suite', { skip: !testDbUrl }, () => {
  let db: PostgresDatabase;

  before(async () => {
    if (!testDbUrl) {
      console.log('\n[Real PostgreSQL] TEST_DATABASE_URL is not set. Skipping real PostgreSQL integration suite.');
      return;
    }

    db = createDatabase({ connectionString: testDbUrl });
    const isReady = await db.isHealthy();
    if (!isReady) {
      throw new Error(`Failed to connect to real PostgreSQL at TEST_DATABASE_URL: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`);
    }
  });

  after(async () => {
    if (db) {
      await db.close().catch(() => {});
    }
  });

  test('executes migrations and records SHA-256 checksums on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const applied = await runMigrations(db);
    assert.ok(Array.isArray(applied));

    const migrationRows = await db.query(
      'SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version ASC;'
    );
    assert.ok(migrationRows.rows.length > 0);
    assert.match(migrationRows.rows[0].checksum, /^[a-f0-9]{64}$/);

    // Idempotency: second run applies 0
    const secondRun = await runMigrations(db);
    assert.deepEqual(secondRun, []);
  });

  test('atomic household + owner creation on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const parentUserId = crypto.randomUUID();
    const { household, owner } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      householdName: 'Real Postgres Test Household'
    });

    assert.ok(household.id);
    assert.ok(owner.id);
    assert.equal(owner.role, 'OWNER');
    assert.equal(owner.userId, parentUserId);

    // Verify lookup
    const found = await TenancyRepository.getHouseholdById(db, household.id);
    assert.ok(found);
    assert.equal(found.id, household.id);
  });

  test('adversarial cross-tenant isolation on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household: hA } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Tenant A'
    });

    const { household: hB } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Tenant B'
    });

    const childB = await TenancyRepository.createChildProfile(db, {
      householdId: hB.id,
      preferredName: 'Real Child B',
      gradeBand: 'Grade 9',
      status: ChildStatuses.ACTIVE
    });

    // Cross-tenant lookup must return null
    const crossGet = await TenancyRepository.getChildProfile(db, hA.id, childB.id);
    assert.equal(crossGet, null, 'Real PostgreSQL: getChildProfile across tenant boundary must return null');

    // Cross-tenant list must not leak Child B into Tenant A
    const listA = await TenancyRepository.listChildProfilesByHousehold(db, hA.id);
    assert.equal(listA.some((c) => c.id === childB.id), false);
  });

  test('plans and subscription persistence on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    // Verify plans were seeded by 002 migration
    const plansResult = await db.query('SELECT code, name, amount_paise FROM plans ORDER BY amount_paise ASC;');
    assert.ok(plansResult.rows.length >= 3);
    assert.equal(plansResult.rows.some((p: any) => p.code === 'growth'), true);
  });

  test('child personalisation persistence on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Personalisation Household'
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Real Child Pers',
      gradeBand: 'Grade 4',
      status: ChildStatuses.ACTIVE
    });

    const pers = await db.query(
      `INSERT INTO child_personalisation (
        household_id, child_id, preferred_language, font_preference, learning_style,
        interests, response_style, theme_preference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;`,
      [
        household.id,
        child.id,
        'kn',
        'rounded',
        'visual',
        JSON.stringify(['astronomy', 'coding']),
        'playful',
        'bright'
      ]
    );

    assert.equal(pers.rows.length, 1);
    assert.equal(pers.rows[0].preferred_language, 'kn');
  });

  test('ADVERSARIAL FK: Household A cannot create usage attached to Household B subscription on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household: hhA } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Tenant A'
    });

    const { household: hhB } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Tenant B'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    // Create subscription for Household B
    const subB = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING id;`,
      [hhB.id, planId]
    );
    const subBId = subB.rows[0].id;

    // Attempt to insert usage_records with Household A and Subscription B (must fail with FK violation)
    await assert.rejects(
      async () => {
        await db.query(
          `INSERT INTO usage_records (
             household_id, subscription_id, metric, quantity, status,
             period_start, period_end, created_at, updated_at
           ) VALUES ($1, $2, 'ai_sessions', 1, 'committed', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW());`,
          [hhA.id, subBId]
        );
      },
      (err: any) => {
        // PostgreSQL foreign key violation code: 23503
        return err.code === '23503' || String(err).includes('foreign key constraint');
      }
    );
  });

  test('CHILD DELETE FK: deleting child profile retains usage record with child_id = NULL on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Child Delete Household'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    const sub = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING id;`,
      [household.id, planId]
    );
    const subscriptionId = sub.rows[0].id;

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Child To Delete',
      gradeBand: 'Grade 3',
      status: ChildStatuses.ACTIVE
    });

    // Create usage record referencing child
    const usageRes = await db.query(
      `INSERT INTO usage_records (
         household_id, subscription_id, child_id, metric, quantity, status,
         period_start, period_end, created_at, updated_at
       ) VALUES ($1, $2, $3, 'ai_sessions', 1, 'committed', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())
       RETURNING id;`,
      [household.id, subscriptionId, child.id]
    );
    const usageId = usageRes.rows[0].id;

    // Delete the child profile
    await db.query('DELETE FROM child_profiles WHERE id = $1 AND household_id = $2;', [child.id, household.id]);

    // Verify usage record still exists with child_id set to NULL
    const checkUsage = await db.query<{ id: string; household_id: string; child_id: string | null; quantity: number }>(
      'SELECT id, household_id, child_id, quantity FROM usage_records WHERE id = $1;',
      [usageId]
    );

    assert.equal(checkUsage.rows.length, 1);
    assert.equal(checkUsage.rows[0].household_id, household.id);
    assert.equal(checkUsage.rows[0].child_id, null);
    assert.equal(checkUsage.rows[0].quantity, 1);
  });

  test('CONCURRENCY: 10 simultaneous reservations with quota = 1 result in exactly 1 success on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Concurrency Household'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    const sub = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING *;`,
      [household.id, planId]
    );
    const subscriptionId = sub.rows[0].id;

    const quotaLimit = 1; // Strict limit: only 1 request allowed

    // Launch 10 simultaneous parallel reservation attempts
    const attempts = Array.from({ length: 10 }, (_, i) => i);
    const results = await Promise.allSettled(
      attempts.map(() =>
        db.transaction(async (txClient: any) => {
          const txDb = {
            query: (t: string, p?: any[]) => txClient.query(t, p),
            transaction: async (cb: any) => cb(txClient)
          };
          const res = await UsageRepository.reserveUsageAtomic(txDb as any, {
            householdId: household.id,
            subscriptionId,
            metric: 'ai_sessions',
            quantity: 1,
            quotaLimit
          });
          // Commit reservation inside the transaction
          await UsageRepository.commitReservation(txDb as any, household.id, res.reservationId);
          return res;
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Exactly 1 simultaneous reservation must succeed');
    assert.equal(rejected.length, 9, 'Exactly 9 simultaneous reservations must be rejected');

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        assert.ok(
          rej.reason instanceof QuotaExceededError ||
          rej.reason?.code === 'quota_exceeded' ||
          String(rej.reason).includes('Quota exceeded')
        );
      }
    }

    // Verify total committed usage on database is exactly 1
    const period = UsageRepository.resolveUsagePeriod({
      createdAt: new Date(sub.rows[0].created_at)
    });
    const totalUsed = await UsageRepository.getUsedQuantity(
      db,
      household.id,
      subscriptionId,
      'ai_sessions',
      period.startsAt,
      period.endsAt
    );
    assert.equal(totalUsed, 1, 'Total database used count must be strictly 1');
  });

  test('IDEMPOTENCY: retrying with same idempotency key consumes exactly 1 unit on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Idempotency Household'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    const sub = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING *;`,
      [household.id, planId]
    );
    const subscriptionId = sub.rows[0].id;
    const clientKey = `req_${crypto.randomUUID()}`;

    // First attempt
    const res1 = await db.transaction(async (txClient: any) => {
      const txDb = {
        query: (t: string, p?: any[]) => txClient.query(t, p),
        transaction: async (cb: any) => cb(txClient)
      };
      const res = await UsageRepository.reserveUsageAtomic(txDb as any, {
        householdId: household.id,
        subscriptionId,
        metric: 'ai_sessions',
        quantity: 1,
        quotaLimit: 10,
        idempotencyKey: clientKey
      });
      await UsageRepository.commitReservation(txDb as any, household.id, res.reservationId);
      return res;
    });

    assert.equal(res1.isExisting, false);

    // Second attempt with same idempotency key (retry)
    const res2 = await db.transaction(async (txClient: any) => {
      const txDb = {
        query: (t: string, p?: any[]) => txClient.query(t, p),
        transaction: async (cb: any) => cb(txClient)
      };
      return UsageRepository.reserveUsageAtomic(txDb as any, {
        householdId: household.id,
        subscriptionId,
        metric: 'ai_sessions',
        quantity: 1,
        quotaLimit: 10,
        idempotencyKey: clientKey
      });
    });

    assert.equal(res2.isExisting, true);
    assert.equal(res2.reservationId, res1.reservationId);

    // Verify total recorded usage is still 1 (not 2)
    const period = UsageRepository.resolveUsagePeriod({
      createdAt: new Date(sub.rows[0].created_at)
    });
    const totalUsed = await UsageRepository.getUsedQuantity(
      db,
      household.id,
      subscriptionId,
      'ai_sessions',
      period.startsAt,
      period.endsAt
    );
    assert.equal(totalUsed, 1);
  });

  test('ADVERSARIAL CHILD FK: Household A cannot create usage attached to Household B child profile on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household: hhA } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Tenant A for Child FK'
    });

    const { household: hhB } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Tenant B for Child FK'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    // Subscription for Household A
    const subA = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING id;`,
      [hhA.id, planId]
    );
    const subAId = subA.rows[0].id;

    // Child profile for Household B
    const childB = await TenancyRepository.createChildProfile(db, {
      householdId: hhB.id,
      preferredName: 'Child B Belonging to Tenant B',
      gradeBand: 'Grade 5',
      status: ChildStatuses.ACTIVE
    });

    // Attempt to insert usage_records with Household A + Subscription A + Child B
    // Must be rejected by composite constraint fk_usage_records_child (household_id, child_id)
    await assert.rejects(
      async () => {
        await db.query(
          `INSERT INTO usage_records (
             household_id, subscription_id, child_id, metric, quantity, status,
             period_start, period_end, created_at, updated_at
           ) VALUES ($1, $2, $3, 'ai_sessions', 1, 'committed', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW());`,
          [hhA.id, subAId, childB.id]
        );
      },
      (err: any) => {
        return err.code === '23503' || String(err).includes('foreign key constraint');
      }
    );
  });

  test('IDEMPOTENCY CONFLICT: reusing idempotency key for different request fingerprint throws conflict on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Fingerprint Conflict Household'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    const sub = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING *;`,
      [household.id, planId]
    );
    const subscriptionId = sub.rows[0].id;
    const clientKey = `req_${crypto.randomUUID()}`;

    const fp1 = crypto.createHash('sha256').update(`${household.id}|child_1|message_1|en`).digest('hex');
    const fp2 = crypto.createHash('sha256').update(`${household.id}|child_1|message_2_different|en`).digest('hex');

    // First attempt with fp1
    await db.transaction(async (txClient: any) => {
      const txDb = {
        query: (t: string, p?: any[]) => txClient.query(t, p),
        transaction: async (cb: any) => cb(txClient)
      };
      const res = await UsageRepository.reserveUsageAtomic(txDb as any, {
        householdId: household.id,
        subscriptionId,
        metric: 'ai_sessions',
        quantity: 1,
        quotaLimit: 10,
        idempotencyKey: clientKey,
        requestFingerprint: fp1
      });
      await UsageRepository.commitReservation(txDb as any, household.id, res.reservationId);
    });

    // Second attempt with same key but DIFFERENT fingerprint (fp2)
    await assert.rejects(
      async () => {
        await db.transaction(async (txClient: any) => {
          const txDb = {
            query: (t: string, p?: any[]) => txClient.query(t, p),
            transaction: async (cb: any) => cb(txClient)
          };
          return UsageRepository.reserveUsageAtomic(txDb as any, {
            householdId: household.id,
            subscriptionId,
            metric: 'ai_sessions',
            quantity: 1,
            quotaLimit: 10,
            idempotencyKey: clientKey,
            requestFingerprint: fp2
          });
        });
      },
      (err: any) => {
        return err?.name === 'IdempotencyConflictError' || err?.statusCode === 409 || String(err).includes('different request');
      }
    );
  });

  test('PERIOD INVARIANT: future provider period falls back safely to current cycle on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Period Invariant Household'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    // Create subscription with future provider period (like Razorpay test mode cycle 3)
    const futureStart = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days in future
    const futureEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);   // 90 days in future

    await db.query(
      `INSERT INTO subscriptions (
         household_id, plan_id, status, provider,
         current_period_start, current_period_end, created_at, updated_at
       ) VALUES ($1, $2, 'ACTIVE', 'razorpay', $3, $4, NOW(), NOW())
       RETURNING *;`,
      [household.id, planId, futureStart, futureEnd]
    );

    const summary = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(summary.period.source, 'fallback', 'Future period must fall back to current cycle');
    const startMs = new Date(summary.period.startsAt).getTime();
    const endMs = new Date(summary.period.endsAt).getTime();
    const nowMs = Date.now();
    assert.ok(startMs <= nowMs + 2000, 'Current period must start in past or now');
    assert.ok(nowMs < endMs, 'Current period must end in future');
  });

  test('VOICE USAGE PERSISTENCE & CUMULATIVE DURATION: records voice duration in milliseconds on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Voice Household'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    const sub = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING *;`,
      [household.id, planId]
    );
    const subscriptionId = sub.rows[0].id;

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Real Postgres Voice Learner',
      gradeBand: 'Grade 3',
      status: ChildStatuses.ACTIVE
    });

    // Record 180,000 ms (3.0 minutes) of voice usage
    await UsageRepository.recordVoiceUsageAtomic(db, {
      householdId: household.id,
      subscriptionId,
      childId: child.id,
      durationMs: 180000,
      quotaLimitMs: 1800000,
      idempotencyKey: `v_real_${crypto.randomUUID()}`
    });

    // Verify summary
    const summary = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(summary.voiceMinutes.meteringStatus, 'active');
    assert.equal(summary.voiceMinutes.used, 3.0);
    assert.equal(summary.voiceMinutes.limit, 30);
    assert.equal(summary.voiceMinutes.remaining, 27.0);

    // Verify record in usage_records table directly
    const row = await db.query(
      "SELECT * FROM usage_records WHERE household_id = $1 AND metric = 'voice_duration_ms';",
      [household.id]
    );
    assert.equal(row.rows.length, 1);
    assert.equal(Number(row.rows[0].quantity), 180000);
    assert.equal(row.rows[0].status, 'committed');
  });

  test('VOICE IDEMPOTENCY: retrying with same idempotency key consumes exactly 1 unit on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Voice Idempotency Household'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    const sub = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING *;`,
      [household.id, planId]
    );
    const subscriptionId = sub.rows[0].id;
    const vKey = `voice_idem_${crypto.randomUUID()}`;

    // First write: 60,000 ms (1.0 min)
    await UsageRepository.recordVoiceUsageAtomic(db, {
      householdId: household.id,
      subscriptionId,
      durationMs: 60000,
      quotaLimitMs: 1800000,
      idempotencyKey: vKey
    });

    // Retry with exact same idempotency key
    await UsageRepository.recordVoiceUsageAtomic(db, {
      householdId: household.id,
      subscriptionId,
      durationMs: 60000,
      quotaLimitMs: 1800000,
      idempotencyKey: vKey
    });

    const summary = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(summary.voiceMinutes.used, 1.0, 'Idempotent retry must not duplicate voice usage');
    assert.equal(summary.voiceMinutes.remaining, 29.0);
  });

  test('VOICE STRICT BOUNDARY: generated audio exceeding remaining allowance is rejected without charging on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Strict Boundary Household'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    const sub = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING *;`,
      [household.id, planId]
    );
    const subscriptionId = sub.rows[0].id;

    // Quota = 10,000 ms (10 seconds)
    const quotaLimitMs = 10000;

    // 1. Pre-charge 8,000 ms (8.0 seconds) -> remaining = 2,000 ms (2.0 seconds)
    const preResult = await UsageRepository.recordVoiceUsageAtomic(db, {
      householdId: household.id,
      subscriptionId,
      durationMs: 8000,
      quotaLimitMs,
      idempotencyKey: `pre_${crypto.randomUUID()}`
    });
    assert.equal(preResult.delivered, true);
    assert.equal(preResult.remainingMs, 2000);

    // 2. Candidate audio = 5,000 ms (exceeds remaining 2,000 ms)
    const overspendResult = await UsageRepository.recordVoiceUsageAtomic(db, {
      householdId: household.id,
      subscriptionId,
      durationMs: 5000,
      quotaLimitMs,
      idempotencyKey: `over_${crypto.randomUUID()}`
    });

    // Invariant: rejected from audio delivery, 0 milliseconds recorded
    assert.equal(overspendResult.delivered, false);
    assert.equal(overspendResult.record, null);
    assert.equal(overspendResult.remainingMs, 2000);

    // 3. Verify database total usage remains exactly 8,000 ms
    const rows = await db.query<{ total: string }>(
      "SELECT COALESCE(SUM(quantity), 0) AS total FROM usage_records WHERE household_id = $1 AND metric = 'voice_duration_ms';",
      [household.id]
    );
    assert.equal(Number(rows.rows[0].total), 8000);
  });

  test('VOICE CONCURRENCY SERIALIZATION: simultaneous voice requests cannot overspend allowance on real PostgreSQL', async () => {
    if (!testDbUrl) return;

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Real Postgres Voice Concurrency Household'
    });

    const starterPlanRes = await db.query("SELECT id FROM plans WHERE code = 'starter';");
    const planId = starterPlanRes.rows[0].id;

    const sub = await db.query(
      `INSERT INTO subscriptions (household_id, plan_id, status, provider, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', 'razorpay', NOW(), NOW())
       RETURNING *;`,
      [household.id, planId]
    );
    const subscriptionId = sub.rows[0].id;

    // Quota = 10,000 ms. Two parallel requests attempt 7,000 ms each.
    const quotaLimitMs = 10000;
    const requestDurationMs = 7000;

    const results = await Promise.all([
      UsageService.recordVoiceUsageAtomic(db, {
        householdId: household.id,
        subscriptionId,
        durationMs: requestDurationMs,
        quotaLimitMs,
        idempotencyKey: `conc_v1_${crypto.randomUUID()}`
      }),
      UsageService.recordVoiceUsageAtomic(db, {
        householdId: household.id,
        subscriptionId,
        durationMs: requestDurationMs,
        quotaLimitMs,
        idempotencyKey: `conc_v2_${crypto.randomUUID()}`
      })
    ]);

    const deliveredCount = results.filter((r) => r.delivered).length;
    const rejectedCount = results.filter((r) => !r.delivered).length;

    assert.equal(deliveredCount, 1, 'Exactly one concurrent request must be granted voice');
    assert.equal(rejectedCount, 1, 'The other concurrent request must be safely rejected');

    // Verify total committed voice usage is exactly 7,000 ms <= 10,000 ms
    const rows = await db.query<{ total: string }>(
      "SELECT COALESCE(SUM(quantity), 0) AS total FROM usage_records WHERE household_id = $1 AND metric = 'voice_duration_ms';",
      [household.id]
    );
    assert.equal(Number(rows.rows[0].total), 7000);
  });

  test('real PostgreSQL: AppuRequestRepository.transition PENDING -> SUCCEEDED with completedAt omitted', async () => {
    if (!testDbUrl) return;

    const guestSessionId = `gst_pg_${crypto.randomUUID()}`;
    await GuestRepository.upsert(db, {
      id: guestSessionId,
      ipHash: 'test_ip_hash_pg',
      usedTurns: 1,
      expiresAt: new Date(Date.now() + 86400000)
    });

    const pendingReq = await AppuRequestRepository.createGuestPending(db, {
      guestSessionId,
      idempotencyKey: `pg_idem_${crypto.randomUUID()}`,
      requestFingerprint: `pg_fp_${crypto.randomUUID()}`
    });

    assert.equal(pendingReq.status, 'PENDING');
    assert.equal(pendingReq.completedAt, null);

    // Transition with completedAt omitted (simulating synchronous route handler completion)
    const transitioned = await AppuRequestRepository.transition(
      db,
      pendingReq.id,
      [AppuRequestStates.PENDING, AppuRequestStates.UNKNOWN],
      AppuRequestStates.SUCCEEDED
    );

    assert.ok(transitioned);
    assert.equal(transitioned!.status, 'SUCCEEDED');
    assert.ok(transitioned!.completedAt instanceof Date);
    assert.ok(!Number.isNaN(transitioned!.completedAt.getTime()));

    // Verify row in database
    const inDb = await AppuRequestRepository.getById(db, pendingReq.id);
    assert.ok(inDb);
    assert.equal(inDb!.status, 'SUCCEEDED');
    assert.ok(inDb!.completedAt instanceof Date);
  });

  test('real PostgreSQL: AppuRequestRepository.transition covers all state machine transitions', async () => {
    if (!testDbUrl) return;

    // 1. PENDING -> DEFINITE_FAILURE
    const guestSessionId1 = `gst_pg_df_${crypto.randomUUID()}`;
    await GuestRepository.upsert(db, {
      id: guestSessionId1,
      ipHash: 'test_ip_hash_df',
      usedTurns: 1,
      expiresAt: new Date(Date.now() + 86400000)
    });
    const req1 = await AppuRequestRepository.createGuestPending(db, {
      guestSessionId: guestSessionId1,
      idempotencyKey: `pg_idem_df_${crypto.randomUUID()}`,
      requestFingerprint: `pg_fp_df_${crypto.randomUUID()}`
    });
    const df1 = await AppuRequestRepository.transition(
      db,
      req1.id,
      [AppuRequestStates.PENDING],
      AppuRequestStates.DEFINITE_FAILURE,
      { failureCode: 'provider_error' }
    );
    assert.ok(df1);
    assert.equal(df1!.status, 'DEFINITE_FAILURE');
    assert.equal(df1!.failureCode, 'provider_error');
    assert.ok(df1!.completedAt instanceof Date);

    // 2. PENDING -> UNKNOWN (timeout)
    const guestSessionId2 = `gst_pg_un_${crypto.randomUUID()}`;
    await GuestRepository.upsert(db, {
      id: guestSessionId2,
      ipHash: 'test_ip_hash_un',
      usedTurns: 1,
      expiresAt: new Date(Date.now() + 86400000)
    });
    const req2 = await AppuRequestRepository.createGuestPending(db, {
      guestSessionId: guestSessionId2,
      idempotencyKey: `pg_idem_un_${crypto.randomUUID()}`,
      requestFingerprint: `pg_fp_un_${crypto.randomUUID()}`
    });
    const un2 = await AppuRequestRepository.transition(
      db,
      req2.id,
      [AppuRequestStates.PENDING],
      AppuRequestStates.UNKNOWN,
      { failureCode: 'transport_timeout' }
    );
    assert.ok(un2);
    assert.equal(un2!.status, 'UNKNOWN');
    assert.equal(un2!.failureCode, 'transport_timeout');
    assert.equal(un2!.completedAt, null);

    // 3. UNKNOWN -> SUCCEEDED (callback recovery)
    const suc3 = await AppuRequestRepository.transition(
      db,
      req2.id,
      [AppuRequestStates.UNKNOWN],
      AppuRequestStates.SUCCEEDED
    );
    assert.ok(suc3);
    assert.equal(suc3!.status, 'SUCCEEDED');
    assert.ok(suc3!.completedAt instanceof Date);

    // 4. Disallowed transition from terminal state returns null
    const invalid = await AppuRequestRepository.transition(
      db,
      req1.id,
      [AppuRequestStates.PENDING],
      AppuRequestStates.SUCCEEDED
    );
    assert.equal(invalid, null);
  });

  test('real PostgreSQL: full guest route with legacy live n8n response shape { output, text, message, audio_base64 }', async () => {
    if (!testDbUrl) return;

    const n8nClient = new MockN8nClient();
    n8nClient.nextResponse = {
      text: 'Namaskara! I am Appu on real PostgreSQL.',
      audioSource: 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAA='
    };

    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      PORT: 3000,
      HOST: '127.0.0.1',
      GUEST_SESSION_SECRET: 'test_guest_secret_at_least_16_chars',
      N8N_APPU_REQUEST_HMAC_SECRET: 'test_req_secret_at_least_32_chars_long',
      N8N_APPU_CALLBACK_HMAC_SECRET: 'test_cb_secret_at_least_32_chars_long',
      N8N_APPU_TIMEOUT_MS: 20000
    });

    const mockAuthVerifier = {
      verifyAccessToken: async () => { throw new Error('Not authenticated'); }
    };

    const app = buildApp(config, {
      database: db,
      authVerifier: mockAuthVerifier as any,
      razorpayClient: new MockRazorpayClient() as any,
      n8nClient: n8nClient as any
    });
    await app.ready();

    const idempotencyKey = `pg_guest_full_${crypto.randomUUID()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        'idempotency-key': idempotencyKey
      },
      payload: {
        message: 'Hello Appu on real postgres!',
        language: 'en'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.requestStatus, 'SUCCEEDED');
    assert.equal(body.text, 'Namaskara! I am Appu on real PostgreSQL.');
    assert.ok(body.audioSource);
    assert.equal(body.guestSession.used, 1);
    assert.equal(body.guestSession.remaining, 2);
    assert.ok(res.headers['x-guest-session-token']);

    const requestId = res.headers['x-appu-request-id'] as string;
    const record = await AppuRequestRepository.getById(db, requestId);
    assert.ok(record);
    assert.equal(record!.status, 'SUCCEEDED');
    assert.ok(record!.completedAt instanceof Date);

    // Idempotent duplicate replay: 0 extra n8n calls
    const n8nCallCountBefore = n8nClient.callCount;
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        'idempotency-key': idempotencyKey,
        'x-guest-session-token': res.headers['x-guest-session-token'] as string
      },
      payload: {
        message: 'Hello Appu on real postgres!',
        language: 'en'
      }
    });

    assert.equal(replayRes.statusCode, 200);
    const replayBody = replayRes.json();
    assert.equal(replayBody.idempotentReplay, true);
    assert.equal(n8nClient.callCount, n8nCallCountBefore, 'Must not call n8n on duplicate replay');
  });

  test('real PostgreSQL: full authenticated route with legacy live n8n response shape commits usage', async () => {
    if (!testDbUrl) return;

    const parentUserId = crypto.randomUUID();
    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      householdName: 'Real Postgres Auth Appu Household'
    });

    const testChild = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Rohan',
      gradeBand: 'PRIMARY'
    });

    const evolvePlan = await SubscriptionRepository.getPlanByCode(db, 'evolve_monthly');
    await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: evolvePlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: `sub_pg_appu_${crypto.randomUUID()}`,
      status: SubscriptionStates.ACTIVE
    });

    const n8nClient = new MockN8nClient();
    n8nClient.nextResponse = {
      text: 'Planets orbit the sun due to gravity.',
      audioSource: 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAA='
    };

    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      PORT: 3000,
      HOST: '127.0.0.1',
      GUEST_SESSION_SECRET: 'test_guest_secret_at_least_16_chars',
      N8N_APPU_REQUEST_HMAC_SECRET: 'test_req_secret_at_least_32_chars_long',
      N8N_APPU_CALLBACK_HMAC_SECRET: 'test_cb_secret_at_least_32_chars_long',
      N8N_APPU_TIMEOUT_MS: 20000
    });

    const mockAuthVerifier = {
      verifyAccessToken: async (token: string) => {
        if (token === 'valid_pg_parent_token') {
          return { userId: parentUserId, email: 'pgparent@example.com' };
        }
        throw new Error('Not authenticated');
      }
    };

    const app = buildApp(config, {
      database: db,
      authVerifier: mockAuthVerifier as any,
      razorpayClient: new MockRazorpayClient() as any,
      n8nClient: n8nClient as any
    });
    await app.ready();

    const idempotencyKey = `pg_auth_full_${crypto.randomUUID()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer valid_pg_parent_token',
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'Why do planets orbit the sun?',
        language: 'en'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.requestStatus, 'SUCCEEDED');
    assert.equal(body.text, 'Planets orbit the sun due to gravity.');

    const requestId = res.headers['x-appu-request-id'] as string;
    const record = await AppuRequestRepository.getById(db, requestId);
    assert.ok(record);
    assert.equal(record!.status, 'SUCCEEDED');
    assert.ok(record!.completedAt instanceof Date);

    // Verify usage record status is committed on real PostgreSQL
    const usageCheck = await db.query(
      'SELECT status FROM usage_records WHERE id = $1',
      [record!.usageRecordId]
    );
    assert.equal(usageCheck.rows[0].status, 'committed');
  });
});



