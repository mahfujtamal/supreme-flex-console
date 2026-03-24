
-- Referral Programs table (versioned, linked to campaign_master)
CREATE TABLE public.referral_programs (
  program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaign_master(campaign_id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  max_referrals_per_customer INTEGER NOT NULL DEFAULT 1,

  -- Referrer reward config
  referrer_product_id UUID REFERENCES public.products(product_id),
  referrer_reward_type TEXT NOT NULL DEFAULT 'CYCLES', -- CYCLES or PURCHASES
  referrer_reward_value INTEGER NOT NULL DEFAULT 1,
  referrer_reward_unit TEXT, -- read-only label from catalog e.g. MONTHS, DAYS

  -- Referee 4-tier matrix stored as JSONB
  -- Array of { product_id, product_name, product_category, addon_type, discount_type, discount_value, applicable_components[] }
  referee_config_matrix JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Referral code prefix (optional)
  referral_code_prefix TEXT,

  -- Lock status
  is_locked BOOLEAN NOT NULL DEFAULT false,

  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_full_select" ON public.referral_programs FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.referral_programs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.referral_programs FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.referral_programs FOR DELETE TO public USING (true);

CREATE TRIGGER set_referral_programs_updated_at
  BEFORE UPDATE ON public.referral_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Referral Redemptions table (bridges referrer, referee, program)
CREATE TABLE public.referral_redemptions (
  redemption_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.referral_programs(program_id) ON DELETE CASCADE,
  referrer_customer_id UUID NOT NULL REFERENCES public.customers(customer_id),
  referee_customer_id UUID NOT NULL REFERENCES public.customers(customer_id),
  referral_code TEXT NOT NULL,
  applied_rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_full_select" ON public.referral_redemptions FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.referral_redemptions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.referral_redemptions FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.referral_redemptions FOR DELETE TO public USING (true);
