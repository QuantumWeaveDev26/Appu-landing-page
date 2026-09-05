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

describe('Household WhatsApp Preferences Domain (Task 1)', () => {
  let db: TransactionalQueryable;
  let householdId: string;
  const userId = crypto.randomUUID();

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const created = await TenancyService.createHouseholdWithOwner(db, {
      userId,
      householdName: 'Test Family'
    });
    householdId = created.household.id;
  });

  test('Migration 015 applies cleanly and initial preferences default to null phone and false consent', async () => {
    const prefs = await TenancyRepository.getNotificationPreferences(db, householdId);
    assert.deepEqual(prefs, {
      parentPhone: null,
      whatsappConsent: false,
      whatsappConsentAt: null
    });
  });

  test('updateNotificationPreferences stores valid E.164 phone and sets whatsappConsent=true with timestamp', async () => {
    const updated = await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    assert.equal(updated.parentPhone, '+919876543210');
    assert.equal(updated.whatsappConsent, true);
    assert.ok(updated.whatsappConsentAt instanceof Date);

    const fetched = await TenancyRepository.getNotificationPreferences(db, householdId);
    assert.equal(fetched.parentPhone, '+919876543210');
    assert.equal(fetched.whatsappConsent, true);
    assert.ok(fetched.whatsappConsentAt instanceof Date);
  });

  test('updateNotificationPreferences normalizes Indian 10-digit number to +91 E.164', async () => {
    const updated = await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '9876543210',
      whatsappConsent: true
    });

    assert.equal(updated.parentPhone, '+919876543210');
    assert.equal(updated.whatsappConsent, true);
  });

  test('updateNotificationPreferences revoking consent sets whatsappConsent=false and clears whatsappConsentAt', async () => {
    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    const revoked = await TenancyRepository.updateNotificationPreferences(db, householdId, {
      whatsappConsent: false
    });

    assert.equal(revoked.parentPhone, '+919876543210');
    assert.equal(revoked.whatsappConsent, false);
    assert.equal(revoked.whatsappConsentAt, null);

    const fetched = await TenancyRepository.getNotificationPreferences(db, householdId);
    assert.equal(fetched.whatsappConsent, false);
    assert.equal(fetched.whatsappConsentAt, null);
  });

  test('updateNotificationPreferences rejects invalid phone number format', async () => {
    await assert.rejects(
      async () => {
        await TenancyRepository.updateNotificationPreferences(db, householdId, {
          parentPhone: '12345',
          whatsappConsent: true
        });
      },
      /Invalid phone number format/
    );
  });

  test('updateNotificationPreferences rejects whatsappConsent=true when parentPhone is missing or empty', async () => {
    await assert.rejects(
      async () => {
        await TenancyRepository.updateNotificationPreferences(db, householdId, {
          parentPhone: '',
          whatsappConsent: true
        });
      },
      /Parent phone number is required when granting WhatsApp consent/
    );
  });
});
