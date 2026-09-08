import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { MentorContextBuilder } from '../src/domain/personalisation/mentor-context-builder.js';

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

describe('MentorContext Nickname Integration (Phase-B Task 2)', () => {
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

  test('buildFromResolved sets learnerName to trimmed nickname when provided', () => {
    const child = {
      id: crypto.randomUUID(),
      preferredName: 'Shreedhar',
      gradeBand: 'Grade 10',
      nickname: 'Shree',
      dob: '2010-08-20'
    };

    const context = MentorContextBuilder.buildFromResolved(child as any, null, null);
    assert.equal(context.learnerName, 'Shree');
    assert.equal(context.learnerId, child.id);
  });

  test('buildFromResolved trims nickname containing whitespace', () => {
    const child = {
      id: crypto.randomUUID(),
      preferredName: 'Alexander',
      gradeBand: 'Grade 6',
      nickname: '  Alex  ',
      dob: '2014-05-12'
    };

    const context = MentorContextBuilder.buildFromResolved(child as any, null, null);
    assert.equal(context.learnerName, 'Alex');
  });

  test('buildFromResolved falls back to preferredName when nickname is null or undefined', () => {
    const child1 = {
      id: crypto.randomUUID(),
      preferredName: 'Aarav',
      gradeBand: 'Grade 7',
      nickname: null,
      dob: null
    };
    const context1 = MentorContextBuilder.buildFromResolved(child1 as any, null, null);
    assert.equal(context1.learnerName, 'Aarav');

    const child2 = {
      id: crypto.randomUUID(),
      preferredName: 'Ananya',
      gradeBand: 'Grade 8'
    };
    const context2 = MentorContextBuilder.buildFromResolved(child2, null, null);
    assert.equal(context2.learnerName, 'Ananya');
  });

  test('buildFromResolved falls back to preferredName when nickname is whitespace-only', () => {
    const child = {
      id: crypto.randomUUID(),
      preferredName: 'Rohan',
      gradeBand: 'Grade 5',
      nickname: '    ',
      dob: null
    };

    const context = MentorContextBuilder.buildFromResolved(child as any, null, null);
    assert.equal(context.learnerName, 'Rohan');
  });

  test('buildMentorContext loads child with nickname from database and sets learnerName to nickname', async () => {
    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Manjunath',
      gradeBand: 'Grade 9',
      nickname: 'Manu',
      dob: '2011-04-10'
    });

    const context = await MentorContextBuilder.buildMentorContext(db, householdId, child.id, null);
    assert.ok(context);
    assert.equal(context.mode, 'authenticated');
    assert.equal(context.learnerName, 'Manu');
    assert.equal(context.grade, 'Grade 9');
  });
});
