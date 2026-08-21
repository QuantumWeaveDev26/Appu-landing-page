-- ==============================================================================
-- Migration: 006_usage_accounting_hardening.sql
-- Description: Tenant-Safe Subscription Composite FK & Child Delete Hardening
-- ==============================================================================

-- 1. Add composite unique constraint to subscriptions (household_id, id)
-- This allows tenant-safe composite foreign keys referencing subscriptions.
ALTER TABLE subscriptions
ADD CONSTRAINT uq_subscriptions_household_id UNIQUE (household_id, id);

-- 2. Hardening: Replace single-column subscription FK with tenant-safe composite FK
-- Guarantees that usage_records.household_id and usage_records.subscription_id
-- always refer to the EXACT SAME household at the database engine level.
ALTER TABLE usage_records
DROP CONSTRAINT IF EXISTS usage_records_subscription_id_fkey;

ALTER TABLE usage_records
ADD CONSTRAINT fk_usage_records_subscription
FOREIGN KEY (household_id, subscription_id)
REFERENCES subscriptions(household_id, id)
ON DELETE RESTRICT;

-- 3. Hardening: Fix child foreign key deletion behavior
-- When a child profile is deleted, retain historical usage records for the household
-- by setting child_id to NULL without attempting to null household_id (which is NOT NULL).
ALTER TABLE usage_records
DROP CONSTRAINT IF EXISTS fk_usage_records_child;

ALTER TABLE usage_records
ADD CONSTRAINT fk_usage_records_child
FOREIGN KEY (child_id)
REFERENCES child_profiles(id)
ON DELETE SET NULL;
