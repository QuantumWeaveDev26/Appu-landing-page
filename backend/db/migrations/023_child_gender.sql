-- ==============================================================================
-- Migration: 023_child_gender.sql
-- Description: Learner gender for respectful, non-stereotyped personalisation
--              (pronouns / representation). Additive, nullable, backward-compatible.
-- ==============================================================================

ALTER TABLE child_profiles
  ADD COLUMN IF NOT EXISTS gender VARCHAR(16) NULL;

COMMENT ON COLUMN child_profiles.gender IS 'Learner gender (boy | girl | other), used respectfully for pronouns/representation only, never for stereotyping';
