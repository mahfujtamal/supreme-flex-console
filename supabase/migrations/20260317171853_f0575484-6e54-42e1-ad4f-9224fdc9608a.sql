
-- Create enums for product engine
CREATE TYPE public.product_category AS ENUM ('WIFI_PLAN', 'CPE', 'SIM', 'ADDON');
CREATE TYPE public.addon_type AS ENUM ('PHYSICAL', 'DIGITAL');
CREATE TYPE public.billing_type AS ENUM ('ONE_TIME', 'RECURRING');
CREATE TYPE public.network_capability AS ENUM ('4G', '5G', 'BOTH', 'ANY');
CREATE TYPE public.warranty_unit AS ENUM ('DAYS', 'MONTHS', 'YEARS');

-- Products table
CREATE TABLE public.products (
  product_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  product_category public.product_category NOT NULL,
  addon_type public.addon_type,
  billing_type public.billing_type NOT NULL,
  network_capability public.network_capability NOT NULL DEFAULT 'ANY',
  is_exclusive BOOLEAN NOT NULL DEFAULT false,
  serial_required BOOLEAN NOT NULL DEFAULT false,
  warranty_value INTEGER,
  warranty_unit public.warranty_unit,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete products" ON public.products FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Physical addon compatibility
CREATE TABLE public.physical_addon_compatibility (
  compatibility_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  addon_product_id UUID NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  cpe_product_id UUID NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(addon_product_id, cpe_product_id)
);

ALTER TABLE public.physical_addon_compatibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read pac" ON public.physical_addon_compatibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pac" ON public.physical_addon_compatibility FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete pac" ON public.physical_addon_compatibility FOR DELETE TO authenticated USING (true);

-- Product price versions
CREATE TABLE public.product_price_versions (
  price_version_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  base_price_bdt NUMERIC NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_price_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ppv" ON public.product_price_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert ppv" ON public.product_price_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update ppv" ON public.product_price_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete ppv" ON public.product_price_versions FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_ppv_updated_at BEFORE UPDATE ON public.product_price_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
