-- 1. Add new inventory statuses
ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'IN_GPFI_STAGING';
ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'WITH_HUB_MANAGER';
ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'WITH_FIELD_STAFF';

-- 2. Create new enums
CREATE TYPE stock_type AS ENUM ('GPFI_STAGING', 'SWAP_BUFFER_STOCK', 'SALES_STOCK');
CREATE TYPE transfer_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- 3. Create hub_managers table
CREATE TABLE hub_managers (
  hub_manager_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  msisdn text NOT NULL,
  channel_id uuid REFERENCES channels(channel_id),
  sub_channel_id uuid REFERENCES sub_channels(sub_channel_id),
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hub_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON hub_managers FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON hub_managers FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON hub_managers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON hub_managers FOR DELETE USING (true);

CREATE TRIGGER update_hub_managers_updated_at
  BEFORE UPDATE ON hub_managers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Add is_direct_delivery to sub_channels
ALTER TABLE sub_channels ADD COLUMN is_direct_delivery boolean NOT NULL DEFAULT false;

-- 5. Add hub_manager_id FK to field_agents and kams
ALTER TABLE field_agents ADD COLUMN hub_manager_id uuid REFERENCES hub_managers(hub_manager_id);
ALTER TABLE kams ADD COLUMN hub_manager_id uuid REFERENCES hub_managers(hub_manager_id);

-- 6. Add stock_type to inventory_master
ALTER TABLE inventory_master ADD COLUMN stock_type stock_type DEFAULT 'GPFI_STAGING';

-- 7. Create stock_transfers table for custody chain
CREATE TABLE stock_transfers (
  transfer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES inventory_master(inventory_id),
  from_entity_type text NOT NULL,
  from_entity_id text NOT NULL,
  to_entity_type text NOT NULL,
  to_entity_id text NOT NULL,
  transfer_status transfer_status NOT NULL DEFAULT 'PENDING',
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_full_select" ON stock_transfers FOR SELECT USING (true);
CREATE POLICY "dev_full_insert" ON stock_transfers FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_full_update" ON stock_transfers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "dev_full_delete" ON stock_transfers FOR DELETE USING (true);