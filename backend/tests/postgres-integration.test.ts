import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createDatabase, type PostgresDatabase } from '../src/db/client.js';
import { runMigrations, MigrationChecksumMismatchError } from '../src/db/migrator.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { HouseholdRoles, ChildStatuses } from '../src/domain/tenancy/types.js';

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
});
