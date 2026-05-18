# SupremeFlex — Inventory Reference

## inventory_master — Item Status Flow
```
IN_WAREHOUSE
  → IN_GPFI_STAGING       (received from GPFI, pending QC)
  → ALLOCATED_TO_DH       (dispatched to Distribution House)
  → WITH_HUB_MANAGER      (at Hub Manager level)
  → ALLOCATED_TO_KAM      (assigned to KAM)
  → WITH_AGENT            (field agent holds it)
  → WITH_FIELD_STAFF      (generic field staff)
  → DELIVERED             (installed at customer site)
  → DEFECTIVE             (failed QC or returned faulty)
```

## stock_type
`GPFI_STAGING` — received from GP, not yet cleared for sale  
`SWAP_BUFFER_STOCK` — reserved for CPE warranty replacements  
`SALES_STOCK` — available for new customer orders

## Stock Transfers (`stock_transfers`)
Entity types: `WAREHOUSE`, `DH`, `HUB_MANAGER`, `KAM`, `AGENT`  
`transfer_status ENUM('PENDING','ACCEPTED','REJECTED')`  
Respond via: `PATCH /api/stock-transfers/{id}/respond`  
Node.js owns the real-time transfer flow; PHP owns CRUD.

## Bulk Inward
`POST /api/inventory/bulk-inward` — receives batch from GPFI staging.  
Sets `stock_type = 'GPFI_STAGING'`, `status = 'IN_GPFI_STAGING'` on all rows.  
Must write to `audit_logs` with `action_type = 'BULK_IMPORT'`.

## order_items.inventory_id
When an order is fulfilled, `order_items.inventory_id` links to the specific `inventory_master` row delivered.  
On delivery: update `inventory_master.status = 'DELIVERED'` + set `allocated_entity_id = customer_id`.

## Customer Assets
After delivery, a `customer_assets` row is created from the inventory item.  
Replacement history tracked in `asset_replacement_history` (reason: WARRANTY / PAID / UPGRADE).
