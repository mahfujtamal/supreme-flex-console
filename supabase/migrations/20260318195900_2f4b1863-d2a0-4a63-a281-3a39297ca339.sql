
ALTER TABLE public.orders
  ADD COLUMN channel_id uuid REFERENCES public.channels(channel_id),
  ADD COLUMN sub_channel_id uuid REFERENCES public.sub_channels(sub_channel_id);
