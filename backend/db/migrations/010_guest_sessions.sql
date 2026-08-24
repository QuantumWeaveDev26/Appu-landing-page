-- 010_guest_sessions.sql
-- Backend-authoritative guest session and quota tracking for unauthenticated visitors

CREATE TABLE IF NOT EXISTS guest_sessions (
  id VARCHAR(64) PRIMARY KEY,
  ip_hash VARCHAR(64) NOT NULL,
  used_turns INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_ip_hash ON guest_sessions (ip_hash);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires_at ON guest_sessions (expires_at);
