-- ==============================================================================
-- Migration: 015_household_whatsapp_preferences.sql
-- Description: Household-scoped parent contact phone and WhatsApp automation consent
-- ==============================================================================

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_households_parent_phone
  ON households(parent_phone)
  WHERE parent_phone IS NOT NULL;
