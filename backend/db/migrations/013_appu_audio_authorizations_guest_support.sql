-- ==============================================================================
-- Migration: 013_appu_audio_authorizations_guest_support.sql
-- Description: Durable server-authorized audio records for guest sessions
--
-- Additive and backwards-compatible: existing authenticated authorizations unchanged.
-- ==============================================================================

-- 1. Make household_id nullable to allow guest authorizations
ALTER TABLE appu_audio_authorizations ALTER COLUMN household_id DROP NOT NULL;

-- 2. Add guest_session_id column referencing guest_sessions
ALTER TABLE appu_audio_authorizations
ADD COLUMN IF NOT EXISTS guest_session_id VARCHAR(64) REFERENCES guest_sessions(id) ON DELETE CASCADE;

-- 3. Invariant: exactly one principal per authorization (authenticated household OR guest session)
ALTER TABLE appu_audio_authorizations DROP CONSTRAINT IF EXISTS ck_appu_audio_auth_actor_scope;
ALTER TABLE appu_audio_authorizations
ADD CONSTRAINT ck_appu_audio_auth_actor_scope CHECK (
    (household_id IS NOT NULL AND guest_session_id IS NULL)
    OR
    (household_id IS NULL AND guest_session_id IS NOT NULL)
);

-- 4. Index for guest authorization lookups
CREATE INDEX IF NOT EXISTS idx_appu_audio_auth_guest_req
ON appu_audio_authorizations(guest_session_id, request_id)
WHERE guest_session_id IS NOT NULL;
