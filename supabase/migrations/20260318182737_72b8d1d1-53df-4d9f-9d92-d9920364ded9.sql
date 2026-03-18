
-- Create DH status enum
CREATE TYPE public.dh_status AS ENUM ('ACTIVE', 'INACTIVE');

-- Create agent status enum  
CREATE TYPE public.agent_status AS ENUM ('ACTIVE', 'INACTIVE');

-- Create distribution_houses table
CREATE TABLE public.distribution_houses (
  dh_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dh_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  district_id UUID REFERENCES public.districts(district_id),
  area_id UUID REFERENCES public.areas(area_id),
  last_assigned_at TIMESTAMP WITH TIME ZONE,
  status public.dh_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.distribution_houses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON public.distribution_houses FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.distribution_houses FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.distribution_houses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.distribution_houses FOR DELETE USING (true);

CREATE TRIGGER update_distribution_houses_updated_at
  BEFORE UPDATE ON public.distribution_houses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create field_agents table
CREATE TABLE public.field_agents (
  agent_id TEXT NOT NULL UNIQUE PRIMARY KEY,
  dh_id UUID REFERENCES public.distribution_houses(dh_id) NOT NULL,
  agent_name TEXT NOT NULL,
  msisdn TEXT NOT NULL UNIQUE,
  status public.agent_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.field_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON public.field_agents FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.field_agents FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.field_agents FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.field_agents FOR DELETE USING (true);

CREATE TRIGGER update_field_agents_updated_at
  BEFORE UPDATE ON public.field_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create kams table
CREATE TABLE public.kams (
  kam_id TEXT NOT NULL UNIQUE PRIMARY KEY,
  name TEXT NOT NULL,
  msisdn TEXT NOT NULL,
  assigned_segments TEXT[] NOT NULL DEFAULT '{}',
  status public.agent_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON public.kams FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.kams FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.kams FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.kams FOR DELETE USING (true);

CREATE TRIGGER update_kams_updated_at
  BEFORE UPDATE ON public.kams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_assisted to channels
ALTER TABLE public.channels ADD COLUMN is_assisted BOOLEAN NOT NULL DEFAULT false;

-- Extend order_status enum with new statuses
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'CONTACTED';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'NETWORK_TEST';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'INSTALLED';
