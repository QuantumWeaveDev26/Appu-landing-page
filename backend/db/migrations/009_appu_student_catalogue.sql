-- ==============================================================================
-- Migration: 009_appu_student_catalogue.sql
-- Description: HR-Approved APPU AI Student Pricing & Product Tier Catalogue
-- ==============================================================================

-- 1. Extend plans table with tier and display metadata
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tier_code VARCHAR(50);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tier_name VARCHAR(100);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS annual_savings_paise INT NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS monthly_equivalent_paise INT NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_primary_card BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS checkout_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS cta_text VARCHAR(100);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS cta_action VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_plans_tier_code ON plans(tier_code);
CREATE INDEX IF NOT EXISTS idx_plans_is_public ON plans(is_public);

-- 2. Deactivate temporary test fixture plans while preserving historical FK rows
UPDATE plans
SET is_active = FALSE,
    is_public = FALSE,
    updated_at = NOW()
WHERE code IN ('starter', 'growth', 'family');

-- 3. Seed/Upsert the Approved APPU Student Product Catalogue

-- 3.1 APPU FREE
INSERT INTO plans (
    code, tier_code, tier_name, name, description, currency, amount_paise,
    billing_interval, annual_savings_paise, monthly_equivalent_paise,
    is_active, is_public, is_primary_card, is_recommended, checkout_enabled,
    display_order, cta_text, cta_action, provider_plan_id
) VALUES (
    'free', 'free', 'APPU Free', 'APPU Free',
    'Basic AI discovery and essential learning for every student.',
    'INR', 0, 'monthly', 0, 0,
    TRUE, TRUE, TRUE, FALSE, TRUE,
    1, 'Start Free', 'free_checkout', NULL
) ON CONFLICT (code) DO UPDATE SET
    tier_code = EXCLUDED.tier_code,
    tier_name = EXCLUDED.tier_name,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    amount_paise = EXCLUDED.amount_paise,
    billing_interval = EXCLUDED.billing_interval,
    annual_savings_paise = EXCLUDED.annual_savings_paise,
    monthly_equivalent_paise = EXCLUDED.monthly_equivalent_paise,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    is_primary_card = EXCLUDED.is_primary_card,
    is_recommended = EXCLUDED.is_recommended,
    checkout_enabled = EXCLUDED.checkout_enabled,
    display_order = EXCLUDED.display_order,
    cta_text = EXCLUDED.cta_text,
    cta_action = EXCLUDED.cta_action,
    updated_at = NOW();

-- 3.2 APPU EVOLVE (Monthly & Annual)
INSERT INTO plans (
    code, tier_code, tier_name, name, description, currency, amount_paise,
    billing_interval, annual_savings_paise, monthly_equivalent_paise,
    is_active, is_public, is_primary_card, is_recommended, checkout_enabled,
    display_order, cta_text, cta_action, provider_plan_id
) VALUES (
    'evolve_monthly', 'evolve', 'APPU Evolve', 'APPU Evolve Monthly',
    'Persistent learner profile, adaptive learning paths, storytelling, and weekly missions.',
    'INR', 49900, 'monthly', 0, 49900,
    TRUE, TRUE, TRUE, FALSE, TRUE,
    2, 'Choose Evolve', 'checkout', NULL
) ON CONFLICT (code) DO UPDATE SET
    tier_code = EXCLUDED.tier_code,
    tier_name = EXCLUDED.tier_name,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    amount_paise = EXCLUDED.amount_paise,
    billing_interval = EXCLUDED.billing_interval,
    annual_savings_paise = EXCLUDED.annual_savings_paise,
    monthly_equivalent_paise = EXCLUDED.monthly_equivalent_paise,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    is_primary_card = EXCLUDED.is_primary_card,
    is_recommended = EXCLUDED.is_recommended,
    checkout_enabled = EXCLUDED.checkout_enabled,
    display_order = EXCLUDED.display_order,
    cta_text = EXCLUDED.cta_text,
    cta_action = EXCLUDED.cta_action,
    updated_at = NOW();

