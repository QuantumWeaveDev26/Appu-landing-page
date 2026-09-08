-- ==============================================================================
-- Migration: 018_study_schedules.sql
-- Description: Learner study schedules and proactive reminder state
-- ==============================================================================

CREATE TABLE IF NOT EXISTS study_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
    topic VARCHAR(150) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    time_display VARCHAR(50) NOT NULL,
    raw_expression VARCHAR(150) NULL,
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ NULL,
    calendar_event_id VARCHAR(255) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for fast, lock-free polling of pending study reminders by cron
CREATE INDEX IF NOT EXISTS idx_study_schedules_pending_reminders
    ON study_schedules (scheduled_at)
    WHERE reminder_sent = FALSE;

-- Lookup index for learner schedule retrieval and deduplication
CREATE INDEX IF NOT EXISTS idx_study_schedules_lookup
    ON study_schedules (household_id, child_id, scheduled_at DESC);

COMMENT ON TABLE study_schedules IS 'Scheduled study sessions captured from conversational intent';
COMMENT ON COLUMN study_schedules.time_display IS 'Preformatted 12-hour time string (e.g. 3:00 PM) for Meta template parameter {{3}}';
COMMENT ON COLUMN study_schedules.reminder_sent IS 'Flag indicating whether the appu_study_reminder proactive message was dispatched';
COMMENT ON COLUMN study_schedules.calendar_event_id IS 'Reserved for optional external calendar event identifier';
