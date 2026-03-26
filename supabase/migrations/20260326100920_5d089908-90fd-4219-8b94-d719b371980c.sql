
-- 1. Create fulfillment_status enum
CREATE TYPE public.fulfillment_status AS ENUM (
  'PAID_AWAITING_INSTALLATION',
  'PROVISIONAL',
  'EARNED',
  'CANCELLED',
  'REFUNDED'
);

-- 2. Add fulfillment tracking to orders
ALTER TABLE public.orders 
  ADD COLUMN fulfillment_status public.fulfillment_status DEFAULT 'PAID_AWAITING_INSTALLATION',
  ADD COLUMN price_snapshot_date TIMESTAMPTZ;

-- 3. Add price-anchor columns to order_items
ALTER TABLE public.order_items
  ADD COLUMN price_anchor_type TEXT NOT NULL DEFAULT 'REQUEST_DATE',
  ADD COLUMN price_locked_at TIMESTAMPTZ,
  ADD COLUMN locked_unit_price_bdt NUMERIC DEFAULT 0,
  ADD COLUMN fulfillment_date TIMESTAMPTZ,
  ADD COLUMN item_fulfillment_status public.fulfillment_status DEFAULT 'PROVISIONAL';

-- 4. Add refund tracking to onetime_invoices
ALTER TABLE public.onetime_invoices
  ADD COLUMN refund_amount_bdt NUMERIC DEFAULT 0,
  ADD COLUMN refunded_at TIMESTAMPTZ,
  ADD COLUMN refund_reason TEXT;