INSERT INTO plans (
    code, tier_code, tier_name, name, description, currency, amount_paise,
    billing_interval, annual_savings_paise, monthly_equivalent_paise,
    is_active, is_public, is_primary_card, is_recommended, checkout_enabled,
    display_order, cta_text, cta_action, provider_plan_id
) VALUES (
    'evolve_annual', 'evolve', 'APPU Evolve', 'APPU Evolve Annual',
    'Persistent learner profile, adaptive learning paths, storytelling, and weekly missions.',
    'INR', 499900, 'yearly', 98900, 41700,
    TRUE, TRUE, TRUE, FALSE, TRUE,
    2, 'Choose Evolve', 'checkout', NULL
) ON CONFLICT (code) DO UPDATE SET
    tier_code = EXCLUDED.tier_code,
    tier_name = EXCLUDED.tier_name,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    amount_paise = EXCLUDED.amount_paise,
    billing_interval = EXCLUDED.billing_interval,
    annual_savings_paise = EXCLUDED.annual_savings_paise,
    monthly_equivalent_paise = EXCLUDED.monthly_equivalent_paise,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    is_primary_card = EXCLUDED.is_primary_card,
    is_recommended = EXCLUDED.is_recommended,
    checkout_enabled = EXCLUDED.checkout_enabled,
    display_order = EXCLUDED.display_order,
    cta_text = EXCLUDED.cta_text,
    cta_action = EXCLUDED.cta_action,
    updated_at = NOW();

-- 3.3 APPU EVOLVE+ (Monthly & Annual - Most Popular / Recommended)
INSERT INTO plans (
    code, tier_code, tier_name, name, description, currency, amount_paise,
    billing_interval, annual_savings_paise, monthly_equivalent_paise,
    is_active, is_public, is_primary_card, is_recommended, checkout_enabled,
    display_order, cta_text, cta_action, provider_plan_id
) VALUES (
    'evolve_plus_monthly', 'evolve_plus', 'APPU Evolve+', 'APPU Evolve+ Monthly',
    'Advanced personalisation, strength identification, gap detection, goal journeys, and parent insights.',
    'INR', 99900, 'monthly', 0, 99900,
    TRUE, TRUE, TRUE, TRUE, TRUE,
    3, 'Choose Evolve+', 'checkout', NULL
) ON CONFLICT (code) DO UPDATE SET
    tier_code = EXCLUDED.tier_code,
    tier_name = EXCLUDED.tier_name,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    amount_paise = EXCLUDED.amount_paise,
    billing_interval = EXCLUDED.billing_interval,
    annual_savings_paise = EXCLUDED.annual_savings_paise,
    monthly_equivalent_paise = EXCLUDED.monthly_equivalent_paise,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    is_primary_card = EXCLUDED.is_primary_card,
    is_recommended = EXCLUDED.is_recommended,
    checkout_enabled = EXCLUDED.checkout_enabled,
    display_order = EXCLUDED.display_order,
    cta_text = EXCLUDED.cta_text,
    cta_action = EXCLUDED.cta_action,
    updated_at = NOW();

INSERT INTO plans (
    code, tier_code, tier_name, name, description, currency, amount_paise,
    billing_interval, annual_savings_paise, monthly_equivalent_paise,
    is_active, is_public, is_primary_card, is_recommended, checkout_enabled,
    display_order, cta_text, cta_action, provider_plan_id
) VALUES (
    'evolve_plus_annual', 'evolve_plus', 'APPU Evolve+', 'APPU Evolve+ Annual',
    'Advanced personalisation, strength identification, gap detection, goal journeys, and parent insights.',
    'INR', 999900, 'yearly', 198900, 83300,
    TRUE, TRUE, TRUE, TRUE, TRUE,
    3, 'Choose Evolve+', 'checkout', NULL
) ON CONFLICT (code) DO UPDATE SET
    tier_code = EXCLUDED.tier_code,
    tier_name = EXCLUDED.tier_name,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    amount_paise = EXCLUDED.amount_paise,
    billing_interval = EXCLUDED.billing_interval,
    annual_savings_paise = EXCLUDED.annual_savings_paise,
    monthly_equivalent_paise = EXCLUDED.monthly_equivalent_paise,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    is_primary_card = EXCLUDED.is_primary_card,
    is_recommended = EXCLUDED.is_recommended,
    checkout_enabled = EXCLUDED.checkout_enabled,
    display_order = EXCLUDED.display_order,
    cta_text = EXCLUDED.cta_text,
    cta_action = EXCLUDED.cta_action,
    updated_at = NOW();

