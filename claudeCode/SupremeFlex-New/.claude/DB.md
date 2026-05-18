# SupremeFlex — Database Reference

MySQL. All PKs: `CHAR(36) DEFAULT (UUID())`. All `updated_at` maintained by triggers (`002_create_triggers.sql`). No hard deletes.

## Domain Map

| Domain | Tables |
|---|---|
| Auth & Governance | `role_master`, `permission_master`, `user_account`, `user_role`, `role_permission`, `admin_roles`, `admin_users` |
| Geographic Hierarchy | `circles` → `regions` → `clusters` → `territories` · `districts` → `areas` · `network_zones` |
| Distribution Network | `channels` → `sub_channels` → `sub_channel_users` · `distribution_houses` · `dh_area_assignments` |
| Field Operations | `hub_managers`, `field_agents`, `kams` |
| Product Engine | `products`, `product_price_versions`, `price_components`, `physical_addon_compatibility` |
| Campaign Engine | `campaign_master`, `campaign_targeting_rules`, `campaign_product_rules`, `campaign_discount_mappings`, `coupons`, `referral_programs` |
| Customers & Services | `customers`, `anchors`, `active_services`, `customer_assets`, `asset_replacement_history` |
| Orders & Fulfillment | `orders`, `order_items` |
| Inventory | `inventory_master`, `stock_transfers` |
| Invoicing | `onetime_invoices`, `transaction_ledger` |
| Referral System | `referral_redemptions`, `referral_reward_ledger` |
| Audit | `audit_logs`, `system_audit_logs` |

## Key Columns & ENUMs

**products:** `product_category ENUM('WIFI_PLAN','CPE','SIM','ADDON')`, `billing_type ENUM('ONE_TIME','RECURRING')`, `network_capability ENUM('4G','5G','BOTH','ANY')`

**product_price_versions:** `status ENUM('CURRENT','UPCOMING','EXPIRED')` — never overwrite, always add new version

**inventory_master:** `status ENUM('IN_WAREHOUSE','ALLOCATED_TO_DH','ALLOCATED_TO_KAM','WITH_AGENT','DELIVERED','DEFECTIVE','IN_GPFI_STAGING','WITH_HUB_MANAGER','WITH_FIELD_STAFF')`, `stock_type ENUM('GPFI_STAGING','SWAP_BUFFER_STOCK','SALES_STOCK')`

**orders:** `order_status ENUM('PENDING_DISPATCH','OUT_FOR_DELIVERY','ACTIVE','CANCELLED','ASSIGNED','CONTACTED','NETWORK_TEST','INSTALLED')`, `payment_status ENUM('PENDING_COD','PAID_COD','ONLINE_PAID')`

**referral_reward_ledger:** `reward_status ENUM('PENDING','AWAITING_ACTIVATION','AWAITING_PAYMENT','EARNED','APPLIED','FORCE_APPROVED')` — transitions owned by stored procedure only

**customers:** `account_status ENUM('ACTIVE','EXPIRED','CHURNED')`, `customer_type ENUM('B2C','B2B')`

**campaign_master:** `scope ENUM('ACQ','LC','BOTH')`, `campaign_trigger_type ENUM('RULE_BASED','COUPON_BASED','REFERRAL_BASED','HYBRID')`

## Key Relationships
```
customers → anchors (1:many) → active_services, customer_assets
orders → order_items → inventory_master
campaign_master → targeting_rules, product_rules → discount_mappings
campaign_master → referral_programs → referral_redemptions → referral_reward_ledger
products → product_price_versions → price_components
distribution_houses → territories → clusters → regions → circles
distribution_houses → dh_area_assignments → areas → districts
```

## Stored Procedures
| Procedure | Purpose |
|---|---|
| `has_role(user_id, role_name) → BOOLEAN` | RBAC check via user_role + role_master join |
| `check_and_release_referral_reward(ledger_id)` | Transitions reward_status based on service_active + invoice_paid flags |
| `force_approve_referral_reward(ledger_id, admin_name)` | Admin override → FORCE_APPROVED |

## areas table — special field
`last_assigned_dh_index INT` — round-robin DH assignment counter per area. Increment on each assignment.
