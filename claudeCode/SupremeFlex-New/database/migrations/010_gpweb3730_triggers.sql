-- Migration 010: BEFORE UPDATE triggers for GPWEB-3730 tables
-- Run: mysql -u supremeflex_app -p supremeflex < database/migrations/010_gpweb3730_triggers.sql

DELIMITER //

CREATE TRIGGER IF NOT EXISTS `trg_addon_order_history_updated_at`
  BEFORE UPDATE ON `addon_order_history`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER IF NOT EXISTS `trg_cpe_order_history_updated_at`
  BEFORE UPDATE ON `cpe_order_history`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER IF NOT EXISTS `trg_ott_order_history_updated_at`
  BEFORE UPDATE ON `ott_order_history`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER IF NOT EXISTS `trg_location_change_history_updated_at`
  BEFORE UPDATE ON `location_change_history`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER IF NOT EXISTS `trg_real_ip_assignments_updated_at`
  BEFORE UPDATE ON `real_ip_assignments`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP //

CREATE TRIGGER IF NOT EXISTS `trg_tac_area_mapping_updated_at`
  BEFORE UPDATE ON `tac_area_mapping`
  FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP //

DELIMITER ;
