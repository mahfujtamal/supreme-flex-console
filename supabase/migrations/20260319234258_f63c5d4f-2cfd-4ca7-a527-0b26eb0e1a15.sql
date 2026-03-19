CREATE TABLE public.referee_reward_selections (
  selection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_program_id uuid NOT NULL REFERENCES public.referral_programs(referral_program_id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaign_master(campaign_id) ON DELETE CASCADE,
  referee_anchor_id text NOT NULL,
  referee_order_id text,
  product_id uuid NOT NULL REFERENCES public.products(product_id),
  product_name text NOT NULL,
  product_category text NOT NULL,
  was_selected boolean NOT NULL DEFAULT false,
  discount_type text,
  discount_value numeric DEFAULT 0,
  applicable_components text[] NOT NULL DEFAULT '{}',
  original_price_bdt numeric DEFAULT 0,
  discounted_price_bdt numeric DEFAULT 0,
  savings_bdt numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referee_reward_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_full_select" ON public.referee_reward_selections FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.referee_reward_selections FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.referee_reward_selections FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.referee_reward_selections FOR DELETE TO public USING (true);