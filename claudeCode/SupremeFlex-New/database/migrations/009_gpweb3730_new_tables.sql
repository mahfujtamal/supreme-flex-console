-- Migration 009: GPWEB-3730 new tables
-- system_config + addon/CPE/OTT order histories + location change + real IP + TAC mapping
-- Run: mysql -u supremeflex_app -p supremeflex < database/migrations/009_gpweb3730_new_tables.sql

-- ── system_config ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `system_config` (
  `config_key`   VARCHAR(100)  NOT NULL,
  `config_value` TEXT          NOT NULL,
  `description`  VARCHAR(255)  NULL,
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── addon_order_history ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `addon_order_history` (
  `id`                BINARY(16)    NOT NULL,
  `order_id`          BINARY(16)    NULL,
  `anchor_id`         BINARY(16)    NOT NULL,
  `active_service_id` BINARY(16)    NOT NULL,
  `customer_id`       BINARY(16)    NOT NULL,
  `addon_product_id`  BINARY(16)    NOT NULL,
  `gpshop_order_id`   VARCHAR(100)  NULL,
  `status`            ENUM('PENDING','ACTIVE','CANCELLED','FAILED') NOT NULL DEFAULT 'PENDING',
  `auto_cancel_at`    DATETIME      NULL,
  `activated_at`      DATETIME      NULL,
  `notes`             TEXT          NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_aoh_customer`  (`customer_id`),
  KEY `idx_aoh_anchor`    (`anchor_id`),
  KEY `idx_aoh_status`    (`status`),
  CONSTRAINT `fk_aoh_order`    FOREIGN KEY (`order_id`)          REFERENCES `orders`          (`order_id`)   ON DELETE SET NULL,
  CONSTRAINT `fk_aoh_anchor`   FOREIGN KEY (`anchor_id`)         REFERENCES `anchors`         (`anchor_id`)  ON DELETE RESTRICT,
  CONSTRAINT `fk_aoh_service`  FOREIGN KEY (`active_service_id`) REFERENCES `active_services` (`service_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_aoh_customer` FOREIGN KEY (`customer_id`)       REFERENCES `customers`       (`customer_id`)ON DELETE RESTRICT,
  CONSTRAINT `fk_aoh_product`  FOREIGN KEY (`addon_product_id`)  REFERENCES `products`        (`product_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── cpe_order_history ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `cpe_order_history` (
  `id`                BINARY(16)    NOT NULL,
  `order_id`          BINARY(16)    NULL,
  `anchor_id`         BINARY(16)    NOT NULL,
  `active_service_id` BINARY(16)    NOT NULL,
  `customer_id`       BINARY(16)    NOT NULL,
  `old_cpe_serial`    VARCHAR(100)  NULL,
  `new_cpe_serial`    VARCHAR(100)  NULL,
  `status`            ENUM('PENDING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  `completed_at`      DATETIME      NULL,
  `notes`             TEXT          NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_coh_customer` (`customer_id`),
  KEY `idx_coh_anchor`   (`anchor_id`),
  CONSTRAINT `fk_coh_order`    FOREIGN KEY (`order_id`)          REFERENCES `orders`          (`order_id`)   ON DELETE SET NULL,
  CONSTRAINT `fk_coh_anchor`   FOREIGN KEY (`anchor_id`)         REFERENCES `anchors`         (`anchor_id`)  ON DELETE RESTRICT,
  CONSTRAINT `fk_coh_service`  FOREIGN KEY (`active_service_id`) REFERENCES `active_services` (`service_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_coh_customer` FOREIGN KEY (`customer_id`)       REFERENCES `customers`       (`customer_id`)ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ott_order_history ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ott_order_history` (
  `id`                BINARY(16)    NOT NULL,
  `order_id`          BINARY(16)    NULL,
  `anchor_id`         BINARY(16)    NOT NULL,
  `active_service_id` BINARY(16)    NOT NULL,
  `customer_id`       BINARY(16)    NOT NULL,
  `ott_product_id`    BINARY(16)    NOT NULL,
  `status`            ENUM('PENDING','ACTIVE','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `activated_at`      DATETIME      NULL,
  `notes`             TEXT          NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ooh_customer` (`customer_id`),
  KEY `idx_ooh_anchor`   (`anchor_id`),
  KEY `idx_ooh_status`   (`status`),
  CONSTRAINT `fk_ooh_order`    FOREIGN KEY (`order_id`)          REFERENCES `orders`          (`order_id`)   ON DELETE SET NULL,
  CONSTRAINT `fk_ooh_anchor`   FOREIGN KEY (`anchor_id`)         REFERENCES `anchors`         (`anchor_id`)  ON DELETE RESTRICT,
  CONSTRAINT `fk_ooh_service`  FOREIGN KEY (`active_service_id`) REFERENCES `active_services` (`service_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ooh_customer` FOREIGN KEY (`customer_id`)       REFERENCES `customers`       (`customer_id`)ON DELETE RESTRICT,
  CONSTRAINT `fk_ooh_product`  FOREIGN KEY (`ott_product_id`)    REFERENCES `products`        (`product_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── location_change_history ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `location_change_history` (
  `id`                BINARY(16)    NOT NULL,
  `anchor_id`         BINARY(16)    NOT NULL,
  `active_service_id` BINARY(16)    NOT NULL,
  `customer_id`       BINARY(16)    NOT NULL,
  `old_area_id`       BINARY(16)    NULL,
  `new_area_id`       BINARY(16)    NOT NULL,
  `old_dh_id`         BINARY(16)    NULL,
  `new_dh_id`         BINARY(16)    NULL,
  `status`            ENUM('PENDING','APPROVED','REJECTED','COMPLETED') NOT NULL DEFAULT 'PENDING',
  `completed_at`      DATETIME      NULL,
  `notes`             TEXT          NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lch_customer` (`customer_id`),
  KEY `idx_lch_anchor`   (`anchor_id`),
  KEY `idx_lch_status`   (`status`),
  CONSTRAINT `fk_lch_anchor`   FOREIGN KEY (`anchor_id`)         REFERENCES `anchors`             (`anchor_id`)  ON DELETE RESTRICT,
  CONSTRAINT `fk_lch_service`  FOREIGN KEY (`active_service_id`) REFERENCES `active_services`     (`service_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_lch_customer` FOREIGN KEY (`customer_id`)       REFERENCES `customers`           (`customer_id`)ON DELETE RESTRICT,
  CONSTRAINT `fk_lch_old_area` FOREIGN KEY (`old_area_id`)       REFERENCES `areas`               (`area_id`)    ON DELETE SET NULL,
  CONSTRAINT `fk_lch_new_area` FOREIGN KEY (`new_area_id`)       REFERENCES `areas`               (`area_id`)    ON DELETE RESTRICT,
  CONSTRAINT `fk_lch_old_dh`   FOREIGN KEY (`old_dh_id`)         REFERENCES `distribution_houses` (`dh_id`)      ON DELETE SET NULL,
  CONSTRAINT `fk_lch_new_dh`   FOREIGN KEY (`new_dh_id`)         REFERENCES `distribution_houses` (`dh_id`)      ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── real_ip_assignments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `real_ip_assignments` (
  `id`                BINARY(16)    NOT NULL,
  `anchor_id`         BINARY(16)    NOT NULL,
  `active_service_id` BINARY(16)    NOT NULL,
  `customer_id`       BINARY(16)    NOT NULL,
  `ip_address`        VARCHAR(45)   NOT NULL,
  `status`            ENUM('ACTIVE','RELEASED','FAILED') NOT NULL DEFAULT 'ACTIVE',
  `assigned_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `released_at`       DATETIME      NULL,
  `notes`             TEXT          NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ria_customer` (`customer_id`),
  KEY `idx_ria_anchor`   (`anchor_id`),
  KEY `idx_ria_status`   (`status`),
  CONSTRAINT `fk_ria_anchor`   FOREIGN KEY (`anchor_id`)         REFERENCES `anchors`         (`anchor_id`)  ON DELETE RESTRICT,
  CONSTRAINT `fk_ria_service`  FOREIGN KEY (`active_service_id`) REFERENCES `active_services` (`service_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ria_customer` FOREIGN KEY (`customer_id`)       REFERENCES `customers`       (`customer_id`)ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── tac_area_mapping ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tac_area_mapping` (
  `id`         BINARY(16)   NOT NULL,
  `tac_code`   CHAR(8)      NOT NULL,
  `area_id`    BINARY(16)   NOT NULL,
  `zone_id`    BINARY(16)   NULL,
  `status`     ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tac_area` (`tac_code`, `area_id`),
  KEY `idx_tam_area` (`area_id`),
  CONSTRAINT `fk_tam_area` FOREIGN KEY (`area_id`) REFERENCES `areas`         (`area_id`)          ON DELETE RESTRICT,
  CONSTRAINT `fk_tam_zone` FOREIGN KEY (`zone_id`) REFERENCES `network_zones` (`network_zone_id`)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
