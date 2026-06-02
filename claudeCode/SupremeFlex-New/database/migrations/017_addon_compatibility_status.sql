-- Migration 017: Add status to physical_addon_compatibility
-- ACTIVE = available for new sales and replacement; INACTIVE = not available

ALTER TABLE physical_addon_compatibility
  ADD COLUMN status TINYINT(1) NOT NULL DEFAULT 1 AFTER cpe_product_id;
