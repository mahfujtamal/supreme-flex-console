-- Migration 006: Enforce anchor_id + active_service_id on all order/invoice tables
-- Every order and child invoice must be scoped to a specific connection.
-- Parent summary invoices (is_summary = 1) intentionally have NULL anchor/service.
-- Run: mysql -u root -p supremeflex < database/migrations/006_order_connection_enforcement.sql

-- ── orders ────────────────────────────────────────────────────────────────────
ALTER TABLE `orders`
  ADD COLUMN `anchor_id`         CHAR(36) NOT NULL AFTER `customer_type`,
  ADD COLUMN `active_service_id` CHAR(36) NOT NULL AFTER `anchor_id`,
  ADD CONSTRAINT `fk_orders_anchor`
    FOREIGN KEY (`anchor_id`)         REFERENCES `anchors`         (`anchor_id`)  ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_orders_service`
    FOREIGN KEY (`active_service_id`) REFERENCES `active_services` (`service_id`) ON DELETE RESTRICT;

-- ── onetime_invoices ──────────────────────────────────────────────────────────
-- Add self-referencing FK (was missing from original schema).
-- Add is_summary flag to distinguish parent summary rows from child rows.
-- Child rows carry anchor_id + active_service_id; parent summary rows leave them NULL.
ALTER TABLE `onetime_invoices`
  ADD COLUMN `is_summary`        TINYINT(1) NOT NULL DEFAULT 0 AFTER `customer_id`,
  ADD COLUMN `anchor_id`         CHAR(36)   NULL     AFTER `is_summary`,
  ADD COLUMN `active_service_id` CHAR(36)   NULL     AFTER `anchor_id`,
  ADD CONSTRAINT `fk_oi_parent_summary`
    FOREIGN KEY (`parent_summary_invoice_id`) REFERENCES `onetime_invoices` (`invoice_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_oi_anchor`
    FOREIGN KEY (`anchor_id`)         REFERENCES `anchors`         (`anchor_id`)  ON DELETE SET NULL,
  ADD CONSTRAINT `fk_oi_service`
    FOREIGN KEY (`active_service_id`) REFERENCES `active_services` (`service_id`) ON DELETE SET NULL;

-- ── transaction_ledger ────────────────────────────────────────────────────────
-- anchor_id existed but was nullable with no FK — tighten it.
-- Add active_service_id and invoice_id references.
ALTER TABLE `transaction_ledger`
  MODIFY `anchor_id` CHAR(36) NOT NULL,
  ADD COLUMN `active_service_id` CHAR(36) NOT NULL AFTER `anchor_id`,
  ADD COLUMN `invoice_id`        CHAR(36) NULL     AFTER `order_id`,
  ADD CONSTRAINT `fk_tl_anchor`
    FOREIGN KEY (`anchor_id`)         REFERENCES `anchors`         (`anchor_id`)  ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_tl_service`
    FOREIGN KEY (`active_service_id`) REFERENCES `active_services` (`service_id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_tl_invoice`
    FOREIGN KEY (`invoice_id`)        REFERENCES `onetime_invoices`(`invoice_id`) ON DELETE SET NULL;

-- ── audit_logs: extend action_type ENUM to cover all bulk op variants ────────
ALTER TABLE `audit_logs`
  MODIFY `action_type` ENUM(
    'CREATE','UPDATE','DELETE','STATUS_CHANGE',
    'BULK_IMPORT','BULK_UPDATE','BULK_DELETE'
  ) NOT NULL;
