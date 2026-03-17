
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Table 1: user_account
CREATE TABLE public.user_account (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  employee_id TEXT,
  email TEXT UNIQUE NOT NULL,
  role_status BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table 2: role_master
CREATE TABLE public.role_master (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL,
  role_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table 3: permission_master
CREATE TABLE public.permission_master (
  permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_name TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT
);

-- Table 4: role_permission (junction)
CREATE TABLE public.role_permission (
  role_id UUID NOT NULL REFERENCES public.role_master(role_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permission_master(permission_id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Table 5: user_role (junction)
CREATE TABLE public.user_role (
  user_id UUID NOT NULL REFERENCES public.user_account(user_id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.role_master(role_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Enable RLS on all tables
ALTER TABLE public.user_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role ur
    JOIN public.role_master rm ON ur.role_id = rm.role_id
    WHERE ur.user_id = _user_id
      AND rm.role_name = _role::text
  )
$$;

-- RLS Policies: Authenticated users can read all tables
CREATE POLICY "Authenticated users can read user_account" ON public.user_account FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read role_master" ON public.role_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read permission_master" ON public.permission_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read role_permission" ON public.role_permission FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read user_role" ON public.user_role FOR SELECT TO authenticated USING (true);

-- Write policies for role_master (authenticated users can insert/update/delete for now)
CREATE POLICY "Authenticated users can insert role_master" ON public.role_master FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update role_master" ON public.role_master FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete role_master" ON public.role_master FOR DELETE TO authenticated USING (true);

-- Write policies for permission_master
CREATE POLICY "Authenticated users can insert permission_master" ON public.permission_master FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update permission_master" ON public.permission_master FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete permission_master" ON public.permission_master FOR DELETE TO authenticated USING (true);

-- Write policies for role_permission
CREATE POLICY "Authenticated users can insert role_permission" ON public.role_permission FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete role_permission" ON public.role_permission FOR DELETE TO authenticated USING (true);

-- Write policies for user_role
CREATE POLICY "Authenticated users can insert user_role" ON public.user_role FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete user_role" ON public.user_role FOR DELETE TO authenticated USING (true);

-- Write policies for user_account
CREATE POLICY "Authenticated users can insert user_account" ON public.user_account FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update user_account" ON public.user_account FOR UPDATE TO authenticated USING (true);
