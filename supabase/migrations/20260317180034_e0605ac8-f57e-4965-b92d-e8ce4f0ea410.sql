
-- New enums
CREATE TYPE public.reward_status AS ENUM ('PENDING_ACTIVATION', 'REWARD_APPLIED', 'FAILED');
CREATE TYPE public.referrer_product_type AS ENUM ('WIFI_PLAN', 'ADDON', 'BOTH');

-- Coupons table
CREATE TABLE public.coupons (
  coupon_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaign_master(campaign_id) ON DELETE CASCADE,
  coupon_code TEXT NOT NULL UNIQUE,
  status BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  max_uses_per_customer INTEGER NOT NULL DEFAULT -1,
  global_usage_limit INTEGER NOT NULL DEFAULT -1,
  current_global_uses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select coupons" ON public.coupons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert coupons" ON public.coupons FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update coupons" ON public.coupons FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete coupons" ON public.coupons FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Referral programs table
CREATE TABLE public.referral_programs (
  referral_program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL UNIQUE REFERENCES public.campaign_master(campaign_id) ON DELETE CASCADE,
  max_referrals_per_customer INTEGER NOT NULL DEFAULT -1,
  global_referral_limit INTEGER NOT NULL DEFAULT -1,
  current_global_referrals INTEGER NOT NULL DEFAULT 0,
  referrer_discount_type public.discount_type NOT NULL,
  referrer_discount_value NUMERIC NOT NULL,
  referrer_reward_duration_months INTEGER NOT NULL,
  referrer_applicable_product_type public.referrer_product_type NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select referral_programs" ON public.referral_programs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert referral_programs" ON public.referral_programs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update referral_programs" ON public.referral_programs FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete referral_programs" ON public.referral_programs FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER update_referral_programs_updated_at BEFORE UPDATE ON public.referral_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Customer referral codes (backend only)
CREATE TABLE public.customer_referral_codes (
  code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_id TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select crc" ON public.customer_referral_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert crc" ON public.customer_referral_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update crc" ON public.customer_referral_codes FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete crc" ON public.customer_referral_codes FOR DELETE TO anon, authenticated USING (true);

-- Referral usage history (backend only)
CREATE TABLE public.referral_usage_history (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_program_id UUID NOT NULL REFERENCES public.referral_programs(referral_program_id) ON DELETE CASCADE,
  referrer_anchor_id TEXT NOT NULL,
  referee_order_id TEXT NOT NULL,
  reward_status public.reward_status NOT NULL DEFAULT 'PENDING_ACTIVATION',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_usage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select ruh" ON public.referral_usage_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert ruh" ON public.referral_usage_history FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update ruh" ON public.referral_usage_history FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete ruh" ON public.referral_usage_history FOR DELETE TO anon, authenticated USING (true);
