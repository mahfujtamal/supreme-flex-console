-- Fix existing accepted transfers: set allocated_entity_id from the transfer record
UPDATE inventory_master im
SET allocated_entity_id = st.to_entity_id
FROM stock_transfers st
WHERE st.inventory_id = im.inventory_id
  AND st.transfer_status = 'ACCEPTED'
  AND st.to_entity_type = 'HUB_MANAGER'
  AND im.status = 'WITH_HUB_MANAGER'
  AND im.allocated_entity_id IS NULL;