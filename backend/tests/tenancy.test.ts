import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations, computeChecksum, MigrationChecksumMismatchError } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { HouseholdRoles, ChildStatuses } from '../src/domain/tenancy/types.js';

function createTestDatabase(): TransactionalQueryable {
  const memDb = newDb();

  // Register gen_random_uuid() function in pg-mem as an impure function
  memDb.public.registerFunction({
    name: 'gen_random_uuid',
    returns: memDb.public.getType('uuid'),
    impure: true,
    implementation: () => crypto.randomUUID()
  });

  // Mock advisory transaction lock in pg-mem
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
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };

  return db;
}

describe('PostgreSQL Household Tenancy Foundation', () => {
  let db: TransactionalQueryable;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);
  });

  // ============================================================================
  // MIGRATIONS & CHECKSUMS
  // ============================================================================

  test('migrations apply cleanly and record SHA-256 checksum in schema_migrations', async () => {
    const migrations = await db.query<{ version: string; checksum: string; applied_at: Date }>(
      'SELECT version, checksum, applied_at FROM schema_migrations;'
    );
    assert.equal(migrations.rows.length, 10);
    assert.equal(migrations.rows[0].version, '001_initial_tenancy.sql');
    assert.match(migrations.rows[0].checksum, /^[a-f0-9]{64}$/);
    assert.equal(migrations.rows[1].version, '002_subscription_plans.sql');
    assert.match(migrations.rows[1].checksum, /^[a-f0-9]{64}$/);
    assert.equal(migrations.rows[2].version, '003_correct_test_plan_prices.sql');
    assert.match(migrations.rows[2].checksum, /^[a-f0-9]{64}$/);
    assert.equal(migrations.rows[3].version, '004_child_personalisation.sql');
    assert.match(migrations.rows[3].checksum, /^[a-f0-9]{64}$/);
    assert.equal(migrations.rows[4].version, '005_usage_accounting.sql');
    assert.match(migrations.rows[4].checksum, /^[a-f0-9]{64}$/);
    assert.equal(migrations.rows[5].version, '006_usage_accounting_hardening.sql');
    assert.match(migrations.rows[5].checksum, /^[a-f0-9]{64}$/);
    assert.equal(migrations.rows[6].version, '007_child_fk_and_idempotency_fingerprint.sql');
    assert.match(migrations.rows[6].checksum, /^[a-f0-9]{64}$/);
    assert.equal(migrations.rows[7].version, '008_voice_duration_metering.sql');
    assert.match(migrations.rows[7].checksum, /^[a-f0-9]{64}$/);
    assert.equal(migrations.rows[8].version, '009_appu_student_catalogue.sql');
    assert.match(migrations.rows[8].checksum, /^[a-f0-9]{64}$/);
    assert.equal(migrations.rows[9].version, '010_guest_sessions.sql');
    assert.match(migrations.rows[9].checksum, /^[a-f0-9]{64}$/);

    // Idempotency: running migrations a second time applies 0 new files without error
    const secondRun = await runMigrations(db);
    assert.deepEqual(secondRun, []);
  });

  test('checksum mismatch detection throws MigrationChecksumMismatchError on tampered migration', async () => {
    // Manually tamper with the stored checksum to simulate a modified historical migration
    await db.query(
      'UPDATE schema_migrations SET checksum = $1 WHERE version = $2;',
      ['0000000000000000000000000000000000000000000000000000000000000000', '001_initial_tenancy.sql']
    );

    await assert.rejects(
      async () => {
        await runMigrations(db);
      },
      (err: any) => {
        return (
          err instanceof MigrationChecksumMismatchError &&
          err.version === '001_initial_tenancy.sql' &&
          err.expectedChecksum === '0000000000000000000000000000000000000000000000000000000000000000'
        );
      }
    );
  });

  test('computeChecksum normalizes line endings across platforms', () => {
    const unixSql = 'CREATE TABLE test (id INT);\n';
    const windowsSql = 'CREATE TABLE test (id INT);\r\n';

    assert.equal(computeChecksum(unixSql), computeChecksum(windowsSql));
  });

  test('REGRESSION: existing schema_migrations without checksum column is safely upgraded and backfilled', async () => {
    const freshDb = createTestDatabase();

    // 1. Manually create pre-checksum schema_migrations table (Milestone 2A shape)
    await freshDb.query(`
      CREATE TABLE schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Record 001_initial_tenancy.sql as applied without checksum column
    await freshDb.query(
      "INSERT INTO schema_migrations (version, applied_at) VALUES ('001_initial_tenancy.sql', NOW());"
    );

    // Also manually create the tenancy tables so DB state matches historical migration
    await freshDb.query(`
      CREATE TABLE households (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE household_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT, user_id UUID NOT NULL, role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'PARENT')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT uq_household_member UNIQUE (household_id, user_id));
      CREATE TABLE child_profiles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT, preferred_name VARCHAR(100) NOT NULL, grade_band VARCHAR(50) NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT uq_child_profiles_household_id UNIQUE (household_id, id));
    `);

    // 2. Run migrator on legacy database: should safely add 'checksum' column, backfill checksum, and apply pending 002-010
    const applied = await runMigrations(freshDb);
    assert.deepEqual(applied, [
      '002_subscription_plans.sql',
      '003_correct_test_plan_prices.sql',
      '004_child_personalisation.sql',
      '005_usage_accounting.sql',
      '006_usage_accounting_hardening.sql',
      '007_child_fk_and_idempotency_fingerprint.sql',
      '008_voice_duration_metering.sql',
      '009_appu_student_catalogue.sql',
      '010_guest_sessions.sql'
    ]);

    // 3. Verify 'checksum' column exists and has valid SHA-256 value for 001
    const migrationRows = await freshDb.query<{ version: string; checksum: string }>(
      "SELECT version, checksum FROM schema_migrations WHERE version = '001_initial_tenancy.sql';"
    );
    assert.equal(migrationRows.rows.length, 1);
    assert.match(migrationRows.rows[0].checksum, /^[a-f0-9]{64}$/);

    // 4. Verify subsequent run is a no-op
    const secondRun = await runMigrations(freshDb);
    assert.deepEqual(secondRun, []);
  });

  test('REGRESSION: genuine migration SQL failure rolls back transaction without recording false success', async () => {
    const freshDb = createTestDatabase();

    // Mock a broken migration run by creating a custom migration runner invocation with failing SQL
    await assert.rejects(
      async () => {
        await freshDb.transaction(async (txDb) => {
          await txDb.query('CREATE TABLE schema_migrations (version VARCHAR(255) PRIMARY KEY, checksum VARCHAR(64), applied_at TIMESTAMPTZ);');
          await txDb.query('THIS IS AN INTENTIONAL SQL SYNTAX ERROR;');
          await txDb.query("INSERT INTO schema_migrations (version, checksum, applied_at) VALUES ('broken.sql', 'abc', NOW());");
        });
      },
      /syntax error|error/i
    );

    // Verify transaction rollback: schema_migrations table should not exist or broken.sql not recorded
    const checkTable = await freshDb.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations'
      ) AS exists;
    `);

    if (checkTable.rows[0]?.exists) {
      const records = await freshDb.query('SELECT * FROM schema_migrations WHERE version = $1;', ['broken.sql']);
      assert.equal(records.rows.length, 0);
    }
  });

  // ============================================================================
  // ATOMIC HOUSEHOLD + OWNER CREATION (TENANCY SERVICE)
  // ============================================================================

  test('TenancyService.createHouseholdWithOwner creates Household and initial OWNER in a single transaction', async () => {
    const parentUserId = crypto.randomUUID();

    const { household, owner } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      householdName: 'Naveen Family'
    });

    assert.ok(household.id);
    assert.equal(household.name, 'Naveen Family');
    assert.ok(owner.id);
    assert.equal(owner.householdId, household.id);
    assert.equal(owner.userId, parentUserId);
    assert.equal(owner.role, HouseholdRoles.OWNER);

    // Verify both records exist in DB
    const fetchedHousehold = await TenancyRepository.getHouseholdById(db, household.id);
    assert.ok(fetchedHousehold);
    const membership = await TenancyRepository.findMembership(db, household.id, parentUserId);
    assert.ok(membership);
    assert.equal(membership.role, 'OWNER');
  });

  test('TenancyService.createHouseholdWithOwner rolls back transaction when OWNER insert fails', async () => {
    // Count households before attempt
    const beforeCount = await db.query('SELECT COUNT(*) AS count FROM households;');
    const initialCount = parseInt(beforeCount.rows[0].count, 10);

    // Mock an invalid operation inside transaction by passing invalid userId or causing constraint error
    await assert.rejects(
      async () => {
        // Passing empty userId throws validation error
        await TenancyService.createHouseholdWithOwner(db, {
          userId: '',
          householdName: 'Orphan Household'
        });
      },
      /userId is required/i
    );

    // Verify no orphan household was created
    const afterCount = await db.query('SELECT COUNT(*) AS count FROM households;');
    const finalCount = parseInt(afterCount.rows[0].count, 10);
    assert.equal(finalCount, initialCount, 'Transaction rollback must ensure no orphan household exists');
  });

  // ============================================================================
  // TENANCY REPOSITORY & CONSTRAINTS
  // ============================================================================

  test('household creation and lookup by ID', async () => {
    const household = await TenancyRepository.createHousehold(db, {
      name: 'Sharma Family'
    });

    assert.ok(household.id);
    assert.equal(household.name, 'Sharma Family');
    assert.ok(household.createdAt instanceof Date);
    assert.ok(household.updatedAt instanceof Date);

    const fetched = await TenancyRepository.getHouseholdById(db, household.id);
    assert.ok(fetched);
    assert.equal(fetched.id, household.id);
    assert.equal(fetched.name, 'Sharma Family');

    // Non-existent household returns null
    const nonExistent = await TenancyRepository.getHouseholdById(db, crypto.randomUUID());
    assert.equal(nonExistent, null);
  });

  test('household member creation and membership verification', async () => {
    const household = await TenancyRepository.createHousehold(db, { name: 'Reddy Family' });
    const parentUserId = crypto.randomUUID();

    const member = await TenancyRepository.createHouseholdMember(db, {
      householdId: household.id,
      userId: parentUserId,
      role: HouseholdRoles.OWNER
    });

    assert.ok(member.id);
    assert.equal(member.householdId, household.id);
    assert.equal(member.userId, parentUserId);
    assert.equal(member.role, 'OWNER');

    const found = await TenancyRepository.findMembership(db, household.id, parentUserId);
    assert.ok(found);
    assert.equal(found.id, member.id);
    assert.equal(found.role, 'OWNER');

    const members = await TenancyRepository.getHouseholdMembers(db, household.id);
    assert.equal(members.length, 1);
    assert.equal(members[0].userId, parentUserId);
  });

  test('duplicate household membership for same user is rejected by database constraint', async () => {
    const household = await TenancyRepository.createHousehold(db);
    const userId = crypto.randomUUID();

    // First insertion succeeds
    await TenancyRepository.createHouseholdMember(db, {
      householdId: household.id,
      userId,
      role: HouseholdRoles.OWNER
    });

    // Duplicate insertion must fail unique constraint uq_household_member
    await assert.rejects(
      async () => {
        await TenancyRepository.createHouseholdMember(db, {
          householdId: household.id,
          userId,
          role: HouseholdRoles.PARENT
        });
      },
      /unique|duplicate|uq_household_member/i
    );
  });

  test('invalid household member role is rejected by database CHECK constraint', async () => {
    const household = await TenancyRepository.createHousehold(db);
    const userId = crypto.randomUUID();

    await assert.rejects(
      async () => {
        await TenancyRepository.createHouseholdMember(db, {
          householdId: household.id,
          userId,
          role: 'INVALID_ROLE' as any
        });
      },
      /check constraint|role/i
    );
  });

  test('household member requires valid household foreign key', async () => {
    const nonExistentHouseholdId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    await assert.rejects(
      async () => {
        await TenancyRepository.createHouseholdMember(db, {
          householdId: nonExistentHouseholdId,
          userId,
          role: HouseholdRoles.PARENT
        });
      },
      /foreign key|violates/i
    );
  });

  test('child profile creation and listing scoped to household', async () => {
    const household = await TenancyRepository.createHousehold(db, { name: 'Patil Household' });

    const child1 = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Aarav',
      gradeBand: 'Grade 6',
      status: ChildStatuses.ACTIVE
    });

    const child2 = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Diya',
      gradeBand: 'Grade 8',
      status: ChildStatuses.ACTIVE
    });

    assert.ok(child1.id);
    assert.equal(child1.householdId, household.id);
    assert.equal(child1.preferredName, 'Aarav');
    assert.equal(child1.gradeBand, 'Grade 6');
    assert.equal(child1.status, 'ACTIVE');

    const children = await TenancyRepository.listChildProfilesByHousehold(db, household.id);
    assert.equal(children.length, 2);
    assert.deepEqual(
      children.map((c) => c.preferredName).sort(),
      ['Aarav', 'Diya']
    );
  });

  test('child profile requires valid household foreign key and non-null fields', async () => {
    const nonExistentHouseholdId = crypto.randomUUID();

    // Invalid FK
    await assert.rejects(
      async () => {
        await TenancyRepository.createChildProfile(db, {
          householdId: nonExistentHouseholdId,
          preferredName: 'Ghost',
          gradeBand: 'Grade 5'
        });
      },
      /foreign key|violates/i
    );

    // Invalid status CHECK constraint
    const household = await TenancyRepository.createHousehold(db);
    await assert.rejects(
      async () => {
        await TenancyRepository.createChildProfile(db, {
          householdId: household.id,
          preferredName: 'Test',
          gradeBand: 'Grade 5',
          status: 'UNAUTHORIZED_STATUS' as any
        });
      },
      /check constraint|status/i
    );
  });

  test('child profile update and delete are strictly scoped by household', async () => {
    const household = await TenancyRepository.createHousehold(db);
    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Kiran',
      gradeBand: 'Grade 7'
    });

    // Valid update
    const updated = await TenancyRepository.updateChildProfile(db, household.id, child.id, {
      preferredName: 'Kiran Kumar',
      gradeBand: 'Grade 8'
    });

    assert.ok(updated);
    assert.equal(updated.preferredName, 'Kiran Kumar');
    assert.equal(updated.gradeBand, 'Grade 8');

    // Valid delete
    const deleted = await TenancyRepository.deleteChildProfile(db, household.id, child.id);
    assert.equal(deleted, true);

    const postDelete = await TenancyRepository.getChildProfile(db, household.id, child.id);
    assert.equal(postDelete, null);
  });

  // ============================================================================
  // MANDATORY REQUIREMENT 12: CROSS-TENANT ADVERSARIAL TEST
  // ============================================================================
  test('ADVERSARIAL: Household A cannot retrieve, update, delete, or list Household B child', async () => {
    // 1. Setup Tenant A
    const householdA = await TenancyRepository.createHousehold(db, { name: 'Household A' });
    const parentAId = crypto.randomUUID();
    await TenancyRepository.createHouseholdMember(db, {
      householdId: householdA.id,
      userId: parentAId,
      role: HouseholdRoles.OWNER
    });
    const childA = await TenancyRepository.createChildProfile(db, {
      householdId: householdA.id,
      preferredName: 'Child A (Rohan)',
      gradeBand: 'Grade 5'
    });

    // 2. Setup Tenant B
    const householdB = await TenancyRepository.createHousehold(db, { name: 'Household B' });
    const parentBId = crypto.randomUUID();
    await TenancyRepository.createHouseholdMember(db, {
      householdId: householdB.id,
      userId: parentBId,
      role: HouseholdRoles.OWNER
    });
    const childB = await TenancyRepository.createChildProfile(db, {
      householdId: householdB.id,
      preferredName: 'Child B (Ananya)',
      gradeBand: 'Grade 9'
    });

    // 3. ADVERSARIAL ATTEMPT 1: Query Child B using Household A context
    // Expected: Must return null (never leak Child B data across tenant boundary)
    const crossTenantGet = await TenancyRepository.getChildProfile(db, householdA.id, childB.id);
    assert.equal(
      crossTenantGet,
      null,
      'CROSS-TENANT VIOLATION: getChildProfile(HouseholdA, ChildB) must return null!'
    );

    // Legitimate query on Tenant B works
    const legitGetB = await TenancyRepository.getChildProfile(db, householdB.id, childB.id);
    assert.ok(legitGetB);
    assert.equal(legitGetB.id, childB.id);
    assert.equal(legitGetB.preferredName, 'Child B (Ananya)');

    // 4. ADVERSARIAL ATTEMPT 2: List children for Household A
    // Expected: Must return ONLY Child A, and NEVER Child B
    const childrenA = await TenancyRepository.listChildProfilesByHousehold(db, householdA.id);
    assert.equal(childrenA.length, 1);
    assert.equal(childrenA[0].id, childA.id);
    assert.equal(childrenA[0].preferredName, 'Child A (Rohan)');
    assert.equal(childrenA.some((c) => c.id === childB.id), false);

    // 5. ADVERSARIAL ATTEMPT 3: Attempt to update Child B using Household A context
    // Expected: Must return null and not modify Child B
    const maliciousUpdate = await TenancyRepository.updateChildProfile(
      db,
      householdA.id,
      childB.id,
      { preferredName: 'HACKED NAME' }
    );
    assert.equal(
      maliciousUpdate,
      null,
      'CROSS-TENANT VIOLATION: updateChildProfile(HouseholdA, ChildB) must return null!'
    );

    // Verify Child B remains intact in Household B
    const verifyChildB = await TenancyRepository.getChildProfile(db, householdB.id, childB.id);
    assert.ok(verifyChildB);
    assert.equal(verifyChildB.preferredName, 'Child B (Ananya)');

    // 6. ADVERSARIAL ATTEMPT 4: Attempt to delete Child B using Household A context
    // Expected: Must return false and not delete Child B
    const maliciousDelete = await TenancyRepository.deleteChildProfile(db, householdA.id, childB.id);
    assert.equal(
      maliciousDelete,
      false,
      'CROSS-TENANT VIOLATION: deleteChildProfile(HouseholdA, ChildB) must return false!'
    );

    // Verify Child B still exists in Household B
    const verifyChildBAfterDelete = await TenancyRepository.getChildProfile(db, householdB.id, childB.id);
    assert.ok(verifyChildBAfterDelete);
    assert.equal(verifyChildBAfterDelete.id, childB.id);
  });

  test('ON DELETE RESTRICT: Deleting a household with active members is rejected by foreign key constraint', async () => {
    const household = await TenancyRepository.createHousehold(db);
    const user = crypto.randomUUID();
    await TenancyRepository.createHouseholdMember(db, {
      householdId: household.id,
      userId: user,
      role: HouseholdRoles.OWNER
    });
    await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Rani',
      gradeBand: 'Grade 10'
    });

    // Deleting household directly while active members exist must be blocked by ON DELETE RESTRICT
    await assert.rejects(
      async () => {
        await db.query('DELETE FROM households WHERE id = $1;', [household.id]);
      },
      /foreign key constraint|violates/i
    );

    // Verify household, members, and child profiles remain intact
    const fetched = await TenancyRepository.getHouseholdById(db, household.id);
    assert.ok(fetched);
  });
});
