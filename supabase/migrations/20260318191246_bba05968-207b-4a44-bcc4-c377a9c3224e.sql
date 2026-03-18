
ALTER TABLE public.channels ADD COLUMN is_self_delivered boolean NOT NULL DEFAULT false;

ALTER TABLE public.sub_channels ADD COLUMN override_delivery_ownership boolean NOT NULL DEFAULT false;
