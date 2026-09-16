-- ==============================================================================
-- Migration: 020_session_alerts.sql
-- Description: Session alerts tracking for proactive WhatsApp parent notifications
-- ==============================================================================

CREATE TABLE IF NOT EXISTS session_alerts (
  session_id TEXT PRIMARY KEY,
  household_id UUID NOT NULL,
  child_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  start_sent_at TIMESTAMPTZ NULL,
  thirty_sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_alerts_household
  ON session_alerts(household_id);

CREATE INDEX IF NOT EXISTS idx_session_alerts_started_at
  ON session_alerts(started_at DESC);

-- Additive parent age-gate columns on households
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS parent_dob DATE NULL,
  ADD COLUMN IF NOT EXISTS adult_attested BOOLEAN NOT NULL DEFAULT FALSE;
