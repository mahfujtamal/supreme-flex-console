-- Migration 011: Missing status + timestamp indexes on existing tables
-- Run: mysql -u supremeflex_app -p supremeflex < database/migrations/011_add_indexes.sql

-- system_audit_logs: changed_at (all other indexes applied in prior partial runs)
ALTER TABLE `system_audit_logs`
  ADD INDEX `idx_sal_created` (`changed_at`);
