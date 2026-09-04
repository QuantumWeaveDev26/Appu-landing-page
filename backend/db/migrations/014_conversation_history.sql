-- ==============================================================================
-- Migration: 014_conversation_history.sql
-- Description: Persistent, child-scoped conversation history and message log
-- ==============================================================================

CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX conversation_sessions_child_recent_idx
  ON conversation_sessions (household_id, child_id, updated_at DESC);
CREATE INDEX conversation_sessions_expiry_idx ON conversation_sessions (expires_at);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  request_id UUID NULL REFERENCES appu_requests(id) ON DELETE SET NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  has_image_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, role)
);

CREATE INDEX conversation_messages_order_idx
  ON conversation_messages (conversation_id, created_at ASC, id ASC);
