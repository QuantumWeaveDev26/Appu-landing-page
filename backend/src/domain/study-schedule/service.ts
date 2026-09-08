import type { Queryable } from '../../db/types.js';
import { TenancyRepository, normalizePhoneNumber } from '../tenancy/repository.js';
import { StudyScheduleRepository } from './repository.js';
import { BadRequestError, NotFoundError } from '../../errors/index.js';
import type {
  RecordStudyScheduleInput,
  RecordStudyScheduleResult,
  StudyReminderTargetPayload,
  ClaimDueRemindersOptions
} from './types.js';

export function generateGoogleCalendarUrl(
  topic: string,
  scheduledAt: Date,
  childName: string,
  durationMinutes: number = 45
): string {
  const startTime = scheduledAt;
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const formatUtcCompact = (d: Date): string =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const title = encodeURIComponent(`Study ${topic} with APPU`);
  const dates = `${formatUtcCompact(startTime)}/${formatUtcCompact(endTime)}`;
  const details = encodeURIComponent(
    `Scheduled study session for ${childName}.\n\nTopic: ${topic}\n\nOpen APPU to start learning!`
  );
  const location = encodeURIComponent('APPU AI Tutor (WhatsApp)');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

function formatTimeDisplayIst(d: Date): string {
  return d
    .toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    .toUpperCase();
}

export class StudyScheduleService {
  /**
   * Generates a 0-OAuth Google Calendar Web Intent URL.
   */
  public static generateCalendarUrl(
    topic: string,
    scheduledAt: Date,
    childName: string,
    durationMinutes: number = 45
  ): string {
    return generateGoogleCalendarUrl(topic, scheduledAt, childName, durationMinutes);
  }

  /**
   * Records a study schedule intent captured from conversational interaction.
   * Resolves household and active child by sender parent phone, validates future bounds,
   * inserts record via repository, and returns composite result with 0-OAuth calendar link.
   */
  public static async recordSchedule(
    db: Queryable,
    input: RecordStudyScheduleInput
  ): Promise<RecordStudyScheduleResult> {
    const rawPhone = input.phone ? String(input.phone).trim() : '';
    if (!rawPhone) {
      throw new BadRequestError('Phone number is required');
    }

    const rawTopic = input.topic ? String(input.topic).trim() : '';
    if (!rawTopic) {
      throw new BadRequestError('Study topic is required');
    }
    const topic = rawTopic.slice(0, 150);

    // 1. Validate scheduledAt
    const scheduledDate = new Date(input.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestError('Invalid scheduled time format');
    }

    const now = Date.now();
    const scheduledTime = scheduledDate.getTime();

    // Must be strictly future (at least 1 minute ahead)
    if (scheduledTime < now + 60_000) {
      throw new BadRequestError('Scheduled time must be in the future (at least 1 minute ahead)');
    }

    // Must not exceed 60 days
    const maxHorizonMs = 60 * 24 * 60 * 60 * 1000;
    if (scheduledTime > now + maxHorizonMs) {
      throw new BadRequestError('Scheduled time cannot be more than 60 days in the future');
    }

    // 2. Resolve household by phone
    const household = await TenancyRepository.findHouseholdByParentPhone(db, rawPhone);
    if (!household) {
      // Differentiate between unknown phone and unconsented household
      const normalized = normalizePhoneNumber(rawPhone);
      if (normalized) {
        const check = await db.query<{ id: string; whatsapp_consent: boolean }>(
          `SELECT id, whatsapp_consent FROM households WHERE parent_phone = $1 LIMIT 1;`,
          [normalized]
        );
        if (check.rows.length > 0 && !check.rows[0].whatsapp_consent) {
          throw new BadRequestError('WhatsApp consent is required to schedule study reminders');
        }
      }
      throw new NotFoundError('Household not found for the provided phone number');
    }

    // 3. Resolve active child profile (single child per household invariant)
    const children = await TenancyRepository.listChildProfilesByHousehold(db, household.id);
    if (!children || children.length === 0) {
      throw new NotFoundError('No active child profile found for this household');
    }

    const child = children.find((c) => c.status === 'ACTIVE') || children[0];
    if (!child) {
      throw new NotFoundError('No active child profile found for this household');
    }

    const childName = child.nickname?.trim() || child.preferredName?.trim() || 'Learner';

    // 4. Derive or sanitize timeDisplay in IST
    const timeDisplay = input.timeDisplay?.trim()
      ? input.timeDisplay.trim().slice(0, 50)
      : formatTimeDisplayIst(scheduledDate);

    // 5. Insert via repository
    const schedule = await StudyScheduleRepository.create(db, {
      householdId: household.id,
      childId: child.id,
      topic,
      scheduledAt: scheduledDate,
      timeDisplay,
      rawExpression: input.rawExpression?.trim().slice(0, 150) ?? null
    });

    // 6. Generate 0-OAuth Google Calendar Web Intent URL
    const calendarUrl = generateGoogleCalendarUrl(topic, scheduledDate, childName);

    return {
      schedule,
      calendarUrl
    };
  }

  /**
   * Atomically claims due study reminders for proactive dispatch.
   * Maps claimed reminders into Meta template payload format matching approved 'appu_study_reminder'.
   */
  public static async claimDueReminders(
    db: Queryable,
    options?: ClaimDueRemindersOptions
  ): Promise<StudyReminderTargetPayload[]> {
    const claimed = await StudyScheduleRepository.claimPendingReminders(db, options);

    return claimed.map((reminder) => ({
      householdId: reminder.householdId,
      childId: reminder.childId,
      recipientPhone: reminder.parentPhone,
      templateName: 'appu_study_reminder',
      templateLanguage: 'en',
      parameters: [
        { type: 'text', text: reminder.childName },
        { type: 'text', text: reminder.topic },
        { type: 'text', text: reminder.timeDisplay }
      ]
    }));
  }
}
