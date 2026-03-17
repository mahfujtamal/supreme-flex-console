
-- Create asset_status enum
CREATE TYPE public.asset_status AS ENUM ('ACTIVE', 'REPLACED', 'RETURNED', 'DEFECTIVE');

-- Create asset_type enum
CREATE TYPE public.asset_type AS ENUM ('CPE', 'SIM', 'PHYSICAL_ADDON');

-- Create customer_assets table
CREATE TABLE public.customer_assets (
  asset_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anchor_id UUID NOT NULL REFERENCES public.anchors(anchor_id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(product_id) ON DELETE RESTRICT,
  serial_number TEXT NOT NULL UNIQUE,
  mac_address TEXT UNIQUE,
  asset_type public.asset_type NOT NULL,
  installation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  warranty_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  warranty_end_date TIMESTAMP WITH TIME ZONE,
  asset_status public.asset_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_assets ENABLE ROW LEVEL SECURITY;

-- Dev mode open policies
CREATE POLICY "dev_full_select" ON public.customer_assets FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.customer_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.customer_assets FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.customer_assets FOR DELETE USING (true);

-- Reuse updated_at trigger
CREATE TRIGGER update_customer_assets_updated_at
  BEFORE UPDATE ON public.customer_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
