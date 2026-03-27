
-- Geography hierarchy tables
CREATE TABLE public.circles (
  circle_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_name TEXT NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.regions (
  region_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_name TEXT NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(circle_id),
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.clusters (
  cluster_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_name TEXT NOT NULL,
  region_id UUID NOT NULL REFERENCES public.regions(region_id),
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.territories (
  territory_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  territory_name TEXT NOT NULL,
  cluster_id UUID NOT NULL REFERENCES public.clusters(cluster_id),
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add territory_id to distribution_houses
ALTER TABLE public.distribution_houses ADD COLUMN territory_id UUID REFERENCES public.territories(territory_id);

-- System audit logs table
CREATE TABLE public.system_audit_logs (
  log_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS with open dev policies
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_full_select" ON public.circles FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.circles FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.circles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.circles FOR DELETE USING (true);

CREATE POLICY "dev_full_select" ON public.regions FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.regions FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.regions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.regions FOR DELETE USING (true);

CREATE POLICY "dev_full_select" ON public.clusters FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.clusters FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.clusters FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.clusters FOR DELETE USING (true);

CREATE POLICY "dev_full_select" ON public.territories FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.territories FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.territories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.territories FOR DELETE USING (true);

CREATE POLICY "dev_full_select" ON public.system_audit_logs FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON public.system_audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON public.system_audit_logs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON public.system_audit_logs FOR DELETE USING (true);

-- Prevent deletion of hub_managers/kams/field_agents with assigned inventory
CREATE OR REPLACE FUNCTION public.prevent_delete_with_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.inventory_master
    WHERE allocated_entity_id = OLD.hub_manager_id::text
       OR allocated_agent_id = OLD.hub_manager_id::text
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this record has inventory assigned. Transfer stock first.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_delete_agent_with_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.inventory_master
    WHERE allocated_agent_id = OLD.agent_id
       OR allocated_entity_id = OLD.agent_id
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this agent has inventory assigned. Transfer stock first.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_delete_kam_with_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.inventory_master
    WHERE allocated_agent_id = OLD.kam_id
       OR allocated_entity_id = OLD.kam_id
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this KAM has inventory assigned. Transfer stock first.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_delete_hub_manager
BEFORE DELETE ON public.hub_managers
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_with_inventory();

CREATE TRIGGER trg_prevent_delete_agent
BEFORE DELETE ON public.field_agents
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_agent_with_inventory();

CREATE TRIGGER trg_prevent_delete_kam
BEFORE DELETE ON public.kams
FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_kam_with_inventory();
