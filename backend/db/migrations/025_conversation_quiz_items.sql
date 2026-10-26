-- ==============================================================================
-- Migration: 025_conversation_quiz_items.sql
-- Description: Structured state for conversational (chat) quizzes, QA F18 2026-10-24.
--              Each multiple-choice question the brain asks is stored with its correct
--              option when it is asked; the learner's answer is graded by the backend and
--              recorded once. Scores are computed from these rows, never from chat prose.
--              Additive only: no existing table or column changes.
-- Rollback:    DROP TABLE IF EXISTS conversation_quiz_items;
--              (and remove the migration row named 025_conversation_quiz_items.sql)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS conversation_quiz_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL,
  child_id            UUID NOT NULL,
  conversation_id     UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  quiz_id             UUID NOT NULL,
  question_no         SMALLINT NOT NULL,
  total_questions     SMALLINT NOT NULL,
  question            TEXT NOT NULL,
  options             JSONB NOT NULL,
  correct_option      VARCHAR(1) NOT NULL,
  status              VARCHAR(16) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'answered', 'skipped', 'abandoned')),
  learner_option      VARCHAR(1) NULL,
  is_correct          BOOLEAN NULL,
  asked_request_id    UUID NULL,
  answered_request_id UUID NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at         TIMESTAMPTZ NULL,
  CONSTRAINT uq_quiz_question UNIQUE (quiz_id, question_no),
  CONSTRAINT fk_quiz_items_child FOREIGN KEY (household_id, child_id)
    REFERENCES child_profiles (household_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_quiz_items_conversation
  ON conversation_quiz_items (conversation_id, created_at DESC);
