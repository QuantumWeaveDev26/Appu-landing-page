import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import {
  FamilyFeedbackRepository,
  FamilyFeedbackService
} from '../src/domain/feedback/index.js';

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
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  };

  return db;
}

describe('Family Feedback Domain (Migration 019, Repository & Service)', () => {
  let db: TransactionalQueryable;
  let householdId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const household = await TenancyRepository.createHousehold(db, 'Kapoor Family');
    householdId = household.id;
  });

  test('hasFamilyFeedback returns false initially, then true after submission', async () => {
    const before = await FamilyFeedbackService.hasFamilyFeedback(db, householdId);
    assert.equal(before, false);

    const statusBefore = await FamilyFeedbackService.getStatus(db, householdId);
    assert.equal(statusBefore.submitted, false);
    assert.equal(statusBefore.reportsUnlocked, false);
    assert.equal(statusBefore.feedback, null);

    const submitted = await FamilyFeedbackService.saveFeedback(db, householdId, {
      rating: 5,
      whatsWorking: 'My son loves the interactive math dialogues.',
      whatsToImprove: 'Add more practice quizzes after each lesson.'
    });

    assert.equal(submitted.reportsUnlocked, true);
    assert.equal(submitted.feedback.rating, 5);
    assert.equal(submitted.feedback.householdId, householdId);
    assert.ok(submitted.feedback.createdAt);

    const after = await FamilyFeedbackService.hasFamilyFeedback(db, householdId);
    assert.equal(after, true);

    const statusAfter = await FamilyFeedbackService.getStatus(db, householdId);
    assert.equal(statusAfter.submitted, true);
    assert.equal(statusAfter.reportsUnlocked, true);
    assert.equal(statusAfter.feedback?.rating, 5);
    assert.equal(statusAfter.feedback?.whatsWorking, 'My son loves the interactive math dialogues.');
  });

  test('latest submission wins for household feedback', async () => {
    await FamilyFeedbackService.saveFeedback(db, householdId, {
      rating: 3,
      whatsWorking: 'Initial thoughts',
      whatsToImprove: 'Need more quizzes'
    });

    await FamilyFeedbackService.saveFeedback(db, householdId, {
      rating: 4,
      whatsWorking: 'Updated thoughts after two weeks',
      whatsToImprove: 'More science explanations'
    });

    const status = await FamilyFeedbackService.getStatus(db, householdId);
    assert.equal(status.submitted, true);
    assert.equal(status.feedback?.rating, 4);
    assert.equal(status.feedback?.whatsWorking, 'Updated thoughts after two weeks');
    assert.equal(status.feedback?.whatsToImprove, 'More science explanations');
  });

  test('rejects invalid rating values', async () => {
    await assert.rejects(
      async () => {
        await FamilyFeedbackService.saveFeedback(db, householdId, {
          rating: 0,
          whatsWorking: 'Good',
          whatsToImprove: 'Quizzes'
        });
      },
      /Rating must be an integer between 1 and 5/
    );

    await assert.rejects(
      async () => {
        await FamilyFeedbackService.saveFeedback(db, householdId, {
          rating: 6,
          whatsWorking: 'Good',
          whatsToImprove: 'Quizzes'
        });
      },
      /Rating must be an integer between 1 and 5/
    );

    await assert.rejects(
      async () => {
        await FamilyFeedbackService.saveFeedback(db, householdId, {
          rating: 3.5 as any,
          whatsWorking: 'Good',
          whatsToImprove: 'Quizzes'
        });
      },
      /Rating must be an integer between 1 and 5/
    );
  });

  test('rejects empty whatsWorking or whatsToImprove', async () => {
    await assert.rejects(
      async () => {
        await FamilyFeedbackService.saveFeedback(db, householdId, {
          rating: 5,
          whatsWorking: '',
          whatsToImprove: 'Quizzes'
        });
      },
      /What's working field cannot be empty/
    );

    await assert.rejects(
      async () => {
        await FamilyFeedbackService.saveFeedback(db, householdId, {
          rating: 5,
          whatsWorking: '   ',
          whatsToImprove: 'Quizzes'
        });
      },
      /What's working field cannot be empty/
    );

    await assert.rejects(
      async () => {
        await FamilyFeedbackService.saveFeedback(db, householdId, {
          rating: 5,
          whatsWorking: 'Good explanations',
          whatsToImprove: ''
        });
      },
      /What's to improve field cannot be empty/
    );

    await assert.rejects(
      async () => {
        await FamilyFeedbackService.saveFeedback(db, householdId, {
          rating: 5,
          whatsWorking: 'Good explanations',
          whatsToImprove: '   '
        });
      },
      /What's to improve field cannot be empty/
    );
  });
});
