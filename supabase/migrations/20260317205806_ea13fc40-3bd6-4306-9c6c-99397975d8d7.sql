
-- Create replacement_reason enum
CREATE TYPE public.replacement_reason AS ENUM ('WARRANTY', 'PAID', 'UPGRADE');

-- Create asset_replacement_history table
CREATE TABLE public.asset_replacement_history (
  replacement_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  old_asset_id UUID NOT NULL REFERENCES public.customer_assets(asset_id) ON DELETE CASCADE,
  new_asset_id UUID NOT NULL REFERENCES public.customer_assets(asset_id) ON DELETE CASCADE,
  anchor_id UUID NOT NULL REFERENCES public.anchors(anchor_id) ON DELETE CASCADE,
  reason public.replacement_reason NOT NULL,
  charge_amount_bdt NUMERIC NOT NULL DEFAULT 0,
  replaced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.asset_replacement_history ENABLE ROW LEVEL SECURITY;

-- Dev mode open policies
CREATE POLICY "dev_full_select" ON public.asset_replacement_history FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.asset_replacement_history FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.asset_replacement_history FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.asset_replacement_history FOR DELETE USING (true);
