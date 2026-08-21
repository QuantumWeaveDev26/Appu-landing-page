-- ==============================================================================
-- Migration: 007_child_fk_and_idempotency_fingerprint.sql
-- Description: Restore tenant-safe child composite FK with partial SET NULL
--              and add request fingerprint column for idempotency hardening.
-- ==============================================================================

-- 1. Add request fingerprint column for idempotency hardening.
-- Prevents a client from reusing an idempotency key for a logically different
-- request (different child, message, or language).
-- The fingerprint is a SHA-256 hex digest of deterministic request fields
-- computed server-side. NULL for records created before this migration.
ALTER TABLE usage_records
ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(64);

-- 2. Restore tenant-safe composite child FK with partial SET NULL (PostgreSQL 15+).
-- Migration 006 replaced the original composite FK with a single-column FK
-- (child_id REFERENCES child_profiles(id) ON DELETE SET NULL) which removed
-- the database-level invariant that usage_records.child_id belongs to the
-- same household as usage_records.household_id.
--
-- This restores the composite FK using PostgreSQL 15+ partial SET NULL syntax:
-- ON DELETE SET NULL (child_id)
-- This sets ONLY child_id to NULL on child deletion, preserving household_id.
ALTER TABLE usage_records
DROP CONSTRAINT IF EXISTS fk_usage_records_child;

ALTER TABLE usage_records
ADD CONSTRAINT fk_usage_records_child
FOREIGN KEY (household_id, child_id)
REFERENCES child_profiles(household_id, id)
ON DELETE SET NULL (child_id);
