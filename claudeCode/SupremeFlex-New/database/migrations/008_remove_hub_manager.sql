-- Migration 008: Remove Hub Manager entity
-- hub_managers table and hub_manager_id columns were dropped in a prior partial run.
-- This file only contains the remaining structural changes.
-- Run: mysql -u supremeflex_app -p supremeflex < database/migrations/008_remove_hub_manager.sql

SET FOREIGN_KEY_CHECKS = 0;

-- ── Drop hub_managers trigger and table (idempotent) ─────────────────────────
DROP TRIGGER IF EXISTS `trg_hub_managers_updated_at`;
DROP TABLE   IF EXISTS `hub_managers`;

-- ── Remove hub_manager_id from field_agents if it still exists ────────────────
DROP PROCEDURE IF EXISTS _sfx_drop_hub_mgr;
DELIMITER //
CREATE PROCEDURE _sfx_drop_hub_mgr()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'field_agents' AND COLUMN_NAME = 'hub_manager_id'
  ) THEN
    ALTER TABLE `field_agents` DROP FOREIGN KEY `fk_fa_hub_manager`;
    ALTER TABLE `field_agents` DROP COLUMN `hub_manager_id`;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kams' AND COLUMN_NAME = 'hub_manager_id'
  ) THEN
    ALTER TABLE `kams` DROP FOREIGN KEY `fk_kams_hub_manager`;
    ALTER TABLE `kams` DROP COLUMN `hub_manager_id`;
  END IF;
END //
DELIMITER ;
CALL _sfx_drop_hub_mgr();
DROP PROCEDURE IF EXISTS _sfx_drop_hub_mgr;

-- ── Add manager_admin_id (FK → user_account) to channels ─────────────────────
ALTER TABLE `channels`
  ADD COLUMN `manager_admin_id` BINARY(16) NULL AFTER `channel_name`,
  ADD CONSTRAINT `fk_channels_manager`
    FOREIGN KEY (`manager_admin_id`) REFERENCES `user_account`(`id`) ON DELETE SET NULL;

-- ── Add manager_admin_id to sub_channels ─────────────────────────────────────
ALTER TABLE `sub_channels`
  ADD COLUMN `manager_admin_id` BINARY(16) NULL AFTER `sub_channel_name`,
  ADD CONSTRAINT `fk_sub_channels_manager`
    FOREIGN KEY (`manager_admin_id`) REFERENCES `user_account`(`id`) ON DELETE SET NULL;

-- ── Add manager_admin_id to distribution_houses ───────────────────────────────
ALTER TABLE `distribution_houses`
  ADD COLUMN `manager_admin_id` BINARY(16) NULL AFTER `name`,
  ADD CONSTRAINT `fk_dh_manager`
    FOREIGN KEY (`manager_admin_id`) REFERENCES `user_account`(`id`) ON DELETE SET NULL;

-- ── Shrink inventory_master.status ENUM (remove WITH_HUB_MANAGER) ────────────
ALTER TABLE `inventory_master`
  MODIFY `status` ENUM(
    'IN_WAREHOUSE','ALLOCATED_TO_DH','ALLOCATED_TO_KAM',
    'WITH_AGENT','DELIVERED','DEFECTIVE',
    'IN_GPFI_STAGING','WITH_FIELD_STAFF'
  ) NOT NULL DEFAULT 'IN_WAREHOUSE';

-- ── Tighten stock_transfers entity type columns to ENUM ──────────────────────
ALTER TABLE `stock_transfers`
  MODIFY `from_entity_type` ENUM('FIELD_STAFF','DH','KAM') NOT NULL,
  MODIFY `to_entity_type`   ENUM('FIELD_STAFF','DH','KAM') NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;
