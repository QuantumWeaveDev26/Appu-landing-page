-- ==============================================================================
-- Migration: 021_session_rolling_summary.sql
-- Description: Rolling session summary columns for conversation compaction
-- ==============================================================================

ALTER TABLE conversation_sessions
  ADD COLUMN IF NOT EXISTS rolling_summary TEXT NULL,
  ADD COLUMN IF NOT EXISTS summarized_up_to_message_id UUID NULL,
  ADD COLUMN IF NOT EXISTS summarized_at TIMESTAMPTZ NULL;
