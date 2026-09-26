-- ==============================================================================
-- Migration: 024_adaptive_learning_and_syllabus.sql
-- Description: Foundation for Phase B (adaptive difficulty / persisted learner
--              level) and Phase C (out-of-syllabus curiosity tracking).
--              Additive + nullable + behavior-neutral: no existing code path
--              reads/writes these until the experimental-learning feature flag
--              is honored. Child behavioral data is collected ONLY on flagged
--              requests (pending DPDP consent review before production use).
-- ==============================================================================

-- Phase B: persisted "working level" that performance nudges over time.
-- Scale 1..5 (1=starting, 3=at grade level default, 5=challenge-ready).
-- NULL = not yet assessed -> brain falls back to grade level.
ALTER TABLE child_profiles
  ADD COLUMN IF NOT EXISTS learner_level SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS learner_level_samples INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learner_level_updated_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN child_profiles.learner_level IS 'Phase B working level 1..5 nudged from demonstrated performance; NULL=use grade level. An intake answer is never a permanent label.';
COMMENT ON COLUMN child_profiles.learner_level_samples IS 'Count of graded turns that have contributed to learner_level (confidence proxy).';

-- Phase C: log of questions a learner asked that fall outside their grade
-- syllabus, surfaced positively in the parent report as "curiosity beyond syllabus".
CREATE TABLE IF NOT EXISTS out_of_syllabus_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL,
  child_id      UUID NOT NULL,
  session_id    TEXT NULL,
  topic         TEXT NOT NULL,
  question_excerpt TEXT NULL,
  expected_grade   TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_oos_child FOREIGN KEY (household_id, child_id)
    REFERENCES child_profiles (household_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oos_events_child
  ON out_of_syllabus_events (household_id, child_id, created_at DESC);
