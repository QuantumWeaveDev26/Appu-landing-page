-- ==============================================================================
-- Migration: 011_appu_request_lifecycle.sql
-- Description: Durable APPU downstream request lifecycle and idempotency boundary
--
-- Additive and backwards-compatible: existing usage records are unchanged.
-- Rollback (before any dependent migration): DROP TABLE appu_requests;
-- then DROP CONSTRAINT uq_usage_records_household_id_id from usage_records.
-- ==============================================================================

-- Composite target used to prove that a lifecycle row and its usage reservation
-- belong to the same household at the database boundary.
ALTER TABLE usage_records
ADD CONSTRAINT uq_usage_records_household_id_id UNIQUE (household_id, id);

CREATE TABLE appu_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('authenticated', 'guest')),
    household_id UUID,
    subscription_id UUID,
    guest_session_id VARCHAR(64),
    usage_record_id UUID,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'SUCCEEDED',
        'DEFINITE_FAILURE',
        'UNKNOWN'
    )),
    downstream_execution_id VARCHAR(255),
    failure_code VARCHAR(100),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_appu_requests_household
        FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appu_requests_subscription
        FOREIGN KEY (household_id, subscription_id)
        REFERENCES subscriptions(household_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_appu_requests_usage_record
        FOREIGN KEY (household_id, usage_record_id)
        REFERENCES usage_records(household_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_appu_requests_guest_session
        FOREIGN KEY (guest_session_id) REFERENCES guest_sessions(id) ON DELETE RESTRICT,
    CONSTRAINT ck_appu_requests_actor_scope CHECK (
        (
            actor_type = 'authenticated'
            AND household_id IS NOT NULL
            AND subscription_id IS NOT NULL
            AND usage_record_id IS NOT NULL
            AND guest_session_id IS NULL
        )
        OR
        (
            actor_type = 'guest'
            AND household_id IS NULL
            AND subscription_id IS NULL
            AND usage_record_id IS NULL
            AND guest_session_id IS NOT NULL
        )
    )
);

-- PostgreSQL treats NULL values as distinct in ordinary UNIQUE constraints, so
-- actor-specific partial indexes are required for deterministic tenant scoping.
CREATE UNIQUE INDEX uq_appu_requests_authenticated_idempotency
ON appu_requests (household_id, idempotency_key)
WHERE actor_type = 'authenticated';

CREATE UNIQUE INDEX uq_appu_requests_guest_idempotency
ON appu_requests (guest_session_id, idempotency_key)
WHERE actor_type = 'guest';

CREATE INDEX idx_appu_requests_status_updated
ON appu_requests (status, updated_at);

CREATE INDEX idx_appu_requests_usage_record
ON appu_requests (household_id, usage_record_id)
WHERE usage_record_id IS NOT NULL;

