
-- Enums for inventory and orders
CREATE TYPE public.inventory_item_type AS ENUM ('CPE', 'SIM', 'ADDON');
CREATE TYPE public.inventory_status AS ENUM ('IN_WAREHOUSE', 'ALLOCATED_TO_DH', 'ALLOCATED_TO_KAM', 'WITH_AGENT', 'DELIVERED', 'DEFECTIVE');
CREATE TYPE public.order_status AS ENUM ('PENDING_DISPATCH', 'OUT_FOR_DELIVERY', 'ACTIVE', 'CANCELLED');
CREATE TYPE public.payment_status AS ENUM ('PENDING_COD', 'PAID_COD', 'ONLINE_PAID');
CREATE TYPE public.customer_type AS ENUM ('B2C', 'B2B');

-- Inventory Master
CREATE TABLE public.inventory_master (
  inventory_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(product_id),
  item_type public.inventory_item_type NOT NULL,
  serial_number TEXT UNIQUE,
  mac_address TEXT UNIQUE,
  msisdn TEXT UNIQUE,
  status public.inventory_status NOT NULL DEFAULT 'IN_WAREHOUSE',
  allocated_entity_id TEXT,
  allocated_agent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select inventory_master" ON public.inventory_master FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert inventory_master" ON public.inventory_master FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update inventory_master" ON public.inventory_master FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete inventory_master" ON public.inventory_master FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER update_inventory_master_updated_at BEFORE UPDATE ON public.inventory_master FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Orders
CREATE TABLE public.orders (
  order_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  contact_msisdn TEXT NOT NULL,
  customer_type public.customer_type NOT NULL DEFAULT 'B2C',
  order_status public.order_status NOT NULL DEFAULT 'PENDING_DISPATCH',
  payment_status public.payment_status NOT NULL DEFAULT 'PENDING_COD',
  assigned_dh_kam_id TEXT,
  assigned_agent_id TEXT,
  final_total_bdt NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select orders" ON public.orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update orders" ON public.orders FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete orders" ON public.orders FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Order Items
CREATE TABLE public.order_items (
  item_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(product_id),
  inventory_id UUID REFERENCES public.inventory_master(inventory_id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_bdt NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select order_items" ON public.order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert order_items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update order_items" ON public.order_items FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete order_items" ON public.order_items FOR DELETE TO anon, authenticated USING (true);
