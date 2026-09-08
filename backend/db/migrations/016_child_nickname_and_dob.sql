-- ==============================================================================
-- Migration: 016_child_nickname_and_dob.sql
-- Description: Learner nickname for friendly addressing and date of birth for age-adapted learning
-- ==============================================================================

ALTER TABLE child_profiles
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS dob DATE NULL;

COMMENT ON COLUMN child_profiles.nickname IS 'Preferred informal name for APPU conversational addressing';
COMMENT ON COLUMN child_profiles.dob IS 'Child date of birth for age-adapted pedagogy and birthday wishes';
