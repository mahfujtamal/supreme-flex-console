-- ============================================================
-- SupremeFlex Migration 005: CHAR(36) → BINARY(16) upgrade
-- For fresh installs: no-op rebuild (columns already BINARY(16)).
--   NOTE: Even on a fresh install, MySQL 8.0 may perform a full table
--   rebuild for MODIFY COLUMN statements when the column definition
--   matches the current type (InnoDB instant DDL does not apply to
--   BINARY type changes). This is safe but may be slow on large tables.
-- For existing installs: converts column types.
-- WARNING: Does not convert existing UUID string data to bytes.
-- Run only on fresh/test databases or after manual data migration.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- AUTH & GOVERNANCE
-- ============================================================

ALTER TABLE `role_master`
  MODIFY COLUMN `role_id` BINARY(16) NOT NULL;

ALTER TABLE `permission_master`
  MODIFY COLUMN `permission_id` BINARY(16) NOT NULL;

ALTER TABLE `user_account`
  MODIFY COLUMN `id` BINARY(16) NOT NULL;

ALTER TABLE `user_role`
  MODIFY COLUMN `user_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `role_id` BINARY(16) NOT NULL;

ALTER TABLE `role_permission`
  MODIFY COLUMN `role_id`       BINARY(16) NOT NULL,
  MODIFY COLUMN `permission_id` BINARY(16) NOT NULL;

ALTER TABLE `admin_roles`
  MODIFY COLUMN `role_id` BINARY(16) NOT NULL;

ALTER TABLE `admin_users`
  MODIFY COLUMN `admin_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `role_id`  BINARY(16) NULL;

-- ============================================================
-- GEOGRAPHIC HIERARCHY
-- ============================================================

ALTER TABLE `circles`
  MODIFY COLUMN `circle_id` BINARY(16) NOT NULL;

ALTER TABLE `regions`
  MODIFY COLUMN `region_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `circle_id` BINARY(16) NOT NULL;

ALTER TABLE `clusters`
  MODIFY COLUMN `cluster_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `region_id`  BINARY(16) NOT NULL;

ALTER TABLE `territories`
  MODIFY COLUMN `territory_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `cluster_id`   BINARY(16) NOT NULL;

ALTER TABLE `network_zones`
  MODIFY COLUMN `network_zone_id` BINARY(16) NOT NULL;

ALTER TABLE `districts`
  MODIFY COLUMN `district_id` BINARY(16) NOT NULL;

ALTER TABLE `areas`
  MODIFY COLUMN `area_id`         BINARY(16) NOT NULL,
  MODIFY COLUMN `district_id`     BINARY(16) NOT NULL,
  MODIFY COLUMN `network_zone_id` BINARY(16) NULL;

-- ============================================================
-- SALES CHANNELS & DISTRIBUTION
-- ============================================================

ALTER TABLE `channels`
  MODIFY COLUMN `channel_id` BINARY(16) NOT NULL;

ALTER TABLE `sub_channels`
  MODIFY COLUMN `sub_channel_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `channel_id`     BINARY(16) NOT NULL;

ALTER TABLE `sub_channel_users`
  MODIFY COLUMN `id`             BINARY(16) NOT NULL,
  MODIFY COLUMN `sub_channel_id` BINARY(16) NOT NULL;

ALTER TABLE `distribution_houses`
  MODIFY COLUMN `dh_id`        BINARY(16) NOT NULL,
  MODIFY COLUMN `territory_id` BINARY(16) NULL;

ALTER TABLE `dh_area_assignments`
  MODIFY COLUMN `dh_id`   BINARY(16) NOT NULL,
  MODIFY COLUMN `area_id` BINARY(16) NOT NULL;

-- ============================================================
-- FIELD OPERATIONS
-- ============================================================

