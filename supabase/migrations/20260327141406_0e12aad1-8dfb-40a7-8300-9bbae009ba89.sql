
-- Drop old area_id and district_id from distribution_houses (0 rows, safe)
ALTER TABLE distribution_houses DROP COLUMN IF EXISTS area_id;
ALTER TABLE distribution_houses DROP COLUMN IF EXISTS district_id;

-- Make territory_id required (each DH must belong to exactly one territory)
ALTER TABLE distribution_houses ALTER COLUMN territory_id SET NOT NULL;

-- Add unique constraints
ALTER TABLE distribution_houses ADD CONSTRAINT distribution_houses_dh_code_unique UNIQUE (dh_code);
CREATE UNIQUE INDEX distribution_houses_phone_unique ON distribution_houses (phone_number) WHERE phone_number IS NOT NULL;

-- Create junction table for DH ↔ Area (many-to-many)
CREATE TABLE public.dh_area_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dh_id uuid NOT NULL REFERENCES distribution_houses(dh_id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES areas(area_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dh_id, area_id)
);

-- Track round-robin: last_assigned_dh_index per area
ALTER TABLE areas ADD COLUMN last_assigned_dh_index integer NOT NULL DEFAULT 0;

-- Enable RLS
ALTER TABLE dh_area_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON dh_area_assignments FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON dh_area_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON dh_area_assignments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON dh_area_assignments FOR DELETE USING (true);
