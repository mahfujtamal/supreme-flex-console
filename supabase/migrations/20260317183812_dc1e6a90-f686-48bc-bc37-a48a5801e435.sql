
-- Step 1: Rename columns
ALTER TABLE public.referral_programs
  RENAME COLUMN referrer_reward_duration_months TO referrer_reward_billing_cycles;

ALTER TABLE public.referral_programs
  RENAME COLUMN referrer_applicable_product_type TO referrer_applicable_product_category;

-- Step 2: Create new enum with 5 values
CREATE TYPE public.referrer_product_category AS ENUM ('WIFI_PLAN', 'CPE', 'PHYSICAL_ADDON', 'DIGITAL_ADDON', 'ANY');

-- Step 3: Migrate column to new enum
ALTER TABLE public.referral_programs
  ALTER COLUMN referrer_applicable_product_category DROP DEFAULT,
  ALTER COLUMN referrer_applicable_product_category TYPE public.referrer_product_category
    USING (
      CASE referrer_applicable_product_category::text
        WHEN 'ADDON' THEN 'PHYSICAL_ADDON'
        WHEN 'BOTH' THEN 'ANY'
        ELSE referrer_applicable_product_category::text
      END
    )::public.referrer_product_category;
