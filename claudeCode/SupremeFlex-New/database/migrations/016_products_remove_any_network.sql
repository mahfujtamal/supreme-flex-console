-- Migration 016: Remove ANY from products.network_capability
-- ANY has no distinct meaning from BOTH for GPFI products

UPDATE products SET network_capability = 'BOTH' WHERE network_capability = 'ANY';

ALTER TABLE products
  MODIFY COLUMN network_capability ENUM('4G','5G','BOTH') NOT NULL DEFAULT 'BOTH';
