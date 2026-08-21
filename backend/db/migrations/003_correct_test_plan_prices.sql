-- ==============================================================================
-- Migration: 003_correct_test_plan_prices.sql
-- Description: Correct test plan prices to align with Razorpay TEST plan amounts
-- Starter: ₹299/month (29900 paise)
-- Growth:  ₹599/month (59900 paise)
-- Family:  ₹999/month (99900 paise)
-- ==============================================================================

UPDATE plans
SET amount_paise = 29900,
    updated_at = NOW()
WHERE code = 'starter';

UPDATE plans
SET amount_paise = 59900,
    updated_at = NOW()
WHERE code = 'growth';

UPDATE plans
SET amount_paise = 99900,
    updated_at = NOW()
WHERE code = 'family';
