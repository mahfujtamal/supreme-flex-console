-- Migration 012: Delivery routing columns + order_delivery_overrides table
-- Run: mysql -u supremeflex_app -p supremeflex < database/migrations/012_delivery_routing.sql

-- ── channels: default_delivery_mode + inventory_pull_mode ────────────────────
ALTER TABLE `channels`
  ADD COLUMN `default_delivery_mode` ENUM('DH','OWN')    NOT NULL DEFAULT 'DH'   AFTER `manager_admin_id`,
  ADD COLUMN `inventory_pull_mode`   ENUM('PUSH','PULL') NOT NULL DEFAULT 'PUSH' AFTER `default_delivery_mode`;

-- ── sub_channels: inventory_pull_mode only (delivery_ownership already exists)
ALTER TABLE `sub_channels`
  ADD COLUMN `inventory_pull_mode`   ENUM('PUSH','PULL') NOT NULL DEFAULT 'PUSH' AFTER `manager_admin_id`;

-- ── distribution_houses: inventory_pull_mode ─────────────────────────────────
ALTER TABLE `distribution_houses`
  ADD COLUMN `inventory_pull_mode`   ENUM('PUSH','PULL') NOT NULL DEFAULT 'PUSH' AFTER `manager_admin_id`;

-- ── kams: inventory_pull_mode ────────────────────────────────────────────────
ALTER TABLE `kams`
  ADD COLUMN `inventory_pull_mode`   ENUM('PUSH','PULL') NOT NULL DEFAULT 'PUSH' AFTER `status`;

-- ── order_delivery_overrides ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_delivery_overrides` (
  `id`                 BINARY(16)   NOT NULL,
  `order_id`           BINARY(16)   NOT NULL,
  `override_type`      ENUM('DH','CHANNEL','SUBCHANNEL','KAM') NOT NULL,
  `override_entity_id` BINARY(16)   NOT NULL,
  `reason`             VARCHAR(255) NULL,
  `created_by`         BINARY(16)   NULL,
  `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_odo_order` (`order_id`),
  CONSTRAINT `fk_odo_order`      FOREIGN KEY (`order_id`)   REFERENCES `orders`       (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_odo_created_by` FOREIGN KEY (`created_by`) REFERENCES `user_account` (`id`)       ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
