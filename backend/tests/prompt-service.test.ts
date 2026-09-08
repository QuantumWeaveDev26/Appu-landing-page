import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { PersonalisationRepository } from '../src/domain/personalisation/repository.js';
import { PromptService } from '../src/domain/prompts/prompt-service.js';
import { PromptsRepository } from '../src/domain/prompts/repository.js';
import type { PromptCategory } from '../src/domain/prompts/types.js';

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

describe('Prompt Generation Engine & Service (Phase-C Task 2)', () => {
  let db: TransactionalQueryable;
  let householdId: string;
  let childId: string;
  const userId = crypto.randomUUID();

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const created = await TenancyService.createHouseholdWithOwner(db, {
      userId,
      householdName: 'Mehta Household'
    });
    householdId = created.household.id;

    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Rohan',
      gradeBand: 'Grade 6',
      nickname: 'Rohi',
      dob: '2014-06-15'
    });
    childId = child.id;

    await PersonalisationRepository.upsertPersonalisation(db, householdId, childId, {
      favoriteSubjects: ['Mathematics', 'Science'],
      interests: ['Astronomy', 'Robotics']
    });
  });

  test('Case 1: Generates 12-16 prompts distributed evenly across 4 categories', () => {
    const child = {
      id: childId,
      householdId,
      preferredName: 'Rohan',
      gradeBand: 'Grade 6',
      status: 'ACTIVE' as const,
      nickname: 'Rohi',
      dob: '2014-06-15',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const personalisation = {
      id: crypto.randomUUID(),
      householdId,
      childId,
      preferredLanguage: 'en',
      favoriteColor: null,
      fontPreference: 'friendly' as const,
      learningStyle: 'visual' as const,
      interests: ['Astronomy', 'Robotics'],
      favoriteSubjects: ['Mathematics', 'Science'],
      goals: [],
      responseStyle: 'playful' as const,
      voicePreference: 'default',
      themePreference: 'auto' as const,
      additionalContext: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const prompts = PromptService.generatePrompts(child, personalisation);

    assert.ok(prompts.length >= 12 && prompts.length <= 16, `Expected 12-16 prompts, got ${prompts.length}`);

    const expectedCategories: PromptCategory[] = [
      'quick_concepts',
      'homework_hints',
      'curious_mind',
      'exam_drills'
    ];

    for (const cat of expectedCategories) {
      const count = prompts.filter((p) => p.category === cat).length;
      assert.ok(count >= 3 && count <= 4, `Category ${cat} should have 3 or 4 prompts, got ${count}`);
    }

    // Every prompt should have non-empty promptText and icon
    for (const p of prompts) {
      assert.ok(p.promptText.trim().length > 0);
      assert.ok(p.icon.startsWith('fa-'));
    }
  });

  test('Case 2: Adapts prompts to child\'s grade band (Grade 5-7 vs Grade 8-10 vs Grade 11-12)', () => {
    const baseProfile = {
      id: childId,
      householdId,
      preferredName: 'Aarav',
      status: 'ACTIVE' as const,
      nickname: null,
      dob: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const promptsMiddle = PromptService.generatePrompts({ ...baseProfile, gradeBand: 'Grade 6' }, null);
    const promptsSecondary = PromptService.generatePrompts({ ...baseProfile, gradeBand: 'Grade 9' }, null);
    const promptsSenior = PromptService.generatePrompts({ ...baseProfile, gradeBand: 'Grade 12' }, null);

    assert.equal(promptsMiddle.length, 16);
    assert.equal(promptsSecondary.length, 16);
    assert.equal(promptsSenior.length, 16);

    // Ensure prompt texts differ across grade tiers
    const middleTexts = promptsMiddle.map((p) => p.promptText);
    const seniorTexts = promptsSenior.map((p) => p.promptText);
    assert.notDeepEqual(middleTexts, seniorTexts);
  });

  test('Case 3: Injects child\'s actual favorite subjects and interests into prompt slots', () => {
    const child = {
      id: childId,
      householdId,
      preferredName: 'Ananya',
      gradeBand: 'Grade 7',
      status: 'ACTIVE' as const,
      nickname: null,
      dob: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const personalisation = {
      id: crypto.randomUUID(),
      householdId,
      childId,
      preferredLanguage: 'en',
      favoriteColor: null,
      fontPreference: 'friendly' as const,
      learningStyle: 'visual' as const,
      interests: ['Marine Biology', 'Origami'],
      favoriteSubjects: ['Zoology', 'Geography'],
      goals: [],
      responseStyle: 'playful' as const,
      voicePreference: 'default',
      themePreference: 'auto' as const,
      additionalContext: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const prompts = PromptService.generatePrompts(child, personalisation);
    const allText = prompts.map((p) => p.promptText).join(' ');

    assert.ok(
      allText.includes('Zoology') || allText.includes('Geography'),
      'Expected favorite subjects to be injected into prompts'
    );
    assert.ok(
      allText.includes('Marine Biology') || allText.includes('Origami'),
      'Expected interests to be injected into prompts'
    );
  });

  test('Case 4: Falls back gracefully to sensible defaults when subjects or interests are empty', () => {
    const child = {
      id: childId,
      householdId,
      preferredName: 'Vikram',
      gradeBand: 'Grade 8',
      status: 'ACTIVE' as const,
      nickname: null,
      dob: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const prompts = PromptService.generatePrompts(child, null);

    assert.equal(prompts.length, 16);
    for (const p of prompts) {
      assert.ok(!p.promptText.includes('{subject}'), 'Placeholder {subject} should not be present');
      assert.ok(!p.promptText.includes('{interest}'), 'Placeholder {interest} should not be present');
      assert.ok(!p.promptText.includes('{name}'), 'Placeholder {name} should not be present');
      assert.ok(!p.promptText.includes('{grade}'), 'Placeholder {grade} should not be present');
    }

    const allText = prompts.map((p) => p.promptText).join(' ');
    assert.ok(allText.includes('Science') || allText.includes('Mathematics'));
    assert.ok(allText.includes('Space') || allText.includes('Technology'));
  });

  test('Case 5: Injects child\'s preferred name or nickname when template supports addressing', () => {
    const childWithNick = {
      id: childId,
      householdId,
      preferredName: 'Devika',
      gradeBand: 'Grade 6',
      status: 'ACTIVE' as const,
      nickname: 'Devi',
      dob: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const prompts = PromptService.generatePrompts(childWithNick, null);
    const allText = prompts.map((p) => p.promptText).join(' ');
    assert.ok(allText.includes('Devi'), 'Expected nickname Devi to be injected');

    const childWithoutNick = {
      ...childWithNick,
      nickname: null
    };
    const promptsNoNick = PromptService.generatePrompts(childWithoutNick, null);
    const allTextNoNick = promptsNoNick.map((p) => p.promptText).join(' ');
    assert.ok(allTextNoNick.includes('Devika'), 'Expected preferredName Devika to be injected when nickname is null');
  });

  test('Case 6: getOrGeneratePrompts returns existing prompts if present, or generates and persists if empty', async () => {
    // 1. Initial call: empty in DB -> generates and saves
    const initial = await PromptService.getOrGeneratePrompts(db, householdId, childId);
    assert.equal(initial.length, 16);
    assert.equal(initial[0].householdId, householdId);
    assert.equal(initial[0].childId, childId);

    // Verify persisted in DB
    const inDb = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    assert.equal(inDb.length, 16);

    // 2. Second call: already in DB -> returns existing without regenerating
    const cached = await PromptService.getOrGeneratePrompts(db, householdId, childId);
    assert.equal(cached.length, 16);
    assert.equal(cached[0].id, initial[0].id);
    assert.equal(cached[0].createdAt.getTime(), initial[0].createdAt.getTime());
  });

  test('Case 7: regeneratePrompts replaces existing prompts with fresh seed', async () => {
    // Initial population
    const initial = await PromptService.getOrGeneratePrompts(db, householdId, childId);
    assert.equal(initial.length, 16);

    // Regenerate
    const regenerated = await PromptService.regeneratePrompts(db, householdId, childId);
    assert.equal(regenerated.length, 16);

    // IDs must be different because previous batch was deleted and replaced
    const initialIds = new Set(initial.map((p) => p.id));
    for (const p of regenerated) {
      assert.ok(!initialIds.has(p.id), `Expected newly generated ID, found existing ID: ${p.id}`);
    }

    // Verify DB only has 16 items (not 32)
    const inDb = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    assert.equal(inDb.length, 16);
    assert.equal(inDb[0].id, regenerated[0].id);
  });
});
