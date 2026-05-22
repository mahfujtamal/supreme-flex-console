-- ============================================================
-- SupremeFlex Migration 005: CHAR(36) → BINARY(16) upgrade
-- For fresh installs: no-op rebuild (columns already BINARY(16)).
-- For existing installs: converts column types.
-- WARNING: Does not convert existing UUID string data to bytes.
-- Run only on fresh/test databases or after manual data migration.
--
-- MySQL 8.0.16+ checks FK column type compatibility even when
-- FOREIGN_KEY_CHECKS = 0. This migration drops all FKs first,
-- alters all columns, then recreates FKs.
-- A helper procedure makes each DROP idempotent (safe to re-run).
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- HELPER: drop a FK only if it exists
-- ============================================================

DROP PROCEDURE IF EXISTS _sfx_drop_fk;

DELIMITER //
CREATE PROCEDURE _sfx_drop_fk(IN p_table VARCHAR(64), IN p_fk VARCHAR(64))
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME    = p_table
      AND CONSTRAINT_NAME = p_fk
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    SET @_sfx_sql = CONCAT('ALTER TABLE `', p_table, '` DROP FOREIGN KEY `', p_fk, '`');
    PREPARE _sfx_stmt FROM @_sfx_sql;
    EXECUTE _sfx_stmt;
    DEALLOCATE PREPARE _sfx_stmt;
  END IF;
END //
DELIMITER ;

-- ============================================================
-- DROP ALL FOREIGN KEY CONSTRAINTS (idempotent)
-- ============================================================

CALL _sfx_drop_fk('user_role',                    'fk_user_role_user');
CALL _sfx_drop_fk('user_role',                    'fk_user_role_role');
CALL _sfx_drop_fk('role_permission',              'fk_rp_role');
CALL _sfx_drop_fk('role_permission',              'fk_rp_permission');
CALL _sfx_drop_fk('admin_users',                  'fk_admin_users_role');
CALL _sfx_drop_fk('regions',                      'fk_regions_circle');
CALL _sfx_drop_fk('clusters',                     'fk_clusters_region');
CALL _sfx_drop_fk('territories',                  'fk_territories_cluster');
CALL _sfx_drop_fk('areas',                        'fk_areas_district');
CALL _sfx_drop_fk('areas',                        'fk_areas_network_zone');
CALL _sfx_drop_fk('sub_channels',                 'fk_sub_channels_channel');
CALL _sfx_drop_fk('sub_channel_users',            'fk_scu_sub_channel');
CALL _sfx_drop_fk('distribution_houses',          'fk_dh_territory');
CALL _sfx_drop_fk('dh_area_assignments',          'fk_daa_dh');
CALL _sfx_drop_fk('dh_area_assignments',          'fk_daa_area');
CALL _sfx_drop_fk('hub_managers',                 'fk_hm_dh');
CALL _sfx_drop_fk('hub_managers',                 'fk_hm_channel');
CALL _sfx_drop_fk('hub_managers',                 'fk_hm_sub_channel');
CALL _sfx_drop_fk('field_agents',                 'fk_fa_dh');
CALL _sfx_drop_fk('field_agents',                 'fk_fa_hub_manager');
CALL _sfx_drop_fk('kams',                         'fk_kams_hub_manager');
CALL _sfx_drop_fk('product_price_versions',       'fk_ppv_product');
CALL _sfx_drop_fk('price_components',             'fk_pc_price_version');
CALL _sfx_drop_fk('physical_addon_compatibility', 'fk_pac_addon');
CALL _sfx_drop_fk('physical_addon_compatibility', 'fk_pac_cpe');
CALL _sfx_drop_fk('campaign_targeting_rules',     'fk_ctr_campaign');
CALL _sfx_drop_fk('campaign_targeting_rules',     'fk_ctr_network_zone');
CALL _sfx_drop_fk('campaign_targeting_rules',     'fk_ctr_district');
CALL _sfx_drop_fk('campaign_targeting_rules',     'fk_ctr_area');
CALL _sfx_drop_fk('campaign_targeting_rules',     'fk_ctr_channel');
CALL _sfx_drop_fk('campaign_targeting_rules',     'fk_ctr_sub_channel');
CALL _sfx_drop_fk('campaign_product_rules',       'fk_cpr_campaign');
CALL _sfx_drop_fk('campaign_product_rules',       'fk_cpr_product');
CALL _sfx_drop_fk('campaign_discount_mappings',   'fk_cdm_rule');
CALL _sfx_drop_fk('coupons',                      'fk_coupons_campaign');
CALL _sfx_drop_fk('referral_programs',            'fk_rp_campaign');
CALL _sfx_drop_fk('referral_programs',            'fk_rp_referrer_product');
CALL _sfx_drop_fk('referral_redemptions',         'fk_rr_program');
CALL _sfx_drop_fk('referral_redemptions',         'fk_rr_referrer');
CALL _sfx_drop_fk('referral_redemptions',         'fk_rr_referee');
CALL _sfx_drop_fk('referral_reward_ledger',       'fk_rrl_program');
CALL _sfx_drop_fk('referral_reward_ledger',       'fk_rrl_referrer');
CALL _sfx_drop_fk('referral_reward_ledger',       'fk_rrl_referee');
CALL _sfx_drop_fk('anchors',                      'fk_anchors_customer');
CALL _sfx_drop_fk('active_services',              'fk_as_customer');
CALL _sfx_drop_fk('active_services',              'fk_as_product');
CALL _sfx_drop_fk('active_services',              'fk_as_anchor');
CALL _sfx_drop_fk('active_services',              'fk_as_cpe_inventory');
CALL _sfx_drop_fk('customer_assets',              'fk_ca_customer');
CALL _sfx_drop_fk('customer_assets',              'fk_ca_product');
CALL _sfx_drop_fk('customer_assets',              'fk_ca_anchor');
CALL _sfx_drop_fk('asset_replacement_history',    'fk_arh_anchor');
CALL _sfx_drop_fk('asset_replacement_history',    'fk_arh_old_asset');
CALL _sfx_drop_fk('asset_replacement_history',    'fk_arh_new_asset');
CALL _sfx_drop_fk('orders',                       'fk_orders_channel');
CALL _sfx_drop_fk('orders',                       'fk_orders_sub_channel');
CALL _sfx_drop_fk('orders',                       'fk_orders_agent');
CALL _sfx_drop_fk('order_items',                  'fk_oi_order');
CALL _sfx_drop_fk('order_items',                  'fk_oi_product');
CALL _sfx_drop_fk('inventory_master',             'fk_im_product');
CALL _sfx_drop_fk('stock_transfers',              'fk_st_inventory');
CALL _sfx_drop_fk('onetime_invoices',             'fk_oi_customer');
CALL _sfx_drop_fk('transaction_ledger',           'fk_tl_customer');

