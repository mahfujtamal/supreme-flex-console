
-- 1. Price Components table (component-based pricing per price version)
CREATE TABLE public.price_components (
  component_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_version_id UUID NOT NULL REFERENCES public.product_price_versions(price_version_id) ON DELETE CASCADE,
  component_name TEXT NOT NULL, -- 'BASE', 'VAT', 'SD', or custom like 'Surcharge'
  component_type TEXT NOT NULL DEFAULT 'MANDATORY', -- 'MANDATORY' or 'CUSTOM'
  amount_bdt NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON public.price_components FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.price_components FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.price_components FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.price_components FOR DELETE TO public USING (true);

-- 2. Campaign discount mappings (per-component discount breakdown)
CREATE TABLE public.campaign_discount_mappings (
  mapping_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.campaign_product_rules(rule_id) ON DELETE CASCADE,
  component_name TEXT NOT NULL, -- which component this discount applies to
  discount_amount_bdt NUMERIC(12,2) NOT NULL DEFAULT 0, -- resolved absolute BDT discount for this component
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_discount_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON public.campaign_discount_mappings FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.campaign_discount_mappings FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.campaign_discount_mappings FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.campaign_discount_mappings FOR DELETE TO public USING (true);

-- 3. Transaction ledger (immutable price snapshot at fulfillment)
CREATE TABLE public.transaction_ledger (
  ledger_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  order_id UUID,
  anchor_id UUID,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  -- Price breakdown snapshot (JSONB array of {component_name, amount_bdt})
  price_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Discount breakdown snapshot (JSONB array of {component_name, discount_amount_bdt})
  discount_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  campaign_id UUID,
  campaign_name TEXT,
  total_pre_discount_bdt NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_discount_bdt NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_payable_bdt NUMERIC(12,2) NOT NULL DEFAULT 0,
  trigger_type TEXT NOT NULL DEFAULT 'ACQUISITION',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON public.transaction_ledger FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.transaction_ledger FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.transaction_ledger FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.transaction_ledger FOR DELETE TO public USING (true);

-- 4. Add campaign_rank to campaign_master for conflict resolution
ALTER TABLE public.campaign_master ADD COLUMN campaign_rank INTEGER NOT NULL DEFAULT 100;

-- 5. Add applicable_components to campaign_product_rules for % discount targeting
ALTER TABLE public.campaign_product_rules ADD COLUMN applicable_components TEXT[] NOT NULL DEFAULT '{}';
