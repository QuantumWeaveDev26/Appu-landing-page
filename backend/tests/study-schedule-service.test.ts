import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { StudyScheduleService, generateGoogleCalendarUrl } from '../src/domain/study-schedule/index.js';
import { BadRequestError, NotFoundError } from '../src/errors/index.js';

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

describe('StudyScheduleService (Task 2)', () => {
  let db: TransactionalQueryable;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);
  });

  describe('generateGoogleCalendarUrl', () => {
    test('produces well-formed, URL-encoded 0-OAuth Google Calendar template URL with UTC Z dates', () => {
      const startTime = new Date('2026-09-09T09:30:00.000Z'); // 3:00 PM IST
      const url = generateGoogleCalendarUrl('Fractions & Decimals', startTime, 'Aishu', 45);

      assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
      assert.ok(url.includes('text=Study%20Fractions%20%26%20Decimals%20with%20APPU'));
      assert.ok(url.includes('dates=20260909T093000Z/20260909T101500Z'));
      assert.ok(url.includes('details='));
      assert.ok(url.includes('Aishu'));
      assert.ok(url.includes('location=APPU%20AI%20Tutor%20(WhatsApp)'));
    });
  });

  describe('recordSchedule', () => {
    test('happy path: resolves household by phone, validates future date, inserts schedule, and returns calendarUrl', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Ananya Family'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543210',
        whatsappConsent: true
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Ananya',
        gradeBand: 'Class 8'
      });
      await TenancyRepository.updateChildProfile(db, h.household.id, c.id, {
        nickname: 'Anu'
      });

      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day future

      const result = await StudyScheduleService.recordSchedule(db, {
        phone: '+919876543210',
        topic: 'Linear Equations',
        scheduledAt: scheduledAt.toISOString(),
        timeDisplay: '4:00 PM',
        rawExpression: 'tomorrow at 4pm'
      });

      assert.ok(result.schedule.id);
      assert.equal(result.schedule.householdId, h.household.id);
      assert.equal(result.schedule.childId, c.id);
      assert.equal(result.schedule.topic, 'Linear Equations');
      assert.equal(result.schedule.timeDisplay, '4:00 PM');
      assert.equal(result.schedule.rawExpression, 'tomorrow at 4pm');
      assert.equal(result.schedule.reminderSent, false);

      assert.ok(result.calendarUrl);
      assert.ok(result.calendarUrl.includes('action=TEMPLATE'));
      assert.ok(result.calendarUrl.includes('Linear%20Equations'));
      assert.ok(result.calendarUrl.includes('Anu'), 'calendar URL should prioritize nickname');
    });

    test('derives timeDisplay in IST automatically when not explicitly provided', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'IST Display Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543211',
        whatsappConsent: true
      });
      await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Rohan',
        gradeBand: 'Class 9'
      });

      // 09:30:00 UTC is exactly 15:00 (3:00 PM) IST
      const scheduledAtUtc = new Date(Date.now() + 2 * 60 * 60 * 1000);
      scheduledAtUtc.setUTCHours(9, 30, 0, 0);
      if (scheduledAtUtc.getTime() < Date.now() + 60_000) {
        scheduledAtUtc.setDate(scheduledAtUtc.getDate() + 1);
      }

      const result = await StudyScheduleService.recordSchedule(db, {
        phone: '+919876543211',
        topic: 'Thermodynamics',
        scheduledAt: scheduledAtUtc.toISOString()
      });

      assert.equal(result.schedule.timeDisplay, '3:00 PM');
    });

    test('rejects unrecognized phone number with NotFoundError', async () => {
      await assert.rejects(
        async () => {
          await StudyScheduleService.recordSchedule(db, {
            phone: '+919999999999',
            topic: 'Physics',
            scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString()
          });
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundError);
          assert.match(err.message, /household not found/i);
          return true;
        }
      );
    });

    test('rejects household without granted whatsapp_consent with BadRequestError', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'No Consent Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543212',
        whatsappConsent: false
      });
      await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Maya',
        gradeBand: 'Class 6'
      });

      await assert.rejects(
        async () => {
          await StudyScheduleService.recordSchedule(db, {
            phone: '+919876543212',
            topic: 'Biology',
            scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString()
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestError);
          assert.match(err.message, /whatsapp consent/i);
          return true;
        }
      );
    });

    test('rejects past scheduledAt timestamp with BadRequestError', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Past Time Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543213',
        whatsappConsent: true
      });
      await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Dev',
        gradeBand: 'Class 7'
      });

      const pastTime = new Date(Date.now() - 60 * 1000); // 1 minute in past

      await assert.rejects(
        async () => {
          await StudyScheduleService.recordSchedule(db, {
            phone: '+919876543213',
            topic: 'History',
            scheduledAt: pastTime.toISOString()
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestError);
          assert.match(err.message, /must be in the future/i);
          return true;
        }
      );
    });

    test('rejects scheduledAt exceeding 60-day horizon with BadRequestError', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Far Future Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543214',
        whatsappConsent: true
      });
      await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Simran',
        gradeBand: 'Class 8'
      });

      const farFuture = new Date(Date.now() + 61 * 24 * 60 * 60 * 1000); // 61 days ahead

      await assert.rejects(
        async () => {
          await StudyScheduleService.recordSchedule(db, {
            phone: '+919876543214',
            topic: 'Geography',
            scheduledAt: farFuture.toISOString()
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestError);
          assert.match(err.message, /60 days/i);
          return true;
        }
      );
    });
  });

  describe('claimDueReminders', () => {
    test('formats exact 3 Meta template parameters with approved templateName and lang', async () => {
      const h = await TenancyService.createHouseholdWithOwner(db, {
        userId: crypto.randomUUID(),
        householdName: 'Due Reminder Household'
      });
      await TenancyRepository.updateNotificationPreferences(db, h.household.id, {
        parentPhone: '+919876543215',
        whatsappConsent: true
      });
      const c = await TenancyRepository.createChildProfile(db, {
        householdId: h.household.id,
        preferredName: 'Pooja',
        gradeBand: 'Class 10'
      });
      await TenancyRepository.updateChildProfile(db, h.household.id, c.id, {
        nickname: 'Pooju'
      });

      const now = new Date();
      await StudyScheduleService.recordSchedule(db, {
        phone: '+919876543215',
        topic: 'Quadratic Equations',
        scheduledAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        timeDisplay: '5:00 PM'
      });

      const targets = await StudyScheduleService.claimDueReminders(db, {
        windowMinutes: 30,
        asOfDate: now
      });

      assert.equal(targets.length, 1);
      const target = targets[0];
      assert.equal(target.householdId, h.household.id);
      assert.equal(target.childId, c.id);
      assert.equal(target.recipientPhone, '+919876543215');
      assert.equal(target.templateName, 'appu_study_reminder');
      assert.equal(target.templateLanguage, 'en');

      assert.equal(target.parameters.length, 3);
      assert.deepEqual(target.parameters[0], { type: 'text', text: 'Pooju' });
      assert.deepEqual(target.parameters[1], { type: 'text', text: 'Quadratic Equations' });
      assert.deepEqual(target.parameters[2], { type: 'text', text: '5:00 PM' });
    });
  });
});
