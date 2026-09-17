-- ==============================================================================
-- Migration: 022_parental_controls.sql
-- Description: Session usage tracking and OTP verification for parental lock
-- ==============================================================================

CREATE TABLE IF NOT EXISTS session_usage (
  session_id TEXT PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  active_seconds INT NOT NULL DEFAULT 0,
  away_seconds INT NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_usage_household
  ON session_usage(household_id, child_id);

CREATE TABLE IF NOT EXISTS parent_session_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parent_otps_session
  ON parent_session_otps(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parent_otps_household_rate
  ON parent_session_otps(household_id, created_at DESC);
