
-- Create sub_channel_users table (staff layer for assisted channels)
CREATE TABLE public.sub_channel_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_channel_id UUID NOT NULL REFERENCES public.sub_channels(sub_channel_id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  employee_id TEXT NOT NULL UNIQUE,
  msisdn TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Agent',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sub_channel_users ENABLE ROW LEVEL SECURITY;

-- Dev RLS policies
CREATE POLICY "dev_full_select" ON public.sub_channel_users FOR SELECT TO public USING (true);
CREATE POLICY "dev_full_insert" ON public.sub_channel_users FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.sub_channel_users FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.sub_channel_users FOR DELETE TO public USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_sub_channel_users_updated_at
  BEFORE UPDATE ON public.sub_channel_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add staff_user_id to orders for sales agent attribution
ALTER TABLE public.orders ADD COLUMN staff_user_id UUID REFERENCES public.sub_channel_users(id);
