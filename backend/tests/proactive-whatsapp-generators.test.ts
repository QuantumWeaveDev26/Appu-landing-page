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
import {
  WeeklyDigestGenerator,
  DailyTipGenerator,
  BirthdayWishGenerator
} from '../src/domain/whatsapp/proactive/generators.js';
import {
  resolveGradeTier,
  getTipForDay
} from '../src/domain/whatsapp/proactive/tip-catalogue.js';
import { ProactiveWhatsAppService } from '../src/domain/whatsapp/proactive/service.js';
import { DEFAULT_TEMPLATE_LANGUAGE } from '../src/domain/whatsapp/proactive/types.js';

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

describe('Deterministic WhatsApp Generators & Service (Task 2)', () => {
  describe('Tip Catalogue & Grade Tiering', () => {
    test('resolves grade tiers accurately', () => {
      assert.equal(resolveGradeTier('Class 5'), '5-7');
      assert.equal(resolveGradeTier('Grade 7'), '5-7');
      assert.equal(resolveGradeTier('Class 8'), '8-10');
      assert.equal(resolveGradeTier('Grade 10'), '8-10');
      assert.equal(resolveGradeTier('Class 11'), '11-12');
      assert.equal(resolveGradeTier('Grade 12 CBSE'), '11-12');
      assert.equal(resolveGradeTier(null), '5-7');
      assert.equal(resolveGradeTier(''), '5-7');
    });

    test('getTipForDay provides deterministic daily rotation', () => {
      const d1 = new Date('2026-09-08T08:30:00Z');
      const d2 = new Date('2026-09-08T20:00:00Z'); // Same day
      const d3 = new Date('2026-09-09T08:30:00Z'); // Next day

      const tip1 = getTipForDay('8-10', d1, 'Aryan');
      const tip2 = getTipForDay('8-10', d2, 'Aryan');
      const tip3 = getTipForDay('8-10', d3, 'Aryan');

      assert.equal(tip1, tip2);
      assert.notEqual(tip1, tip3);
      assert.ok(tip1.length > 10);
      assert.ok(tip1.length <= 250);
      assert.ok(!tip1.includes('\n'), 'Tip must not contain raw newlines');
    });
  });

  describe('WeeklyDigestGenerator', () => {
    const mockTarget = {
      householdId: 'h-1',
      childId: 'c-1',
      parentPhone: '+919876543210',
      preferredName: 'Aryan',
      nickname: 'Aru',
      effectiveName: 'Aru',
      gradeBand: 'Grade 8',
      dob: '2013-05-15',
      favoriteSubjects: ['Mathematics', 'Science']
    };

    test('renders motivating 0-session fallback with exact 3 parameters', () => {
      const metrics = {
        sessionCount: 0,
        userQuestionCount: 0,
        totalMessageCount: 0,
        recentTopics: [],
        favoriteSubjects: ['Mathematics', 'Science']
      };

      const params = WeeklyDigestGenerator.generate(mockTarget, metrics);
      assert.equal(params.length, 3, 'Weekly digest must have exactly 3 parameters');
      assert.equal(params[0].text, 'Aru');
      assert.ok(params[1].text.includes('No sessions logged'));
      assert.ok(params[1].text.includes('Aru'));
      assert.ok(params[2].text.includes('Mathematics'));
      assert.ok(params[1].text.length <= 250);
      assert.ok(params[2].text.length <= 150);
      assert.ok(!params[1].text.includes('\n'));
      assert.ok(!params[2].text.includes('\n'));
    });

    test('renders high-activity summary with exact 3 parameters under char limits', () => {
      const metrics = {
        sessionCount: 5,
        userQuestionCount: 24,
        totalMessageCount: 48,
        recentTopics: ['Fractions and Decimals', 'Photosynthesis', 'Light and Reflection'],
        favoriteSubjects: ['Mathematics']
      };

      const params = WeeklyDigestGenerator.generate(mockTarget, metrics);
      assert.equal(params.length, 3);
      assert.equal(params[0].text, 'Aru');
      assert.ok(params[1].text.includes('Completed 5 study sessions (24 questions asked)'));
      assert.ok(params[1].text.includes('Fractions and Decimals'));
      assert.ok(params[1].text.length <= 250);
      assert.ok(params[2].text.length <= 150);
      assert.ok(!params[1].text.includes('\n'));
      assert.ok(!params[2].text.includes('\n'));
    });

    test('filters out greeting-like or long question session titles from summary and falls back to favorite subjects', () => {
      const welcomeGreetingTitle = "Hi Aishu! I'm Appu, your personal AI learning companion. What would you like to explore today?.";
      const metrics = {
        sessionCount: 1,
        userQuestionCount: 7,
        totalMessageCount: 14,
        recentTopics: [welcomeGreetingTitle],
        favoriteSubjects: ['Science', 'Mathematics']
      };

      const params = WeeklyDigestGenerator.generate(mockTarget, metrics);
      assert.equal(params.length, 3);
      assert.equal(params[0].text, 'Aru');
      // Assert welcome greeting title does NOT appear in {{2}} or {{3}}
      assert.ok(!params[1].text.includes("I'm Appu"), 'Summary must not contain greeting line');
      assert.ok(!params[1].text.includes('?'), 'Summary must not contain question sentence');
      assert.ok(!params[1].text.includes(welcomeGreetingTitle), 'Summary must not contain raw welcome title');
      assert.ok(params[1].text.includes('Science'), 'Summary should fall back to favorite subjects');
      assert.ok(params[1].text.length <= 250);
      assert.ok(params[2].text.length <= 150);
      assert.ok(!params[2].text.includes("I'm Appu"), 'Focus must not contain greeting line');
    });
  });

  describe('DailyTipGenerator', () => {
    test('renders daily tip with exact 2 parameters', () => {
      const target = {
        householdId: 'h-1',
        childId: 'c-1',
        parentPhone: '+919876543210',
        preferredName: 'Meera',
        nickname: null,
        effectiveName: 'Meera',
        gradeBand: 'Grade 6',
        dob: null,
        favoriteSubjects: ['English']
      };

      const params = DailyTipGenerator.generate(target, new Date('2026-09-08T08:30:00Z'));
      assert.equal(params.length, 2, 'Daily tip must have exactly 2 parameters');
      assert.equal(params[0].text, 'Meera');
      assert.ok(params[1].text.length > 10);
      assert.ok(params[1].text.length <= 250);
      assert.ok(!params[1].text.includes('\n'));
    });
  });

  describe('BirthdayWishGenerator', () => {
    test('renders birthday greeting with exact 1 parameter', () => {
      const target = {
        householdId: 'h-1',
        childId: 'c-1',
        parentPhone: '+919876543210',
        preferredName: 'Siddharth',
        nickname: 'Sid',
        effectiveName: 'Sid',
        gradeBand: 'Grade 10',
        dob: '2012-09-08'
      };

      const params = BirthdayWishGenerator.generate(target);
      assert.equal(params.length, 1, 'Birthday greeting must have exactly 1 parameter');
      assert.equal(params[0].text, 'Sid');
    });
  });

  describe('ProactiveWhatsAppService (Integration)', () => {
    let db: TransactionalQueryable;

    beforeEach(async () => {
      db = createTestDatabase();
      await runMigrations(db);
    });

    test('generates weekly digest payloads for consenting households', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Service Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543210',
        whatsappConsent: true
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Riya',
        gradeBand: 'Grade 9'
      });
      await TenancyRepository.updateChildProfile(db, h.household.id, c.id, {
        nickname: 'Riyu'
      });
      await PersonalisationRepository.upsertPersonalisation(db, h.household.id, c.id, {
        favoriteSubjects: ['Science']
      });

      const session = await ConversationRepository.create(db, h.household.id, c.id, 'Chemical Reactions');
      await db.query(`INSERT INTO conversation_messages (conversation_id, role, text) VALUES ($1, $2, $3)`, [session.id, 'user', 'What is oxidation?']);

      const targets = await ProactiveWhatsAppService.generateWeeklyDigest(db);
      assert.equal(targets.length, 1);
      assert.equal(targets[0].templateName, 'appu_weekly_digest');
      assert.equal(targets[0].templateLanguage, DEFAULT_TEMPLATE_LANGUAGE);
      assert.equal(targets[0].recipientPhone, '+919876543210');
      assert.equal(targets[0].parameters.length, 3);
      assert.equal(targets[0].parameters[0].text, 'Riyu');
      assert.ok(targets[0].parameters[1].text.includes('Chemical Reactions'));
    });

    test('generates daily tip payloads for consenting households', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Tip Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543210',
        whatsappConsent: true
      });
      await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Rohan',
        gradeBand: 'Grade 10'
      });

      const targets = await ProactiveWhatsAppService.generateDailyTip(db, {
        referenceDate: new Date('2026-09-08T08:30:00Z')
      });
      assert.equal(targets.length, 1);
      assert.equal(targets[0].templateName, 'appu_daily_tip');
      assert.equal(targets[0].templateLanguage, DEFAULT_TEMPLATE_LANGUAGE);
      assert.equal(targets[0].recipientPhone, '+919876543210');
      assert.equal(targets[0].parameters.length, 2);
      assert.equal(targets[0].parameters[0].text, 'Rohan');
      assert.ok(targets[0].parameters[1].text.length > 10);
    });

    test('generates birthday wish payloads for children with birthday today', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Birthday Service Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543210',
        whatsappConsent: true
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Ananya',
        gradeBand: 'Grade 7'
      });
      await TenancyRepository.updateChildProfile(db, h.household.id, c.id, {
        dob: '2014-09-08'
      });

      const targets = await ProactiveWhatsAppService.generateBirthdayWishes(db, {
        referenceDate: new Date('2026-09-08T09:00:00Z')
      });
      assert.equal(targets.length, 1);
      assert.equal(targets[0].templateName, 'appu_birthday_wish');
      assert.equal(targets[0].templateLanguage, DEFAULT_TEMPLATE_LANGUAGE);
      assert.equal(targets[0].recipientPhone, '+919876543210');
      assert.equal(targets[0].parameters.length, 1);
      assert.equal(targets[0].parameters[0].text, 'Ananya');
    });
  });
});
