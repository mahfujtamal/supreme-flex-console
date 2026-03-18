
-- Create enum for delivery ownership mode
CREATE TYPE public.delivery_ownership_mode AS ENUM ('FOLLOW_CHANNEL', 'SELF_DELIVERY', 'DH_DELIVERY');

-- Add new column with enum type
ALTER TABLE public.sub_channels ADD COLUMN delivery_ownership delivery_ownership_mode NOT NULL DEFAULT 'FOLLOW_CHANNEL';

-- Migrate existing data: if override_delivery_ownership was true, set to SELF_DELIVERY
UPDATE public.sub_channels SET delivery_ownership = 'SELF_DELIVERY' WHERE override_delivery_ownership = true;

-- Drop old boolean column
ALTER TABLE public.sub_channels DROP COLUMN override_delivery_ownership;
