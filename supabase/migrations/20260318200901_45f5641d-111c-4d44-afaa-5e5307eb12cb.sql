
-- Create billing frequency enum
CREATE TYPE public.billing_frequency AS ENUM ('ONE_TIME', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- Add billing_frequency column to products with sensible default
ALTER TABLE public.products
  ADD COLUMN billing_frequency public.billing_frequency NOT NULL DEFAULT 'MONTHLY';

-- Backfill: set ONE_TIME products to ONE_TIME frequency
UPDATE public.products SET billing_frequency = 'ONE_TIME' WHERE billing_type = 'ONE_TIME';