-- 3.4 APPU GENESIS (Monthly & Annual - Contextual Upsell)
INSERT INTO plans (
    code, tier_code, tier_name, name, description, currency, amount_paise,
    billing_interval, annual_savings_paise, monthly_equivalent_paise,
    is_active, is_public, is_primary_card, is_recommended, checkout_enabled,
    display_order, cta_text, cta_action, provider_plan_id
) VALUES (
    'genesis_monthly', 'genesis', 'APPU Genesis', 'APPU Genesis Monthly',
    'Deep personalisation onboarding, Learning DNA, custom blueprints, monthly intelligence reports, and priority support.',
    'INR', 249900, 'monthly', 0, 249900,
    TRUE, TRUE, FALSE, FALSE, TRUE,
    4, 'Choose Genesis', 'checkout', NULL
) ON CONFLICT (code) DO UPDATE SET
    tier_code = EXCLUDED.tier_code,
    tier_name = EXCLUDED.tier_name,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    amount_paise = EXCLUDED.amount_paise,
    billing_interval = EXCLUDED.billing_interval,
    annual_savings_paise = EXCLUDED.annual_savings_paise,
    monthly_equivalent_paise = EXCLUDED.monthly_equivalent_paise,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    is_primary_card = EXCLUDED.is_primary_card,
    is_recommended = EXCLUDED.is_recommended,
    checkout_enabled = EXCLUDED.checkout_enabled,
    display_order = EXCLUDED.display_order,
    cta_text = EXCLUDED.cta_text,
    cta_action = EXCLUDED.cta_action,
    updated_at = NOW();

INSERT INTO plans (
    code, tier_code, tier_name, name, description, currency, amount_paise,
    billing_interval, annual_savings_paise, monthly_equivalent_paise,
    is_active, is_public, is_primary_card, is_recommended, checkout_enabled,
    display_order, cta_text, cta_action, provider_plan_id
) VALUES (
    'genesis_annual', 'genesis', 'APPU Genesis', 'APPU Genesis Annual',
    'Deep personalisation onboarding, Learning DNA, custom blueprints, monthly intelligence reports, and priority support.',
    'INR', 2499900, 'yearly', 498900, 208300,
    TRUE, TRUE, FALSE, FALSE, TRUE,
    4, 'Choose Genesis', 'checkout', NULL
) ON CONFLICT (code) DO UPDATE SET
    tier_code = EXCLUDED.tier_code,
    tier_name = EXCLUDED.tier_name,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    amount_paise = EXCLUDED.amount_paise,
    billing_interval = EXCLUDED.billing_interval,
    annual_savings_paise = EXCLUDED.annual_savings_paise,
    monthly_equivalent_paise = EXCLUDED.monthly_equivalent_paise,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    is_primary_card = EXCLUDED.is_primary_card,
    is_recommended = EXCLUDED.is_recommended,
    checkout_enabled = EXCLUDED.checkout_enabled,
    display_order = EXCLUDED.display_order,
    cta_text = EXCLUDED.cta_text,
    cta_action = EXCLUDED.cta_action,
    updated_at = NOW();

-- 3.5 APPU SIGNATURE (Custom Solution - Non-Self-Service)
INSERT INTO plans (
    code, tier_code, tier_name, name, description, currency, amount_paise,
    billing_interval, annual_savings_paise, monthly_equivalent_paise,
    is_active, is_public, is_primary_card, is_recommended, checkout_enabled,
    display_order, cta_text, cta_action, provider_plan_id
) VALUES (
    'signature', 'signature', 'APPU Signature', 'APPU Signature',
    'Fully bespoke AI learning architecture tailored for institutions and high-touch private cohorts.',
    'INR', 499900, 'monthly', 0, 499900,
    TRUE, TRUE, TRUE, FALSE, FALSE,
    5, 'Apply for Signature', 'apply', NULL
) ON CONFLICT (code) DO UPDATE SET
    tier_code = EXCLUDED.tier_code,
    tier_name = EXCLUDED.tier_name,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    amount_paise = EXCLUDED.amount_paise,
    billing_interval = EXCLUDED.billing_interval,
    annual_savings_paise = EXCLUDED.annual_savings_paise,
    monthly_equivalent_paise = EXCLUDED.monthly_equivalent_paise,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    is_primary_card = EXCLUDED.is_primary_card,
    is_recommended = EXCLUDED.is_recommended,
    checkout_enabled = EXCLUDED.checkout_enabled,
    display_order = EXCLUDED.display_order,
    cta_text = EXCLUDED.cta_text,
    cta_action = EXCLUDED.cta_action,
    updated_at = NOW();

