export interface StudyScheduleRecord {
  id: string;
  householdId: string;
  childId: string;
  topic: string;
  scheduledAt: Date;
  timeDisplay: string;
  rawExpression: string | null;
  reminderSent: boolean;
  reminderSentAt: Date | null;
  calendarEventId: string | null;
  createdAt: Date;
}

export interface CreateStudyScheduleParams {
  householdId: string;
  childId: string;
  topic: string;
  scheduledAt: Date;
  timeDisplay: string;
  rawExpression?: string | null;
  calendarEventId?: string | null;
}

export interface ClaimPendingRemindersOptions {
  windowMinutes?: number;
  limit?: number;
  dryRun?: boolean;
  asOfDate?: Date;
}

export interface ClaimedStudyReminder {
  id: string;
  householdId: string;
  childId: string;
  childName: string;
  parentPhone: string;
  topic: string;
  scheduledAt: Date;
  timeDisplay: string;
  reminderSent: boolean;
}

export interface RecordStudyScheduleInput {
  phone: string;
  topic: string;
  scheduledAt: string | Date;
  timeDisplay?: string;
  rawExpression?: string | null;
}

export interface RecordStudyScheduleResult {
  schedule: StudyScheduleRecord;
  calendarUrl: string;
}

export interface MetaTemplateParameter {
  type: 'text';
  text: string;
}

export interface StudyReminderTargetPayload {
  householdId: string;
  childId: string;
  recipientPhone: string;
  templateName: string;
  templateLanguage: string;
  parameters: MetaTemplateParameter[];
}

export interface ClaimDueRemindersOptions {
  windowMinutes?: number;
  limit?: number;
  dryRun?: boolean;
  asOfDate?: Date;
}
