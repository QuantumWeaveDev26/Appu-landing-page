-- ==============================================================================
-- Migration: 019_family_feedback.sql
-- Description: Household-scoped parent feedback for child performance report unlock
-- ==============================================================================

CREATE TABLE IF NOT EXISTS family_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  whats_working TEXT NULL,
  whats_to_improve TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_feedback_household_created
  ON family_feedback (household_id, created_at DESC);