DROP PROCEDURE IF EXISTS _sfx_drop_fk;

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
  MODIFY COLUMN `program_id`          BINARY(16) NOT NULL,
  MODIFY COLUMN `campaign_id`         BINARY(16) NOT NULL,
  MODIFY COLUMN `referrer_product_id` BINARY(16) NULL;

-- ============================================================
-- CUSTOMERS & REFERRALS
-- ============================================================

ALTER TABLE `customers`
  MODIFY COLUMN `customer_id` BINARY(16) NOT NULL;

ALTER TABLE `referral_redemptions`
  MODIFY COLUMN `redemption_id`        BINARY(16) NOT NULL,
  MODIFY COLUMN `program_id`           BINARY(16) NOT NULL,
  MODIFY COLUMN `referrer_customer_id` BINARY(16) NOT NULL,
  MODIFY COLUMN `referee_customer_id`  BINARY(16) NOT NULL;

ALTER TABLE `referral_reward_ledger`
  MODIFY COLUMN `ledger_id`            BINARY(16) NOT NULL,
  MODIFY COLUMN `program_id`           BINARY(16) NOT NULL,
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
  MODIFY COLUMN `service_id`               BINARY(16) NOT NULL,
  MODIFY COLUMN `customer_id`              BINARY(16) NOT NULL,
  MODIFY COLUMN `product_id`               BINARY(16) NOT NULL,
  MODIFY COLUMN `anchor_id`                BINARY(16) NULL,
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
  MODIFY COLUMN `invoice_id`                BINARY(16) NOT NULL,
  MODIFY COLUMN `customer_id`               BINARY(16) NOT NULL,
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

-- ============================================================
-- RECREATE ALL FOREIGN KEY CONSTRAINTS
-- ============================================================

ALTER TABLE `user_role`
  ADD CONSTRAINT `fk_user_role_user` FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_role_role` FOREIGN KEY (`role_id`) REFERENCES `role_master` (`role_id`) ON DELETE CASCADE;

ALTER TABLE `role_permission`
  ADD CONSTRAINT `fk_rp_role`       FOREIGN KEY (`role_id`)       REFERENCES `role_master`       (`role_id`)       ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permission_master` (`permission_id`) ON DELETE CASCADE;

ALTER TABLE `admin_users`
  ADD CONSTRAINT `fk_admin_users_role` FOREIGN KEY (`role_id`) REFERENCES `admin_roles` (`role_id`) ON DELETE SET NULL;

ALTER TABLE `regions`
  ADD CONSTRAINT `fk_regions_circle` FOREIGN KEY (`circle_id`) REFERENCES `circles` (`circle_id`) ON DELETE CASCADE;

