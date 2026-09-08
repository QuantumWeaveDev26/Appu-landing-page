import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';

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

  memDb.public.registerFunction({
    name: 'hashtext',
    args: [memDb.public.getType('text')],
    returns: memDb.public.getType('int'),
    impure: false,
    implementation: (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    }
  });

  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  // RLS-strip wrapper for pg-mem compatibility with migration 012
  const cleanQuery = (text: string, params?: any[]) => {
    let t = text;
    if (t.includes('ENABLE ROW LEVEL SECURITY') || t.includes('enable row level security')) {
      t = t.replace(/ALTER TABLE[^\n;]+ENABLE ROW LEVEL SECURITY;?/gi, '');
    }
    return pool.query(t, params);
  };

  const db: TransactionalQueryable = {
    async query<T = any>(sql: string, params: any[] = []) {
      const res = await cleanQuery(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount
      };
    },

    async transaction<T>(work: (client: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const transactionDb: Queryable = {
        async query<TResult = any>(queryText: string, values: any[] = []) {
          const res = await cleanQuery(queryText, values);
          return {
            rows: res.rows as TResult[],
            rowCount: res.rowCount
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

describe('TenancyRepository.findHouseholdByParentPhone (WhatsApp Context Task 1)', () => {
  let db: TransactionalQueryable;
  let householdId: string;
  const userId = crypto.randomUUID();

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const created = await TenancyService.createHouseholdWithOwner(db, {
      userId,
      householdName: 'Sharma Household'
    });
    householdId = created.household.id;
  });

  test('returns household with consent details when phone matches E.164 and whatsapp_consent=true', async () => {
    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    const result = await (TenancyRepository as any).findHouseholdByParentPhone(db, '+919876543210');

    assert.ok(result, 'Expected household to be found');
    assert.equal(result.id, householdId);
    assert.equal(result.name, 'Sharma Household');
    assert.equal(result.parentPhone, '+919876543210');
    assert.equal(result.whatsappConsent, true);
    assert.ok(result.whatsappConsentAt instanceof Date);
    assert.ok(result.createdAt instanceof Date);
    assert.ok(result.updatedAt instanceof Date);
  });

  test('normalizes 10-digit Indian numbers and finds matching household with consent', async () => {
    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    // Query with 10-digit without country code
    const result = await (TenancyRepository as any).findHouseholdByParentPhone(db, '9876543210');

    assert.ok(result, 'Expected household to be resolved by 10-digit Indian phone');
    assert.equal(result.id, householdId);
    assert.equal(result.parentPhone, '+919876543210');
    assert.equal(result.whatsappConsent, true);
  });

  test('normalizes 12-digit Indian numbers without + (Meta format) and finds matching household', async () => {
    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    // Query with digits-only 919876543210 from Meta webhook
    const result = await (TenancyRepository as any).findHouseholdByParentPhone(db, '919876543210');

    assert.ok(result, 'Expected household to be resolved by 12-digit Meta format phone');
    assert.equal(result.id, householdId);
    assert.equal(result.parentPhone, '+919876543210');
    assert.equal(result.whatsappConsent, true);
  });

  test('returns null when phone matches but whatsapp_consent is false', async () => {
    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    // Revoke consent
    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      whatsappConsent: false
    });

    const result = await (TenancyRepository as any).findHouseholdByParentPhone(db, '+919876543210');
    assert.equal(result, null, 'Expected null when whatsapp_consent is false');
  });

  test('returns null when phone number does not exist in database', async () => {
    const result = await (TenancyRepository as any).findHouseholdByParentPhone(db, '+919999999999');
    assert.equal(result, null, 'Expected null for non-existent phone');
  });

  test('returns null gracefully on invalid, empty, or garbage phone input without throwing', async () => {
    const invalidInputs = ['', '   ', '123', 'invalid-phone', null as any, undefined as any];

    for (const input of invalidInputs) {
      const result = await (TenancyRepository as any).findHouseholdByParentPhone(db, input);
      assert.equal(result, null, `Expected null for input: "${input}"`);
    }
  });
});
