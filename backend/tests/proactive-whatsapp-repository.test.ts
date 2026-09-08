import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { PersonalisationRepository } from '../src/domain/personalisation/repository.js';
import { ConversationRepository } from '../src/domain/conversation/repository.js';
import { ProactiveWhatsAppRepository } from '../src/domain/whatsapp/proactive/repository.js';

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

describe('ProactiveWhatsAppRepository (Task 1)', () => {
  let db: TransactionalQueryable;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);
  });

  describe('findEligibleHouseholds', () => {
    test('returns only households with whatsapp_consent=true, parent_phone NOT null, and child status=ACTIVE', async () => {
      // 1. Eligible household
      const h1 = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Eligible Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h1.household.id, {
        parentPhone: '+919876543210',
        whatsappConsent: true
      });
      const c1 = await TenancyRepository.createChildProfile(db, {
        householdId: h1.household.id,
        preferredName: 'Aryan',
        gradeBand: 'Grade 8'
      });
      await TenancyRepository.updateChildProfile(db, h1.household.id, c1.id, {
        nickname: 'Aru'
      });
      await PersonalisationRepository.upsertPersonalisation(db, h1.household.id, c1.id, {
        favoriteSubjects: ['Mathematics', 'Science'],
        interests: ['Robotics'],
        learningStyle: 'visual',
        fontPreference: 'friendly',
        responseStyle: 'playful',
        themePreference: 'bright',
        preferredLanguage: 'en'
      });

      // 2. Ineligible household: consent=false
      const h2 = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'No Consent Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h2.household.id, {
        parentPhone: '+919876543211',
        whatsappConsent: false
      });
      await TenancyRepository.createChildProfile(db, {
        householdId: h2.household.id,
        preferredName: 'Rohan',
        gradeBand: 'Grade 6'
      });

      // 3. Ineligible household: phone=null
      const h3 = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'No Phone Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h3.household.id, {
        parentPhone: null,
        whatsappConsent: false
      });
      await TenancyRepository.createChildProfile(db, {
        householdId: h3.household.id,
        preferredName: 'Meera',
        gradeBand: 'Grade 7'
      });

      // 4. Ineligible household: child INACTIVE
      const h4 = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Inactive Child Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h4.household.id, {
        parentPhone: '+919876543212',
        whatsappConsent: true
      });
      const c4 = await TenancyRepository.createChildProfile(db, {
        householdId: h4.household.id,
        preferredName: 'Sanjay',
        gradeBand: 'Grade 9'
      });
      await TenancyRepository.updateChildProfile(db, h4.household.id, c4.id, {
        status: 'INACTIVE'
      });

      const targets = await ProactiveWhatsAppRepository.findEligibleHouseholds(db);
      assert.equal(targets.length, 1);
      assert.equal(targets[0].householdId, h1.household.id);
      assert.equal(targets[0].childId, c1.id);
      assert.equal(targets[0].parentPhone, '+919876543210');
      assert.equal(targets[0].preferredName, 'Aryan');
      assert.equal(targets[0].nickname, 'Aru');
      assert.equal(targets[0].effectiveName, 'Aru');
      assert.equal(targets[0].gradeBand, 'Grade 8');
      assert.deepEqual(targets[0].favoriteSubjects, ['Mathematics', 'Science']);
    });
  });

  describe('getWeeklyActivityMetrics', () => {
    test('accurately calculates sessions, question count, and topics for past 7 days', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Activity Household'
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Aanya',
        gradeBand: 'Grade 7'
      });
      await PersonalisationRepository.upsertPersonalisation(db, h.household.id, c.id, {
        favoriteSubjects: ['Biology'],
        interests: ['Nature'],
        learningStyle: 'visual',
        fontPreference: 'friendly',
        responseStyle: 'playful',
        themePreference: 'bright',
        preferredLanguage: 'en'
      });

      // Create 2 recent sessions with messages
      const s1 = await ConversationRepository.create(db, h.household.id, c.id, 'Photosynthesis and Plant Cells');
      await db.query(`INSERT INTO conversation_messages (conversation_id, role, text) VALUES ($1, $2, $3)`, [s1.id, 'user', 'How do plants make food?']);
      await db.query(`INSERT INTO conversation_messages (conversation_id, role, text) VALUES ($1, $2, $3)`, [s1.id, 'assistant', 'Plants use sunlight and chlorophyll...']);
      await db.query(`INSERT INTO conversation_messages (conversation_id, role, text) VALUES ($1, $2, $3)`, [s1.id, 'user', 'What is the role of stomata?']);
      await db.query(`INSERT INTO conversation_messages (conversation_id, role, text) VALUES ($1, $2, $3)`, [s1.id, 'assistant', 'Stomata allow gas exchange...']);

      const s2 = await ConversationRepository.create(db, h.household.id, c.id, 'Fractions and Decimals');
      await db.query(`INSERT INTO conversation_messages (conversation_id, role, text) VALUES ($1, $2, $3)`, [s2.id, 'user', 'How do I add 1/2 and 3/4?']);
      await db.query(`INSERT INTO conversation_messages (conversation_id, role, text) VALUES ($1, $2, $3)`, [s2.id, 'assistant', 'Find the common denominator 4...']);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const metrics = await ProactiveWhatsAppRepository.getWeeklyActivityMetrics(db, h.household.id, c.id, sevenDaysAgo);

      assert.equal(metrics.sessionCount, 2);
      assert.equal(metrics.userQuestionCount, 3);
      assert.equal(metrics.totalMessageCount, 6);
      assert.ok(metrics.recentTopics.includes('Photosynthesis and Plant Cells'));
      assert.ok(metrics.recentTopics.includes('Fractions and Decimals'));
      assert.deepEqual(metrics.favoriteSubjects, ['Biology']);
    });

    test('excludes greeting-like, question-like, or overly long session titles from recentTopics', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Greeting Household'
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Aishu',
        gradeBand: 'Grade 8'
      });

      // Create session with welcome greeting title and another with valid topic
      await ConversationRepository.create(
        db,
        h.household.id,
        c.id,
        "Hi Aishu! I'm Appu, your personal AI learning companion. What would you like to explore today?."
      );
      await ConversationRepository.create(
        db,
        h.household.id,
        c.id,
        'New conversation'
      );
      await ConversationRepository.create(
        db,
        h.household.id,
        c.id,
        'Algebraic Expressions'
      );

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const metrics = await ProactiveWhatsAppRepository.getWeeklyActivityMetrics(db, h.household.id, c.id, sevenDaysAgo);

      assert.equal(metrics.sessionCount, 3);
      // Recent topics must NOT contain the greeting title or generic 'New conversation'
      assert.ok(!metrics.recentTopics.some(t => t.includes("I'm Appu")), 'Must not contain greeting in topics');
      assert.ok(!metrics.recentTopics.some(t => t.toLowerCase() === 'new conversation'), 'Must not contain New conversation');
      assert.ok(metrics.recentTopics.includes('Algebraic Expressions'), 'Must contain legitimate topic');
    });

    test('returns zero counts and fallback subjects when no sessions exist', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Zero Activity'
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Dev',
        gradeBand: 'Grade 5'
      });
      await PersonalisationRepository.upsertPersonalisation(db, h.household.id, c.id, {
        favoriteSubjects: ['Mathematics'],
        interests: ['Gaming'],
        learningStyle: 'visual',
        fontPreference: 'friendly',
        responseStyle: 'playful',
        themePreference: 'bright',
        preferredLanguage: 'en'
      });

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const metrics = await ProactiveWhatsAppRepository.getWeeklyActivityMetrics(db, h.household.id, c.id, sevenDaysAgo);

      assert.equal(metrics.sessionCount, 0);
      assert.equal(metrics.userQuestionCount, 0);
      assert.equal(metrics.totalMessageCount, 0);
      assert.deepEqual(metrics.recentTopics, []);
      assert.deepEqual(metrics.favoriteSubjects, ['Mathematics']);
    });
  });

  describe('findBirthdayTargetsToday', () => {
    test('matches children whose dob month and day equal target date in Asia/Kolkata', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Birthday Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919988776655',
        whatsappConsent: true
      });

      // Child 1: Birthday today (e.g. 2014-09-08)
      const c1 = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'BirthdayKid',
        gradeBand: 'Grade 6'
      });
      await TenancyRepository.updateChildProfile(db, h.household.id, c1.id, {
        nickname: 'B-Kid',
        dob: '2014-09-08'
      });

      // Child 2: Different birthday (e.g. 2015-12-25)
      const c2 = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'OtherKid',
        gradeBand: 'Grade 5'
      });
      await TenancyRepository.updateChildProfile(db, h.household.id, c2.id, {
        dob: '2015-12-25'
      });

      // Target date: September 8, 2026
      const testDate = new Date('2026-09-08T10:00:00Z');
      const birthdays = await ProactiveWhatsAppRepository.findBirthdayTargetsToday(db, testDate);

      assert.equal(birthdays.length, 1);
      assert.equal(birthdays[0].childId, c1.id);
      assert.equal(birthdays[0].preferredName, 'BirthdayKid');
      assert.equal(birthdays[0].nickname, 'B-Kid');
      assert.equal(birthdays[0].effectiveName, 'B-Kid');
      assert.equal(birthdays[0].dob, '2014-09-08');
      assert.equal(birthdays[0].parentPhone, '+919988776655');
    });

    test('excludes birthday children if household has not consented to WhatsApp', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'No Consent Birthday'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919988776655',
        whatsappConsent: false
      });

      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'NoConsentKid',
        gradeBand: 'Grade 6'
      });
      await TenancyRepository.updateChildProfile(db, h.household.id, c.id, {
        dob: '2014-09-08'
      });

      const testDate = new Date('2026-09-08T10:00:00Z');
      const birthdays = await ProactiveWhatsAppRepository.findBirthdayTargetsToday(db, testDate);
      assert.equal(birthdays.length, 0);
    });
  });
});