ALTER TABLE `clusters`
  ADD CONSTRAINT `fk_clusters_region` FOREIGN KEY (`region_id`) REFERENCES `regions` (`region_id`) ON DELETE CASCADE;

ALTER TABLE `territories`
  ADD CONSTRAINT `fk_territories_cluster` FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`cluster_id`) ON DELETE CASCADE;

ALTER TABLE `areas`
  ADD CONSTRAINT `fk_areas_district`     FOREIGN KEY (`district_id`)     REFERENCES `districts`     (`district_id`)     ON DELETE CASCADE,
  ADD CONSTRAINT `fk_areas_network_zone` FOREIGN KEY (`network_zone_id`) REFERENCES `network_zones` (`network_zone_id`) ON DELETE SET NULL;

ALTER TABLE `sub_channels`
  ADD CONSTRAINT `fk_sub_channels_channel` FOREIGN KEY (`channel_id`) REFERENCES `channels` (`channel_id`) ON DELETE CASCADE;

ALTER TABLE `sub_channel_users`
  ADD CONSTRAINT `fk_scu_sub_channel` FOREIGN KEY (`sub_channel_id`) REFERENCES `sub_channels` (`sub_channel_id`) ON DELETE CASCADE;

ALTER TABLE `distribution_houses`
  ADD CONSTRAINT `fk_dh_territory` FOREIGN KEY (`territory_id`) REFERENCES `territories` (`territory_id`) ON DELETE SET NULL;

ALTER TABLE `dh_area_assignments`
  ADD CONSTRAINT `fk_daa_dh`   FOREIGN KEY (`dh_id`)   REFERENCES `distribution_houses` (`dh_id`)   ON DELETE CASCADE,
  ADD CONSTRAINT `fk_daa_area` FOREIGN KEY (`area_id`) REFERENCES `areas`               (`area_id`) ON DELETE CASCADE;

ALTER TABLE `hub_managers`
  ADD CONSTRAINT `fk_hm_dh`          FOREIGN KEY (`dh_id`)          REFERENCES `distribution_houses` (`dh_id`)          ON DELETE SET NULL,
  ADD CONSTRAINT `fk_hm_channel`     FOREIGN KEY (`channel_id`)     REFERENCES `channels`            (`channel_id`)     ON DELETE SET NULL,
  ADD CONSTRAINT `fk_hm_sub_channel` FOREIGN KEY (`sub_channel_id`) REFERENCES `sub_channels`        (`sub_channel_id`) ON DELETE SET NULL;

ALTER TABLE `field_agents`
  ADD CONSTRAINT `fk_fa_dh`          FOREIGN KEY (`dh_id`)          REFERENCES `distribution_houses` (`dh_id`)          ON DELETE SET NULL,
  ADD CONSTRAINT `fk_fa_hub_manager` FOREIGN KEY (`hub_manager_id`) REFERENCES `hub_managers`        (`hub_manager_id`) ON DELETE SET NULL;

ALTER TABLE `kams`
  ADD CONSTRAINT `fk_kams_hub_manager` FOREIGN KEY (`hub_manager_id`) REFERENCES `hub_managers` (`hub_manager_id`) ON DELETE SET NULL;

