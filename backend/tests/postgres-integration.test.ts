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
    assert.ok(startMs <= nowMs, 'Current period must start in past or now');
    assert.ok(nowMs < endMs, 'Current period must end in future');
  });
});


