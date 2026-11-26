-- ==============================================================================
-- Migration: 027_learner_model.sql
-- Description: Measured learner model behind APPU's personalised teaching.
--   * child_learning_consent: a parent must switch learning tracking on per child
--     (DPDP: verifiable parental consent before processing a child's learning data).
--     Revoking consent deletes the child's learning_events and learner_topic_mastery and
--     keeps a granted = false row, so a parent's "no" is remembered.
--   * learning_events: graded evidence (chat quiz answers, lesson quiz answers,
--     flashcard self-checks) and which lesson modes the child opens. Reports and
--     the learner model are computed from these rows, never from chat prose.
--   * learner_topic_mastery: per-topic rollup (attempts, recent results, status,
--     next review date) the brain reads to adapt how it teaches.
--   Additive only.
-- Rollback: DROP TABLE IF EXISTS learner_topic_mastery, learning_events, child_learning_consent;
--           (and remove the migration row named 027_learner_model.sql)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS child_learning_consent (
  household_id        UUID NOT NULL,
  child_id            UUID NOT NULL,
  granted             BOOLEAN NOT NULL DEFAULT TRUE,
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by_user_id  TEXT NOT NULL,
  policy_version      TEXT NOT NULL,
  PRIMARY KEY (household_id, child_id),
  CONSTRAINT fk_learning_consent_child FOREIGN KEY (household_id, child_id)
    REFERENCES child_profiles (household_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL,
  child_id      UUID NOT NULL,
  source        VARCHAR(16) NOT NULL
                  CHECK (source IN ('chat_quiz', 'lesson_quiz', 'flashcard', 'mode_open')),
  topic_key     TEXT NOT NULL,
  topic         TEXT NOT NULL,
  is_correct    BOOLEAN NULL,
  mode          VARCHAR(16) NULL,
  question      TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_learning_events_child FOREIGN KEY (household_id, child_id)
    REFERENCES child_profiles (household_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learning_events_child
  ON learning_events (household_id, child_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learner_topic_mastery (
  household_id    UUID NOT NULL,
  child_id        UUID NOT NULL,
  topic_key       TEXT NOT NULL,
  topic           TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  correct         INTEGER NOT NULL DEFAULT 0,
  recent          TEXT NOT NULL DEFAULT '',
  status          VARCHAR(16) NOT NULL DEFAULT 'starting'
                    CHECK (status IN ('starting', 'practising', 'secure', 'mastered')),
  last_mistake    TEXT NULL,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_review_at  TIMESTAMPTZ NULL,
  PRIMARY KEY (household_id, child_id, topic_key),
  CONSTRAINT fk_topic_mastery_child FOREIGN KEY (household_id, child_id)
    REFERENCES child_profiles (household_id, id) ON DELETE CASCADE
);
