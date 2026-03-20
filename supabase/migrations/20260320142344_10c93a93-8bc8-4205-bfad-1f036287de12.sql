
-- Drop referral-related tables (order matters for FK constraints)
DROP TABLE IF EXISTS referee_reward_selections CASCADE;
DROP TABLE IF EXISTS referral_usage_history CASCADE;
DROP TABLE IF EXISTS customer_referral_codes CASCADE;
DROP TABLE IF EXISTS referral_programs CASCADE;
