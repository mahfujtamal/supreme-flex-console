
-- Create test_status enum
CREATE TYPE public.test_status AS ENUM ('PENDING', 'SUCCESS', 'FAIL');

-- Create anchors table
CREATE TABLE public.anchors (
  anchor_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  network_zone TEXT,
  district TEXT,
  area TEXT,
  location_tac TEXT,
  coordinates TEXT,
  test_status public.test_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on anchors
ALTER TABLE public.anchors ENABLE ROW LEVEL SECURITY;

-- Dev mode open policies
CREATE POLICY "dev_full_select" ON public.anchors FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.anchors FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.anchors FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.anchors FOR DELETE USING (true);

-- Add anchor_id and cpe_model to active_services
ALTER TABLE public.active_services ADD COLUMN anchor_id UUID REFERENCES public.anchors(anchor_id) ON DELETE SET NULL;
ALTER TABLE public.active_services ADD COLUMN cpe_model TEXT;
