
-- Create action_type enum
CREATE TYPE public.audit_action_type AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'BULK_IMPORT', 'STATUS_CHANGE');

-- Admin Roles table
CREATE TABLE public.admin_roles (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select admin_roles" ON public.admin_roles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert admin_roles" ON public.admin_roles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update admin_roles" ON public.admin_roles FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete admin_roles" ON public.admin_roles FOR DELETE TO anon, authenticated USING (true);

-- Admin Users table
CREATE TABLE public.admin_users (
  admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role_id UUID REFERENCES public.admin_roles(role_id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select admin_users" ON public.admin_users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert admin_users" ON public.admin_users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update admin_users" ON public.admin_users FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow all delete admin_users" ON public.admin_users FOR DELETE TO anon, authenticated USING (true);

-- Audit Logs table
CREATE TABLE public.audit_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.admin_users(admin_id) ON DELETE SET NULL,
  action_type public.audit_action_type NOT NULL,
  target_table TEXT NOT NULL,
  target_record_id UUID NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select audit_logs" ON public.audit_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert audit_logs" ON public.audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
