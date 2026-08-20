-- ==============================================================================
-- Migration: 001_initial_tenancy.sql
-- Description: Milestone 2A - PostgreSQL Household Tenancy Foundation
-- Authority: Household is the primary tenant root.
-- ==============================================================================

-- 1. Households Table (Tenant Root)
-- A household is the primary tenant boundary for parent accounts and child profiles.
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Household Members Table
-- Connects authenticated user identities to households with explicit roles.
CREATE TABLE household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'PARENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce unique membership per household/user pair
    CONSTRAINT uq_household_member UNIQUE (household_id, user_id)
);

CREATE INDEX idx_household_members_household_id ON household_members(household_id);
CREATE INDEX idx_household_members_user_id ON household_members(user_id);

-- 3. Child Profiles Table
-- Foundational child identity and tenancy boundary.
CREATE TABLE child_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    preferred_name VARCHAR(100) NOT NULL,
    grade_band VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Composite unique constraint: guarantees (household_id, id) can be referenced
    -- by composite foreign keys in future tables (e.g. conversation_sessions)
    -- preventing cross-household data association at database level.
    CONSTRAINT uq_child_profiles_household_id UNIQUE (household_id, id)
);

CREATE INDEX idx_child_profiles_household_id ON child_profiles(household_id);
