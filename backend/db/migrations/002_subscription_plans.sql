-- ==============================================================================
-- Migration: 002_subscription_plans.sql
-- Description: Milestone 3 - Plans, Plan Entitlements, Subscriptions & Payment Events
-- ==============================================================================

-- 1. Plans Table
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    amount_paise INT NOT NULL,
    billing_interval VARCHAR(50) NOT NULL DEFAULT 'monthly',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    provider_plan_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_plans_code UNIQUE (code)
);

CREATE INDEX idx_plans_code ON plans(code);
CREATE INDEX idx_plans_is_active ON plans(is_active);

-- 2. Plan Entitlements Table
CREATE TABLE plan_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    entitlement_key VARCHAR(100) NOT NULL,
    value_type VARCHAR(50) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_plan_entitlement UNIQUE (plan_id, entitlement_key)
);

CREATE INDEX idx_plan_entitlements_plan_id ON plan_entitlements(plan_id);

-- 3. Subscriptions Table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    provider_subscription_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'PENDING_PAYMENT',
        'AUTHENTICATED',
        'ACTIVE',
        'PAST_DUE',
        'HALTED',
        'PAUSED',
        'CANCELLED',
        'EXPIRED'
    )),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_household_id ON subscriptions(household_id);
CREATE INDEX idx_subscriptions_provider_subscription_id ON subscriptions(provider_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- 4. Payment Events Table (Audit / Webhook Log)
CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    provider_subscription_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
    payload_summary JSONB,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_events_provider_event_id UNIQUE (provider, provider_event_id)
);

CREATE INDEX idx_payment_events_provider_event_id ON payment_events(provider, provider_event_id);
CREATE INDEX idx_payment_events_subscription_id ON payment_events(subscription_id);

-- 5. Seed Initial Plans and Entitlements
-- Starter Plan (₹499/mo)
INSERT INTO plans (id, code, name, description, currency, amount_paise, billing_interval, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'starter', 'Starter Plan', 'Essential AI mentorship for single learner', 'INR', 49900, 'monthly', TRUE);

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value) VALUES
('00000000-0000-0000-0000-000000000001', 'max_children', 'integer', '1'::jsonb),
('00000000-0000-0000-0000-000000000001', 'monthly_voice_minutes', 'integer', '30'::jsonb),
('00000000-0000-0000-0000-000000000001', 'monthly_ai_sessions', 'integer', '100'::jsonb),
('00000000-0000-0000-0000-000000000001', 'multilingual', 'boolean', 'true'::jsonb),
('00000000-0000-0000-0000-000000000001', 'advanced_personalisation', 'boolean', 'false'::jsonb),
('00000000-0000-0000-0000-000000000001', 'parent_reports', 'boolean', 'false'::jsonb),
('00000000-0000-0000-0000-000000000001', 'long_term_context', 'boolean', 'false'::jsonb),
('00000000-0000-0000-0000-000000000001', 'premium_themes', 'boolean', 'false'::jsonb);

-- Growth Plan (₹999/mo)
INSERT INTO plans (id, code, name, description, currency, amount_paise, billing_interval, is_active)
VALUES ('00000000-0000-0000-0000-000000000002', 'growth', 'Growth Plan', 'Comprehensive AI mentorship with full parent insights', 'INR', 99900, 'monthly', TRUE);

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value) VALUES
('00000000-0000-0000-0000-000000000002', 'max_children', 'integer', '2'::jsonb),
('00000000-0000-0000-0000-000000000002', 'monthly_voice_minutes', 'integer', '90'::jsonb),
('00000000-0000-0000-0000-000000000002', 'monthly_ai_sessions', 'integer', '300'::jsonb),
('00000000-0000-0000-0000-000000000002', 'multilingual', 'boolean', 'true'::jsonb),
('00000000-0000-0000-0000-000000000002', 'advanced_personalisation', 'boolean', 'true'::jsonb),
('00000000-0000-0000-0000-000000000002', 'parent_reports', 'boolean', 'true'::jsonb),
('00000000-0000-0000-0000-000000000002', 'long_term_context', 'boolean', 'true'::jsonb),
('00000000-0000-0000-0000-000000000002', 'premium_themes', 'boolean', 'false'::jsonb);

-- Family Plan (₹1499/mo)
INSERT INTO plans (id, code, name, description, currency, amount_paise, billing_interval, is_active)
VALUES ('00000000-0000-0000-0000-000000000003', 'family', 'Family Plan', 'Unlimited potential for up to 4 children with premium themes', 'INR', 149900, 'monthly', TRUE);

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value) VALUES
('00000000-0000-0000-0000-000000000003', 'max_children', 'integer', '4'::jsonb),
('00000000-0000-0000-0000-000000000003', 'monthly_voice_minutes', 'integer', '200'::jsonb),
('00000000-0000-0000-0000-000000000003', 'monthly_ai_sessions', 'integer', '600'::jsonb),
('00000000-0000-0000-0000-000000000003', 'multilingual', 'boolean', 'true'::jsonb),
('00000000-0000-0000-0000-000000000003', 'advanced_personalisation', 'boolean', 'true'::jsonb),
('00000000-0000-0000-0000-000000000003', 'parent_reports', 'boolean', 'true'::jsonb),
('00000000-0000-0000-0000-000000000003', 'long_term_context', 'boolean', 'true'::jsonb),
('00000000-0000-0000-0000-000000000003', 'premium_themes', 'boolean', 'true'::jsonb);
