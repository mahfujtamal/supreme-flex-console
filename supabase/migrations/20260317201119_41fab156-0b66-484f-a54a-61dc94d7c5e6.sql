
-- Enums
CREATE TYPE public.account_status AS ENUM ('ACTIVE', 'EXPIRED', 'CHURNED');
CREATE TYPE public.service_status AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE public.invoice_trigger_type AS ENUM ('ACQUISITION', 'CPE_CHANGE', 'PHYSICAL_ADDON');
CREATE TYPE public.invoice_payment_status AS ENUM ('PENDING', 'PAID');

-- Customers table
CREATE TABLE public.customers (
  customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  contact_msisdn TEXT NOT NULL UNIQUE,
  customer_type TEXT NOT NULL DEFAULT 'B2C',
  account_status public.account_status NOT NULL DEFAULT 'ACTIVE',
  joined_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON public.customers FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.customers FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.customers FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.customers FOR DELETE TO public USING (true);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Active Services table
CREATE TABLE public.active_services (
  service_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_category TEXT NOT NULL DEFAULT 'WIFI_PLAN',
  activation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  validity_days INTEGER NOT NULL DEFAULT 30,
  expiry_date TIMESTAMPTZ,
  current_cpe_inventory_id UUID REFERENCES public.inventory_master(inventory_id),
  service_status public.service_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.active_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON public.active_services FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.active_services FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.active_services FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.active_services FOR DELETE TO public USING (true);

CREATE TRIGGER update_active_services_updated_at BEFORE UPDATE ON public.active_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- One-Time Invoices table
CREATE TABLE public.onetime_invoices (
  invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  trigger_type public.invoice_trigger_type NOT NULL,
  charged_amount_bdt NUMERIC NOT NULL DEFAULT 0,
  payment_status public.invoice_payment_status NOT NULL DEFAULT 'PENDING',
  parent_summary_invoice_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onetime_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON public.onetime_invoices FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.onetime_invoices FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.onetime_invoices FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.onetime_invoices FOR DELETE TO public USING (true);