-- 4. Seed Plan Entitlements (All Student Plans enforce max_children = 1)

-- 4.1 FREE Entitlements
INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'max_children', 'integer', '1'::jsonb FROM plans WHERE code = 'free'
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'monthly_ai_sessions', 'integer', '20'::jsonb FROM plans WHERE code = 'free'
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'monthly_voice_minutes', 'integer', '5'::jsonb FROM plans WHERE code = 'free'
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'basic_discovery', 'boolean', 'true'::jsonb FROM plans WHERE code = 'free'
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'multilingual', 'boolean', 'false'::jsonb FROM plans WHERE code = 'free'
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'advanced_personalisation', 'boolean', 'false'::jsonb FROM plans WHERE code = 'free'
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

-- 4.2 EVOLVE Entitlements (Monthly & Annual share identical entitlements)
INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'max_children', 'integer', '1'::jsonb FROM plans WHERE code IN ('evolve_monthly', 'evolve_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'monthly_ai_sessions', 'integer', '150'::jsonb FROM plans WHERE code IN ('evolve_monthly', 'evolve_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'monthly_voice_minutes', 'integer', '45'::jsonb FROM plans WHERE code IN ('evolve_monthly', 'evolve_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'multilingual', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('evolve_monthly', 'evolve_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'persistent_learner_profile', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('evolve_monthly', 'evolve_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'adaptive_learning_paths', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('evolve_monthly', 'evolve_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'advanced_personalisation', 'boolean', 'false'::jsonb FROM plans WHERE code IN ('evolve_monthly', 'evolve_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

-- 4.3 EVOLVE+ Entitlements (Monthly & Annual share identical entitlements)
INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'max_children', 'integer', '1'::jsonb FROM plans WHERE code IN ('evolve_plus_monthly', 'evolve_plus_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'monthly_ai_sessions', 'integer', '400'::jsonb FROM plans WHERE code IN ('evolve_plus_monthly', 'evolve_plus_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'monthly_voice_minutes', 'integer', '120'::jsonb FROM plans WHERE code IN ('evolve_plus_monthly', 'evolve_plus_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'multilingual', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('evolve_plus_monthly', 'evolve_plus_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'persistent_learner_profile', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('evolve_plus_monthly', 'evolve_plus_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'adaptive_learning_paths', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('evolve_plus_monthly', 'evolve_plus_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'advanced_personalisation', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('evolve_plus_monthly', 'evolve_plus_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'parent_insights', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('evolve_plus_monthly', 'evolve_plus_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'advanced_progress_intelligence', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('evolve_plus_monthly', 'evolve_plus_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

-- 4.4 GENESIS Entitlements (Monthly & Annual share identical entitlements)
INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'max_children', 'integer', '1'::jsonb FROM plans WHERE code IN ('genesis_monthly', 'genesis_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'monthly_ai_sessions', 'integer', '1000'::jsonb FROM plans WHERE code IN ('genesis_monthly', 'genesis_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'monthly_voice_minutes', 'integer', '300'::jsonb FROM plans WHERE code IN ('genesis_monthly', 'genesis_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'multilingual', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('genesis_monthly', 'genesis_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'advanced_personalisation', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('genesis_monthly', 'genesis_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'parent_insights', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('genesis_monthly', 'genesis_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'learning_dna', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('genesis_monthly', 'genesis_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'priority_support', 'boolean', 'true'::jsonb FROM plans WHERE code IN ('genesis_monthly', 'genesis_annual')
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

-- 4.5 SIGNATURE Entitlements
INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'max_children', 'integer', '1'::jsonb FROM plans WHERE code = 'signature'
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_entitlements (plan_id, entitlement_key, value_type, value)
SELECT id, 'custom_usage_policy', 'boolean', 'true'::jsonb FROM plans WHERE code = 'signature'
ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value = EXCLUDED.value;