ALTER TABLE `hub_managers`
  MODIFY COLUMN `hub_manager_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `dh_id`          BINARY(16) NULL,
  MODIFY COLUMN `channel_id`     BINARY(16) NULL,
  MODIFY COLUMN `sub_channel_id` BINARY(16) NULL;

ALTER TABLE `field_agents`
  MODIFY COLUMN `agent_id`       BINARY(16) NOT NULL,
  MODIFY COLUMN `dh_id`          BINARY(16) NULL,
  MODIFY COLUMN `hub_manager_id` BINARY(16) NULL;

ALTER TABLE `kams`
  MODIFY COLUMN `kam_id`         BINARY(16) NOT NULL,
  MODIFY COLUMN `hub_manager_id` BINARY(16) NULL;

-- ============================================================
-- PRODUCTS
-- ============================================================

ALTER TABLE `products`
  MODIFY COLUMN `product_id` BINARY(16) NOT NULL;

ALTER TABLE `product_price_versions`
  MODIFY COLUMN `price_version_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `product_id`       BINARY(16) NOT NULL;

ALTER TABLE `price_components`
  MODIFY COLUMN `component_id`     BINARY(16) NOT NULL,
  MODIFY COLUMN `price_version_id` BINARY(16) NOT NULL;

ALTER TABLE `physical_addon_compatibility`
  MODIFY COLUMN `compatibility_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `addon_product_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `cpe_product_id`   BINARY(16) NOT NULL;

-- ============================================================
-- CAMPAIGNS
-- ============================================================

ALTER TABLE `campaign_master`
  MODIFY COLUMN `campaign_id` BINARY(16) NOT NULL;

ALTER TABLE `campaign_targeting_rules`
  MODIFY COLUMN `rule_id`         BINARY(16) NOT NULL,
  MODIFY COLUMN `campaign_id`     BINARY(16) NOT NULL,
  MODIFY COLUMN `network_zone_id` BINARY(16) NULL,
  MODIFY COLUMN `district_id`     BINARY(16) NULL,
  MODIFY COLUMN `area_id`         BINARY(16) NULL,
  MODIFY COLUMN `channel_id`      BINARY(16) NULL,
  MODIFY COLUMN `sub_channel_id`  BINARY(16) NULL;

ALTER TABLE `campaign_product_rules`
  MODIFY COLUMN `rule_id`     BINARY(16) NOT NULL,
  MODIFY COLUMN `campaign_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `product_id`  BINARY(16) NOT NULL;

ALTER TABLE `campaign_discount_mappings`
  MODIFY COLUMN `mapping_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `rule_id`    BINARY(16) NOT NULL;

ALTER TABLE `coupons`
  MODIFY COLUMN `coupon_id`   BINARY(16) NOT NULL,
  MODIFY COLUMN `campaign_id` BINARY(16) NOT NULL;

ALTER TABLE `referral_programs`
  MODIFY COLUMN `program_id`           BINARY(16) NOT NULL,
  MODIFY COLUMN `campaign_id`          BINARY(16) NOT NULL,
  MODIFY COLUMN `referrer_product_id`  BINARY(16) NULL;

-- ============================================================
-- CUSTOMERS & REFERRALS
-- ============================================================

ALTER TABLE `customers`
  MODIFY COLUMN `customer_id` BINARY(16) NOT NULL;

ALTER TABLE `referral_redemptions`
  MODIFY COLUMN `redemption_id`       BINARY(16) NOT NULL,
  MODIFY COLUMN `program_id`          BINARY(16) NOT NULL,
  MODIFY COLUMN `referrer_customer_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `referee_customer_id`  BINARY(16) NOT NULL;

ALTER TABLE `referral_reward_ledger`
  MODIFY COLUMN `ledger_id`           BINARY(16) NOT NULL,
  MODIFY COLUMN `program_id`          BINARY(16) NOT NULL,
  MODIFY COLUMN `referrer_customer_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `referee_customer_id`  BINARY(16) NOT NULL;

-- ============================================================
-- CUSTOMER SERVICES & ASSETS
-- ============================================================