ALTER TABLE `product_price_versions`
  ADD CONSTRAINT `fk_ppv_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE;

ALTER TABLE `price_components`
  ADD CONSTRAINT `fk_pc_price_version` FOREIGN KEY (`price_version_id`) REFERENCES `product_price_versions` (`price_version_id`) ON DELETE CASCADE;

ALTER TABLE `physical_addon_compatibility`
  ADD CONSTRAINT `fk_pac_addon` FOREIGN KEY (`addon_product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pac_cpe`   FOREIGN KEY (`cpe_product_id`)   REFERENCES `products` (`product_id`) ON DELETE CASCADE;

ALTER TABLE `campaign_targeting_rules`
  ADD CONSTRAINT `fk_ctr_campaign`     FOREIGN KEY (`campaign_id`)     REFERENCES `campaign_master` (`campaign_id`)     ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ctr_network_zone` FOREIGN KEY (`network_zone_id`) REFERENCES `network_zones`  (`network_zone_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ctr_district`     FOREIGN KEY (`district_id`)     REFERENCES `districts`       (`district_id`)     ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ctr_area`         FOREIGN KEY (`area_id`)         REFERENCES `areas`            (`area_id`)         ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ctr_channel`      FOREIGN KEY (`channel_id`)      REFERENCES `channels`         (`channel_id`)      ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ctr_sub_channel`  FOREIGN KEY (`sub_channel_id`)  REFERENCES `sub_channels`     (`sub_channel_id`)  ON DELETE SET NULL;

ALTER TABLE `campaign_product_rules`
  ADD CONSTRAINT `fk_cpr_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaign_master` (`campaign_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cpr_product`  FOREIGN KEY (`product_id`)  REFERENCES `products`        (`product_id`)  ON DELETE CASCADE;

ALTER TABLE `campaign_discount_mappings`
  ADD CONSTRAINT `fk_cdm_rule` FOREIGN KEY (`rule_id`) REFERENCES `campaign_product_rules` (`rule_id`) ON DELETE CASCADE;

ALTER TABLE `coupons`
  ADD CONSTRAINT `fk_coupons_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaign_master` (`campaign_id`) ON DELETE CASCADE;

ALTER TABLE `referral_programs`
  ADD CONSTRAINT `fk_rp_campaign`         FOREIGN KEY (`campaign_id`)        REFERENCES `campaign_master` (`campaign_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rp_referrer_product` FOREIGN KEY (`referrer_product_id`) REFERENCES `products`       (`product_id`)  ON DELETE SET NULL;

ALTER TABLE `referral_redemptions`
  ADD CONSTRAINT `fk_rr_program`  FOREIGN KEY (`program_id`)           REFERENCES `referral_programs` (`program_id`)  ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rr_referrer` FOREIGN KEY (`referrer_customer_id`) REFERENCES `customers`         (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rr_referee`  FOREIGN KEY (`referee_customer_id`)  REFERENCES `customers`         (`customer_id`) ON DELETE CASCADE;

ALTER TABLE `referral_reward_ledger`
  ADD CONSTRAINT `fk_rrl_program`  FOREIGN KEY (`program_id`)           REFERENCES `referral_programs` (`program_id`)  ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rrl_referrer` FOREIGN KEY (`referrer_customer_id`) REFERENCES `customers`         (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rrl_referee`  FOREIGN KEY (`referee_customer_id`)  REFERENCES `customers`         (`customer_id`) ON DELETE CASCADE;

ALTER TABLE `anchors`
  ADD CONSTRAINT `fk_anchors_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE;

ALTER TABLE `active_services`
  ADD CONSTRAINT `fk_as_customer`      FOREIGN KEY (`customer_id`)              REFERENCES `customers`        (`customer_id`)  ON DELETE CASCADE,
  ADD CONSTRAINT `fk_as_product`       FOREIGN KEY (`product_id`)               REFERENCES `products`         (`product_id`)   ON DELETE CASCADE,
  ADD CONSTRAINT `fk_as_anchor`        FOREIGN KEY (`anchor_id`)                REFERENCES `anchors`          (`anchor_id`)    ON DELETE SET NULL,
  ADD CONSTRAINT `fk_as_cpe_inventory` FOREIGN KEY (`current_cpe_inventory_id`) REFERENCES `inventory_master` (`inventory_id`) ON DELETE SET NULL;

ALTER TABLE `customer_assets`
  ADD CONSTRAINT `fk_ca_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ca_product`  FOREIGN KEY (`product_id`)  REFERENCES `products`  (`product_id`)  ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ca_anchor`   FOREIGN KEY (`anchor_id`)   REFERENCES `anchors`   (`anchor_id`)   ON DELETE SET NULL;

ALTER TABLE `asset_replacement_history`
  ADD CONSTRAINT `fk_arh_anchor`    FOREIGN KEY (`anchor_id`)    REFERENCES `anchors`         (`anchor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_arh_old_asset` FOREIGN KEY (`old_asset_id`) REFERENCES `customer_assets` (`asset_id`)  ON DELETE SET NULL,
  ADD CONSTRAINT `fk_arh_new_asset` FOREIGN KEY (`new_asset_id`) REFERENCES `customer_assets` (`asset_id`)  ON DELETE SET NULL;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_channel`     FOREIGN KEY (`channel_id`)        REFERENCES `channels`     (`channel_id`)     ON DELETE SET NULL,
  ADD CONSTRAINT `fk_orders_sub_channel` FOREIGN KEY (`sub_channel_id`)    REFERENCES `sub_channels` (`sub_channel_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_orders_agent`       FOREIGN KEY (`assigned_agent_id`) REFERENCES `field_agents` (`agent_id`)       ON DELETE SET NULL;

ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_oi_order`   FOREIGN KEY (`order_id`)   REFERENCES `orders`   (`order_id`)   ON DELETE CASCADE,
  ADD CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE;

ALTER TABLE `inventory_master`
  ADD CONSTRAINT `fk_im_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE;

ALTER TABLE `stock_transfers`
  ADD CONSTRAINT `fk_st_inventory` FOREIGN KEY (`inventory_id`) REFERENCES `inventory_master` (`inventory_id`) ON DELETE CASCADE;

ALTER TABLE `onetime_invoices`
  ADD CONSTRAINT `fk_oi_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE;

ALTER TABLE `transaction_ledger`
  ADD CONSTRAINT `fk_tl_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
