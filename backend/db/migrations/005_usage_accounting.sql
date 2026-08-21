-- ==============================================================================
-- Migration: 005_usage_accounting.sql
-- Description: Phase 2 - Usage Accounting Foundation & AI Quota Enforcement
-- ==============================================================================

-- 1. Usage Records Ledger Table
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
    child_id UUID,
    metric VARCHAR(50) NOT NULL CHECK (metric IN ('ai_sessions', 'voice_seconds')),
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'released')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    idempotency_key VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Tenant-safe composite foreign key referencing child_profiles (household_id, id)
    CONSTRAINT fk_usage_records_child FOREIGN KEY (household_id, child_id) REFERENCES child_profiles(household_id, id) ON DELETE SET NULL,
    -- Idempotency constraint per household, metric, and idempotency_key
    CONSTRAINT uq_usage_records_idempotency UNIQUE (household_id, metric, idempotency_key)
);

CREATE INDEX idx_usage_records_household_metric ON usage_records(household_id, metric, status);
CREATE INDEX idx_usage_records_period ON usage_records(household_id, metric, period_start, period_end, status);
CREATE INDEX idx_usage_records_subscription_id ON usage_records(subscription_id);
CREATE INDEX idx_usage_records_child_id ON usage_records(child_id);