ALTER TABLE `anchors`
  MODIFY COLUMN `anchor_id`   BINARY(16) NOT NULL,
  MODIFY COLUMN `customer_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `order_id`    BINARY(16) NULL;

ALTER TABLE `active_services`
  MODIFY COLUMN `service_id`              BINARY(16) NOT NULL,
  MODIFY COLUMN `customer_id`             BINARY(16) NOT NULL,
  MODIFY COLUMN `product_id`              BINARY(16) NOT NULL,
  MODIFY COLUMN `anchor_id`               BINARY(16) NULL,
  MODIFY COLUMN `current_cpe_inventory_id` BINARY(16) NULL;

ALTER TABLE `customer_assets`
  MODIFY COLUMN `asset_id`    BINARY(16) NOT NULL,
  MODIFY COLUMN `customer_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `anchor_id`   BINARY(16) NULL,
  MODIFY COLUMN `product_id`  BINARY(16) NOT NULL;

ALTER TABLE `asset_replacement_history`
  MODIFY COLUMN `replacement_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `anchor_id`      BINARY(16) NOT NULL,
  MODIFY COLUMN `old_asset_id`   BINARY(16) NULL,
  MODIFY COLUMN `new_asset_id`   BINARY(16) NULL;

-- ============================================================
-- ORDERS & FULFILLMENT
-- ============================================================

ALTER TABLE `orders`
  MODIFY COLUMN `order_id`           BINARY(16) NOT NULL,
  MODIFY COLUMN `channel_id`         BINARY(16) NULL,
  MODIFY COLUMN `sub_channel_id`     BINARY(16) NULL,
  MODIFY COLUMN `assigned_agent_id`  BINARY(16) NULL,
  MODIFY COLUMN `assigned_dh_kam_id` BINARY(16) NULL,
  MODIFY COLUMN `staff_user_id`      BINARY(16) NULL;

ALTER TABLE `order_items`
  MODIFY COLUMN `item_id`      BINARY(16) NOT NULL,
  MODIFY COLUMN `order_id`     BINARY(16) NOT NULL,
  MODIFY COLUMN `product_id`   BINARY(16) NOT NULL,
  MODIFY COLUMN `inventory_id` BINARY(16) NULL;

-- ============================================================
-- INVENTORY
-- ============================================================

ALTER TABLE `inventory_master`
  MODIFY COLUMN `inventory_id`        BINARY(16) NOT NULL,
  MODIFY COLUMN `product_id`          BINARY(16) NOT NULL,
  MODIFY COLUMN `allocated_agent_id`  BINARY(16) NULL,
  MODIFY COLUMN `allocated_entity_id` BINARY(16) NULL;

ALTER TABLE `stock_transfers`
  MODIFY COLUMN `transfer_id`    BINARY(16) NOT NULL,
  MODIFY COLUMN `inventory_id`   BINARY(16) NOT NULL,
  MODIFY COLUMN `from_entity_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `to_entity_id`   BINARY(16) NOT NULL;

-- ============================================================
-- FINANCE & INVOICING
-- ============================================================

ALTER TABLE `onetime_invoices`
  MODIFY COLUMN `invoice_id`               BINARY(16) NOT NULL,
  MODIFY COLUMN `customer_id`              BINARY(16) NOT NULL,
  MODIFY COLUMN `parent_summary_invoice_id` BINARY(16) NULL;

ALTER TABLE `transaction_ledger`
  MODIFY COLUMN `ledger_id`   BINARY(16) NOT NULL,
  MODIFY COLUMN `customer_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `product_id`  BINARY(16) NULL,
  MODIFY COLUMN `anchor_id`   BINARY(16) NULL,
  MODIFY COLUMN `order_id`    BINARY(16) NULL,
  MODIFY COLUMN `campaign_id` BINARY(16) NULL;

-- ============================================================
-- AUDIT & COMPLIANCE
-- ============================================================

ALTER TABLE `audit_logs`
  MODIFY COLUMN `log_id`           BINARY(16) NOT NULL,
  MODIFY COLUMN `target_record_id` BINARY(16) NULL,
  MODIFY COLUMN `admin_id`         BINARY(16) NULL;

ALTER TABLE `system_audit_logs`
  MODIFY COLUMN `log_id`    BINARY(16) NOT NULL,
  MODIFY COLUMN `record_id` BINARY(16) NULL;

-- ============================================================
-- OTP AUTH (migration 004)
-- ============================================================

ALTER TABLE `otp_codes`
  MODIFY COLUMN `id` BINARY(16) NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;
