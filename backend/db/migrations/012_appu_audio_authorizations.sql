-- ==============================================================================
-- Migration: 012_appu_audio_authorizations.sql
-- Description: Durable server-authorized audio records for decoupled streaming TTS
--
-- Additive and backwards-compatible: existing appu_requests and usage_records unchanged.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS appu_audio_authorizations (
    request_id UUID PRIMARY KEY REFERENCES appu_requests(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    child_id UUID REFERENCES child_profiles(id) ON DELETE CASCADE,
    approved_text TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'kn',
    audio_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (audio_status IN (
        'PENDING',
        'STREAMING',
        'COMPLETED',
        'EXPIRED'
    )),
    stream_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_appu_audio_auth_household_req
ON appu_audio_authorizations(household_id, request_id);

CREATE INDEX IF NOT EXISTS idx_appu_audio_auth_expires
ON appu_audio_authorizations(expires_at);

ALTER TABLE public.appu_audio_authorizations ENABLE ROW LEVEL SECURITY;
