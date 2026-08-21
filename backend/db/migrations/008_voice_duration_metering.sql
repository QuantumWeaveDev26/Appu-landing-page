-- ==============================================================================
-- Migration: 008_voice_duration_metering.sql
-- Description: Allow 'voice_duration_ms' metric in usage_records ledger table
-- ==============================================================================

-- 1. Drop existing metric check constraint if present and re-add with voice_duration_ms
ALTER TABLE usage_records
DROP CONSTRAINT IF EXISTS usage_records_metric_check;

ALTER TABLE usage_records
DROP CONSTRAINT IF EXISTS usage_records_constraint_1;

ALTER TABLE usage_records
ADD CONSTRAINT usage_records_metric_check
CHECK (metric IN ('ai_sessions', 'voice_seconds', 'voice_duration_ms'));
