-- ==============================================================================
-- Migration: 017_child_prompts.sql
-- Description: Stored, personalized prompt recommendations for child profiles
-- ==============================================================================

CREATE TABLE IF NOT EXISTS child_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'quick_concepts',
        'homework_hints',
        'curious_mind',
        'exam_drills'
    )),
    prompt_text TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'fa-lightbulb',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for category-filtered and recency-ordered queries
CREATE INDEX IF NOT EXISTS idx_child_prompts_lookup
  ON child_prompts (household_id, child_id, category, created_at DESC);

-- Composite index for fast batch replacement and household scoping
CREATE INDEX IF NOT EXISTS idx_child_prompts_child
  ON child_prompts (household_id, child_id);
