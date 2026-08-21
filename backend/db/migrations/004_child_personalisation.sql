-- ==============================================================================
-- Migration: 004_child_personalisation.sql
-- Description: Milestone 4 - Child Personalisation Persistence
-- ==============================================================================

-- 1. Child Personalisation Table
CREATE TABLE child_personalisation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    child_id UUID NOT NULL,
    preferred_language VARCHAR(20) NOT NULL DEFAULT 'en',
    favorite_color VARCHAR(30),
    font_preference VARCHAR(30) NOT NULL DEFAULT 'friendly' CHECK (font_preference IN ('friendly', 'rounded', 'clean')),
    learning_style VARCHAR(50) NOT NULL DEFAULT 'visual' CHECK (learning_style IN ('visual', 'auditory', 'kinesthetic', 'reading_writing', 'interactive')),
    interests JSONB NOT NULL DEFAULT '[]'::jsonb,
    favorite_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
    goals JSONB NOT NULL DEFAULT '[]'::jsonb,
    response_style VARCHAR(30) NOT NULL DEFAULT 'playful' CHECK (response_style IN ('playful', 'balanced', 'focused')),
    voice_preference VARCHAR(50) NOT NULL DEFAULT 'default',
    theme_preference VARCHAR(30) NOT NULL DEFAULT 'auto' CHECK (theme_preference IN ('auto', 'bright', 'calm')),
    additional_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Composite tenant-safe foreign key referencing child_profiles (household_id, id)
    CONSTRAINT fk_child_personalisation_child FOREIGN KEY (household_id, child_id) REFERENCES child_profiles(household_id, id) ON DELETE CASCADE,
    -- Exactly one personalisation record per child in household
    CONSTRAINT uq_child_personalisation UNIQUE (household_id, child_id)
);

CREATE INDEX idx_child_personalisation_household_id ON child_personalisation(household_id);
CREATE INDEX idx_child_personalisation_child_id ON child_personalisation(child_id);
