import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { PromptsRepository } from '../src/domain/prompts/repository.js';
import type { CreatePromptInput } from '../src/domain/prompts/types.js';

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

describe('Prompts Domain Repository (Phase-C Task 1)', () => {
  let db: TransactionalQueryable;
  let householdId: string;
  let childId: string;
  const userId = crypto.randomUUID();

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const created = await TenancyService.createHouseholdWithOwner(db, {
      userId,
      householdName: 'Sharma Household'
    });
    householdId = created.household.id;

    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Aarav',
      gradeBand: 'Grade 6'
    });
    childId = child.id;
  });

  test('Case 1: savePrompts stores prompts with household and child scoping', async () => {
    const inputs: CreatePromptInput[] = [
      {
        category: 'quick_concepts',
        promptText: 'Explain how photosynthesis works in plants.',
        icon: 'fa-lightbulb'
      },
      {
        category: 'homework_hints',
        promptText: 'Give me a hint for solving fraction addition.',
        icon: 'fa-book-open-reader'
      }
    ];

    const saved = await PromptsRepository.savePrompts(db, householdId, childId, inputs);

    assert.equal(saved.length, 2);
    assert.equal(saved[0].householdId, householdId);
    assert.equal(saved[0].childId, childId);
    assert.equal(saved[0].category, 'quick_concepts');
    assert.equal(saved[0].promptText, 'Explain how photosynthesis works in plants.');
    assert.equal(saved[0].icon, 'fa-lightbulb');
    assert.ok(saved[0].id);
    assert.ok(saved[0].createdAt instanceof Date);

    assert.equal(saved[1].category, 'homework_hints');
  });

  test('Case 2: getPromptsByChild retrieves prompts ordered by created_at ASC', async () => {
    const inputs: CreatePromptInput[] = [
      {
        category: 'curious_mind',
        promptText: 'Could humans build a city on Mars?',
        icon: 'fa-rocket'
      },
      {
        category: 'exam_drills',
        promptText: 'Test me on Grade 6 science light and shadows.',
        icon: 'fa-medal'
      }
    ];

    await PromptsRepository.savePrompts(db, householdId, childId, inputs);

    const retrieved = await PromptsRepository.getPromptsByChild(db, householdId, childId);

    assert.equal(retrieved.length, 2);
    assert.equal(retrieved[0].category, 'curious_mind');
    assert.equal(retrieved[0].promptText, 'Could humans build a city on Mars?');
    assert.equal(retrieved[1].category, 'exam_drills');
    assert.equal(retrieved[1].promptText, 'Test me on Grade 6 science light and shadows.');
  });

  test('Case 3: replacePrompts atomically clears prior prompts and stores new batch', async () => {
    const initialBatch: CreatePromptInput[] = [
      {
        category: 'quick_concepts',
        promptText: 'Initial prompt 1',
        icon: 'fa-lightbulb'
      }
    ];
    await PromptsRepository.savePrompts(db, householdId, childId, initialBatch);

    const replacementBatch: CreatePromptInput[] = [
      {
        category: 'homework_hints',
        promptText: 'Replacement prompt A',
        icon: 'fa-calculator'
      },
      {
        category: 'curious_mind',
        promptText: 'Replacement prompt B',
        icon: 'fa-brain'
      }
    ];

    const replaced = await PromptsRepository.replacePrompts(db, householdId, childId, replacementBatch);
    assert.equal(replaced.length, 2);

    const after = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    assert.equal(after.length, 2);
    assert.equal(after[0].promptText, 'Replacement prompt A');
    assert.equal(after[1].promptText, 'Replacement prompt B');
  });

  test('Case 4: Tenant safety: cannot retrieve or overwrite prompts across households', async () => {
    // Create Household B
    const userB = crypto.randomUUID();
    const createdB = await TenancyService.createHouseholdWithOwner(db, {
      userId: userB,
      householdName: 'Verma Household'
    });
    const householdB = createdB.household.id;

    const childBProfile = await TenancyRepository.createChildProfile(db, {
      householdId: householdB,
      preferredName: 'Diya',
      gradeBand: 'Grade 8'
    });
    const childB = childBProfile.id;

    // Save for Household A
    await PromptsRepository.savePrompts(db, householdId, childId, [
      {
        category: 'quick_concepts',
        promptText: 'Household A Prompt',
        icon: 'fa-lightbulb'
      }
    ]);

    // Save for Household B
    await PromptsRepository.savePrompts(db, householdB, childB, [
      {
        category: 'quick_concepts',
        promptText: 'Household B Prompt',
        icon: 'fa-lightbulb'
      }
    ]);

    // Query Household A with Household B credentials -> returns empty
    const crossQuery = await PromptsRepository.getPromptsByChild(db, householdB, childId);
    assert.equal(crossQuery.length, 0);

    // Query Household A -> returns only Household A's prompts
    const aPrompts = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    assert.equal(aPrompts.length, 1);
    assert.equal(aPrompts[0].promptText, 'Household A Prompt');

    // Replace for Household B does NOT delete Household A's prompts
    await PromptsRepository.replacePrompts(db, householdB, childB, [
      {
        category: 'exam_drills',
        promptText: 'Household B New Prompt',
        icon: 'fa-medal'
      }
    ]);

    const aPromptsAfter = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    assert.equal(aPromptsAfter.length, 1);
    assert.equal(aPromptsAfter[0].promptText, 'Household A Prompt');
  });

  test('Case 5: Cascade delete: deleting a child profile cascades to delete their prompts', async () => {
    await PromptsRepository.savePrompts(db, householdId, childId, [
      {
        category: 'quick_concepts',
        promptText: 'Child prompt to be cascaded',
        icon: 'fa-lightbulb'
      }
    ]);

    const before = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    assert.equal(before.length, 1);

    // Delete the child profile directly
    await db.query('DELETE FROM child_profiles WHERE id = $1;', [childId]);

    // Verify prompts were cascaded
    const res = await db.query('SELECT * FROM child_prompts WHERE child_id = $1;', [childId]);
    assert.equal(res.rows.length, 0);
  });
});
