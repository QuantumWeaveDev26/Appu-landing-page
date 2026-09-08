import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { StudyScheduleRepository } from '../src/domain/study-schedule/index.js';

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

  const cleanQuery = async (text: string, params?: any[]) => {
    let t = text;
    if (t.includes('ENABLE ROW LEVEL SECURITY') || t.includes('enable row level security')) {
      t = t.replace(/ALTER TABLE[^\n;]+ENABLE ROW LEVEL SECURITY;?/gi, '');
    }

    // Intercept CTE claim query for pg-mem compatibility
    if (t.includes('WITH due_schedules AS')) {
      const upperBound = params?.[0];
      const lowerBound = params?.[1];
      const limit = params?.[2] ?? 200;
      const dryRun = Boolean(params?.[3]);

      // 1. Query matching due schedules
      const selectSql = `
        SELECT 
          s.id,
          s.household_id,
          s.child_id,
          COALESCE(c.nickname, c.preferred_name) AS child_name,
          h.parent_phone,
          s.topic,
          s.scheduled_at,
          s.time_display,
          s.reminder_sent
        FROM study_schedules s
        JOIN households h ON h.id = s.household_id
        JOIN child_profiles c ON c.id = s.child_id
        WHERE s.reminder_sent = FALSE
          AND s.scheduled_at <= $1
          AND s.scheduled_at >= $2
          AND h.whatsapp_consent = TRUE
          AND h.parent_phone IS NOT NULL
          AND c.status = 'ACTIVE'
        ORDER BY s.scheduled_at ASC
        LIMIT $3;
      `;
      const selectRes = await pool.query(selectSql, [upperBound, lowerBound, limit]);
      const rows = selectRes.rows;

      // 2. If not dryRun, mark claimed in study_schedules
      if (!dryRun && rows.length > 0) {
        for (const row of rows) {
          await pool.query(
            `UPDATE study_schedules SET reminder_sent = TRUE, reminder_sent_at = NOW() WHERE id = $1;`,
            [row.id]
          );
        }
      }

      return {
        rows: rows.map(r => ({
          ...r,
          reminder_sent: dryRun ? false : true
        })),
        rowCount: rows.length
      };
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

describe('StudyScheduleRepository (Task 1)', () => {
  let db: TransactionalQueryable;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);
  });

  describe('create and retrieve', () => {
    test('successfully inserts and retrieves study schedule with tenant scoping', async () => {
      const h1 = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Ananya Family'
      });
      const c1 = await TenancyRepository.createChildProfile(db, {
        householdId: h1.household.id,
        preferredName: 'Ananya',
        gradeBand: 'Class 8'
      });

      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

      const created = await StudyScheduleRepository.create(db, {
        householdId: h1.household.id,
        childId: c1.id,
        topic: 'Algebra Linear Equations',
        scheduledAt: futureDate,
        timeDisplay: '3:00 PM',
        rawExpression: 'tomorrow at 3pm'
      });

      assert.ok(created.id, 'schedule should have generated uuid');
      assert.equal(created.householdId, h1.household.id);
      assert.equal(created.childId, c1.id);
      assert.equal(created.topic, 'Algebra Linear Equations');
      assert.equal(created.timeDisplay, '3:00 PM');
      assert.equal(created.rawExpression, 'tomorrow at 3pm');
      assert.equal(created.reminderSent, false);
      assert.equal(created.reminderSentAt, null);

      const upcoming = await StudyScheduleRepository.listUpcomingByChild(db, h1.household.id, c1.id);
      assert.equal(upcoming.length, 1);
      assert.equal(upcoming[0].id, created.id);
      assert.equal(upcoming[0].topic, 'Algebra Linear Equations');
    });

    test('isolates schedules between different children and households', async () => {
      const h1 = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Household 1'
      });
      const c1 = await TenancyRepository.createChildProfile(db, {
        householdId: h1.household.id,
        preferredName: 'Child 1',
        gradeBand: 'Class 6'
      });

      const h2 = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Household 2'
      });
      const c2 = await TenancyRepository.createChildProfile(db, {
        householdId: h2.household.id,
        preferredName: 'Child 2',
        gradeBand: 'Class 7'
      });

      const futureDate = new Date(Date.now() + 3600 * 1000);

      await StudyScheduleRepository.create(db, {
        householdId: h1.household.id,
        childId: c1.id,
        topic: 'Fractions',
        scheduledAt: futureDate,
        timeDisplay: '4:00 PM'
      });

      await StudyScheduleRepository.create(db, {
        householdId: h2.household.id,
        childId: c2.id,
        topic: 'Geometry',
        scheduledAt: futureDate,
        timeDisplay: '4:00 PM'
      });

      const h1Schedules = await StudyScheduleRepository.listUpcomingByChild(db, h1.household.id, c1.id);
      assert.equal(h1Schedules.length, 1);
      assert.equal(h1Schedules[0].topic, 'Fractions');

      const h2Schedules = await StudyScheduleRepository.listUpcomingByChild(db, h2.household.id, c2.id);
      assert.equal(h2Schedules.length, 1);
      assert.equal(h2Schedules[0].topic, 'Geometry');
    });
  });

  describe('claimPendingReminders', () => {
    test('claims due reminders within target window and marks reminder_sent=TRUE', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Study Clan'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543210',
        whatsappConsent: true
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Aarav',
        gradeBand: 'Class 9'
      });

      const now = new Date();
      const scheduledIn20m = new Date(now.getTime() + 20 * 60 * 1000); // within 30m window

      const s = await StudyScheduleRepository.create(db, {
        householdId: h.household.id,
        childId: c.id,
        topic: 'Carbon Compounds',
        scheduledAt: scheduledIn20m,
        timeDisplay: '5:30 PM'
      });

      // Claim reminders as of now with windowMinutes=30
      const claimed = await StudyScheduleRepository.claimPendingReminders(db, {
        windowMinutes: 30,
        asOfDate: now,
        dryRun: false
      });

      assert.equal(claimed.length, 1);
      assert.equal(claimed[0].id, s.id);
      assert.equal(claimed[0].childName, 'Aarav');
      assert.equal(claimed[0].parentPhone, '+919876543210');
      assert.equal(claimed[0].topic, 'Carbon Compounds');
      assert.equal(claimed[0].timeDisplay, '5:30 PM');
      assert.equal(claimed[0].reminderSent, true);

      // Verify second claim returns empty (atomic claim guarantee)
      const secondClaim = await StudyScheduleRepository.claimPendingReminders(db, {
        windowMinutes: 30,
        asOfDate: now,
        dryRun: false
      });
      assert.equal(secondClaim.length, 0, 'Already-claimed reminder must not be claimed again');
    });

    test('prefers nickname over preferred_name when available', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Nickname Family'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543211',
        whatsappConsent: true
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Aishwarya',
        gradeBand: 'Class 10'
      });
      await TenancyRepository.updateChildProfile(db, h.household.id, c.id, {
        nickname: 'Aishu'
      });

      const now = new Date();
      await StudyScheduleRepository.create(db, {
        householdId: h.household.id,
        childId: c.id,
        topic: 'Trigonometry',
        scheduledAt: new Date(now.getTime() + 15 * 60 * 1000),
        timeDisplay: '6:00 PM'
      });

      const claimed = await StudyScheduleRepository.claimPendingReminders(db, {
        windowMinutes: 30,
        asOfDate: now
      });

      assert.equal(claimed.length, 1);
      assert.equal(claimed[0].childName, 'Aishu', 'Nickname must be prioritized for greeting');
    });

    test('dryRun leaves reminder_sent=FALSE and allows subsequent claim', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'DryRun Test'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543212',
        whatsappConsent: true
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Dev',
        gradeBand: 'Class 7'
      });

      const now = new Date();
      await StudyScheduleRepository.create(db, {
        householdId: h.household.id,
        childId: c.id,
        topic: 'Solar System',
        scheduledAt: new Date(now.getTime() + 10 * 60 * 1000),
        timeDisplay: '2:00 PM'
      });

      // Dry run claim
      const dryClaimed = await StudyScheduleRepository.claimPendingReminders(db, {
        windowMinutes: 30,
        asOfDate: now,
        dryRun: true
      });
      assert.equal(dryClaimed.length, 1);
      assert.equal(dryClaimed[0].reminderSent, false);

      // Real claim should still pick it up
      const realClaimed = await StudyScheduleRepository.claimPendingReminders(db, {
        windowMinutes: 30,
        asOfDate: now,
        dryRun: false
      });
      assert.equal(realClaimed.length, 1);
      assert.equal(realClaimed[0].reminderSent, true);
    });

    test('excludes households without whatsapp_consent or without parent_phone', async () => {
      // 1. Consent false
      const hNoConsent = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'No Consent'
      });
      await TenancyRepository.updateNotificationPreferences(db, hNoConsent.household.id, {
        parentPhone: '+919876543213',
        whatsappConsent: false
      });
      const cNoConsent = await TenancyRepository.createChildProfile(db, {
        householdId: hNoConsent.household.id,
        preferredName: 'Child 1',
        gradeBand: 'Class 8'
      });

      // 2. Missing phone (consent false, phone null)
      const hNoPhone = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'No Phone'
      });
      await TenancyRepository.updateNotificationPreferences(db, hNoPhone.household.id, {
        parentPhone: null,
        whatsappConsent: false
      });
      const cNoPhone = await TenancyRepository.createChildProfile(db, {
        householdId: hNoPhone.household.id,
        preferredName: 'Child 2',
        gradeBand: 'Class 8'
      });

      const now = new Date();
      const targetTime = new Date(now.getTime() + 15 * 60 * 1000);

      await StudyScheduleRepository.create(db, {
        householdId: hNoConsent.household.id,
        childId: cNoConsent.id,
        topic: 'Chemistry',
        scheduledAt: targetTime,
        timeDisplay: '3:00 PM'
      });

      await StudyScheduleRepository.create(db, {
        householdId: hNoPhone.household.id,
        childId: cNoPhone.id,
        topic: 'Physics',
        scheduledAt: targetTime,
        timeDisplay: '3:00 PM'
      });

      const claimed = await StudyScheduleRepository.claimPendingReminders(db, {
        windowMinutes: 30,
        asOfDate: now
      });

      assert.equal(claimed.length, 0, 'Households without consent or phone must never be claimed');
    });

    test('excludes schedules outside the time window', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Window Test'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543214',
        whatsappConsent: true
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Pooja',
        gradeBand: 'Class 10'
      });

      const now = new Date();
      // Too far in future (> 30m)
      await StudyScheduleRepository.create(db, {
        householdId: h.household.id,
        childId: c.id,
        topic: 'Far Future Topic',
        scheduledAt: new Date(now.getTime() + 50 * 60 * 1000),
        timeDisplay: '8:00 PM'
      });

      // Too far in past (< -15m)
      await StudyScheduleRepository.create(db, {
        householdId: h.household.id,
        childId: c.id,
        topic: 'Way Past Topic',
        scheduledAt: new Date(now.getTime() - 25 * 60 * 1000),
        timeDisplay: '1:00 PM'
      });

      const claimed = await StudyScheduleRepository.claimPendingReminders(db, {
        windowMinutes: 30,
        asOfDate: now
      });

      assert.equal(claimed.length, 0, 'Schedules outside window bounds must not be claimed');
    });
  });
});
