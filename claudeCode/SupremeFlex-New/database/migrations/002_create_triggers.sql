-- ============================================================
-- SupremeFlex MySQL Triggers
-- 002_create_triggers.sql
-- Auto-update updated_at on every table
-- ============================================================

DELIMITER $$

-- Auth & Governance
CREATE TRIGGER `trg_role_master_updated_at` BEFORE UPDATE ON `role_master`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_permission_master_updated_at` BEFORE UPDATE ON `permission_master`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_user_account_updated_at` BEFORE UPDATE ON `user_account`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_admin_roles_updated_at` BEFORE UPDATE ON `admin_roles`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_admin_users_updated_at` BEFORE UPDATE ON `admin_users`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

-- Geographic Hierarchy
CREATE TRIGGER `trg_circles_updated_at` BEFORE UPDATE ON `circles`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_regions_updated_at` BEFORE UPDATE ON `regions`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_clusters_updated_at` BEFORE UPDATE ON `clusters`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_territories_updated_at` BEFORE UPDATE ON `territories`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_network_zones_updated_at` BEFORE UPDATE ON `network_zones`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_districts_updated_at` BEFORE UPDATE ON `districts`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_areas_updated_at` BEFORE UPDATE ON `areas`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

-- Distribution Network
CREATE TRIGGER `trg_channels_updated_at` BEFORE UPDATE ON `channels`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_sub_channels_updated_at` BEFORE UPDATE ON `sub_channels`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_sub_channel_users_updated_at` BEFORE UPDATE ON `sub_channel_users`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_distribution_houses_updated_at` BEFORE UPDATE ON `distribution_houses`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

-- Field Operations
CREATE TRIGGER `trg_hub_managers_updated_at` BEFORE UPDATE ON `hub_managers`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_field_agents_updated_at` BEFORE UPDATE ON `field_agents`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_kams_updated_at` BEFORE UPDATE ON `kams`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

-- Product Engine
CREATE TRIGGER `trg_products_updated_at` BEFORE UPDATE ON `products`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_product_price_versions_updated_at` BEFORE UPDATE ON `product_price_versions`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_price_components_updated_at` BEFORE UPDATE ON `price_components`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

-- Campaign Engine
CREATE TRIGGER `trg_campaign_master_updated_at` BEFORE UPDATE ON `campaign_master`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_campaign_targeting_rules_updated_at` BEFORE UPDATE ON `campaign_targeting_rules`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_campaign_product_rules_updated_at` BEFORE UPDATE ON `campaign_product_rules`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_coupons_updated_at` BEFORE UPDATE ON `coupons`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_referral_programs_updated_at` BEFORE UPDATE ON `referral_programs`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

-- Referral System
CREATE TRIGGER `trg_referral_reward_ledger_updated_at` BEFORE UPDATE ON `referral_reward_ledger`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

-- Customers
CREATE TRIGGER `trg_customers_updated_at` BEFORE UPDATE ON `customers`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_anchors_updated_at` BEFORE UPDATE ON `anchors`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_active_services_updated_at` BEFORE UPDATE ON `active_services`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_customer_assets_updated_at` BEFORE UPDATE ON `customer_assets`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

-- Orders & Inventory
CREATE TRIGGER `trg_orders_updated_at` BEFORE UPDATE ON `orders`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_order_items_updated_at` BEFORE UPDATE ON `order_items`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_inventory_master_updated_at` BEFORE UPDATE ON `inventory_master`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_stock_transfers_updated_at` BEFORE UPDATE ON `stock_transfers`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

-- Invoicing
CREATE TRIGGER `trg_onetime_invoices_updated_at` BEFORE UPDATE ON `onetime_invoices`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$
CREATE TRIGGER `trg_transaction_ledger_updated_at` BEFORE UPDATE ON `transaction_ledger`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP$$

DELIMITER ;
