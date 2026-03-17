
-- Enums
CREATE TYPE public.campaign_scope AS ENUM ('ACQ', 'LC', 'BOTH');
CREATE TYPE public.ownership_transfer_behavior AS ENUM ('KEEP', 'REMOVE');
CREATE TYPE public.campaign_trigger_type AS ENUM ('RULE_BASED', 'COUPON_BASED', 'REFERRAL_BASED', 'HYBRID');
CREATE TYPE public.campaign_rule_type AS ENUM ('EXCLUSIVE', 'UNAVAILABLE', 'DISCOUNT');
CREATE TYPE public.discount_type AS ENUM ('FLAT', 'PERCENT');
CREATE TYPE public.campaign_network_type AS ENUM ('4G', '5G', 'ANY');

-- Campaign Master
CREATE TABLE public.campaign_master (
  campaign_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  scope campaign_scope NOT NULL,
  allow_cod_payment BOOLEAN NOT NULL DEFAULT true,
  allow_online_payment BOOLEAN NOT NULL DEFAULT true,
  on_ownership_transfer_behavior ownership_transfer_behavior NOT NULL DEFAULT 'KEEP',
  campaign_trigger_type campaign_trigger_type NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read campaign_master" ON public.campaign_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert campaign_master" ON public.campaign_master FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update campaign_master" ON public.campaign_master FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete campaign_master" ON public.campaign_master FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_campaign_master_updated_at BEFORE UPDATE ON public.campaign_master FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign Targeting Rules
CREATE TABLE public.campaign_targeting_rules (
  rule_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaign_master(campaign_id) ON DELETE CASCADE,
  network_zone_id UUID REFERENCES public.network_zones(network_zone_id),
  district_id UUID REFERENCES public.districts(district_id),
  area_id UUID REFERENCES public.areas(area_id),
  channel_id UUID REFERENCES public.channels(channel_id),
  sub_channel_id UUID REFERENCES public.sub_channels(sub_channel_id),
  network_type campaign_network_type,
  min_network_age_days INTEGER,
  max_network_age_days INTEGER
);

ALTER TABLE public.campaign_targeting_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ctr" ON public.campaign_targeting_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert ctr" ON public.campaign_targeting_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update ctr" ON public.campaign_targeting_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete ctr" ON public.campaign_targeting_rules FOR DELETE TO authenticated USING (true);

-- Campaign Product Rules
CREATE TABLE public.campaign_product_rules (
  rule_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaign_master(campaign_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(product_id),
  rule_type campaign_rule_type NOT NULL,
  discount_type discount_type,
  discount_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_product_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read cpr" ON public.campaign_product_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cpr" ON public.campaign_product_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update cpr" ON public.campaign_product_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete cpr" ON public.campaign_product_rules FOR DELETE TO authenticated USING (true);
