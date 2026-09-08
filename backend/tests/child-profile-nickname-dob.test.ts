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

describe('Child Profile Nickname & DOB Domain (Phase-B Task 1)', () => {
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

  test('createChildProfile stores and returns nickname and dob when provided', async () => {
    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Alexander',
      gradeBand: 'Grade 6',
      nickname: 'Alex',
      dob: '2014-05-12'
    });

    assert.ok(child.id);
    assert.equal(child.preferredName, 'Alexander');
    assert.equal(child.gradeBand, 'Grade 6');
    assert.equal(child.nickname, 'Alex');
    assert.equal(child.dob, '2014-05-12');
  });

  test('createChildProfile defaults nickname and dob to null when omitted', async () => {
    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Aarav',
      gradeBand: 'Grade 7'
    });

    assert.ok(child.id);
    assert.equal(child.preferredName, 'Aarav');
    assert.equal(child.nickname, null);
    assert.equal(child.dob, null);
  });

  test('updateChildProfile updates nickname and dob', async () => {
    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Shreedhar',
      gradeBand: 'Grade 10'
    });

    assert.equal(child.nickname, null);
    assert.equal(child.dob, null);

    const updated = await TenancyRepository.updateChildProfile(db, householdId, child.id, {
      nickname: 'Shree',
      dob: '2010-08-20'
    });

    assert.ok(updated);
    assert.equal(updated.id, child.id);
    assert.equal(updated.preferredName, 'Shreedhar');
    assert.equal(updated.nickname, 'Shree');
    assert.equal(updated.dob, '2010-08-20');
  });

  test('updateChildProfile allows setting nickname and dob to null', async () => {
    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Aishu',
      gradeBand: 'Grade 6',
      nickname: 'Aishu Baby',
      dob: '2014-03-25'
    });

    assert.equal(child.nickname, 'Aishu Baby');
    assert.equal(child.dob, '2014-03-25');

    const updated = await TenancyRepository.updateChildProfile(db, householdId, child.id, {
      nickname: null,
      dob: null
    });

    assert.ok(updated);
    assert.equal(updated.nickname, null);
    assert.equal(updated.dob, null);
  });

  test('getChildProfile and listChildProfilesByHousehold retrieve nickname and dob', async () => {
    const child1 = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Kavya',
      gradeBand: 'Grade 8',
      nickname: 'Kavi',
      dob: '2012-11-05'
    });

    const child2 = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Rohan',
      gradeBand: 'Grade 5'
    });

    const fetched1 = await TenancyRepository.getChildProfile(db, householdId, child1.id);
    assert.ok(fetched1);
    assert.equal(fetched1.nickname, 'Kavi');
    assert.equal(fetched1.dob, '2012-11-05');

    const fetched2 = await TenancyRepository.getChildProfile(db, householdId, child2.id);
    assert.ok(fetched2);
    assert.equal(fetched2.nickname, null);
    assert.equal(fetched2.dob, null);

    const list = await TenancyRepository.listChildProfilesByHousehold(db, householdId);
    assert.equal(list.length, 2);
    const listed1 = list.find((c) => c.id === child1.id);
    const listed2 = list.find((c) => c.id === child2.id);
    assert.equal(listed1?.nickname, 'Kavi');
    assert.equal(listed1?.dob, '2012-11-05');
    assert.equal(listed2?.nickname, null);
    assert.equal(listed2?.dob, null);
  });
});
