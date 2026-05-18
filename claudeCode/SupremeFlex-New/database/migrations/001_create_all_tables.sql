-- ============================================================
-- SupremeFlex MySQL Schema Migration
-- 001_create_all_tables.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- ============================================================
-- AUTH & GOVERNANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS `role_master` (
  `role_id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `role_name`        VARCHAR(100) NOT NULL,
  `role_description` TEXT,
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uq_role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `permission_master` (
  `permission_id`   CHAR(36)     NOT NULL DEFAULT (UUID()),
  `permission_name` VARCHAR(150) NOT NULL,
  `module`          VARCHAR(100),
  `description`     TEXT,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `uq_permission_name` (`permission_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_account` (
  `id`            CHAR(36)     NOT NULL DEFAULT (UUID()),
  `user_name`     VARCHAR(150) NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `staff_type`    VARCHAR(50),
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_role` (
  `user_id`    CHAR(36) NOT NULL,
  `role_id`    CHAR(36) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `role_id`),
  CONSTRAINT `fk_user_role_user` FOREIGN KEY (`user_id`) REFERENCES `user_account` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_role_role` FOREIGN KEY (`role_id`) REFERENCES `role_master` (`role_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `role_permission` (
  `role_id`       CHAR(36) NOT NULL,
  `permission_id` CHAR(36) NOT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `role_master` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permission_master` (`permission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_roles` (
  `role_id`     CHAR(36)     NOT NULL DEFAULT (UUID()),
  `role_name`   VARCHAR(100) NOT NULL,
  `permissions` JSON,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_users` (
  `admin_id`   CHAR(36)     NOT NULL DEFAULT (UUID()),
  `email`      VARCHAR(255) NOT NULL,
  `full_name`  VARCHAR(200),
  `role_id`    CHAR(36),
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  `last_login` DATETIME,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `uq_admin_email` (`email`),
  CONSTRAINT `fk_admin_users_role` FOREIGN KEY (`role_id`) REFERENCES `admin_roles` (`role_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- GEOGRAPHIC HIERARCHY
-- ============================================================

CREATE TABLE IF NOT EXISTS `circles` (
  `circle_id`   CHAR(36)     NOT NULL DEFAULT (UUID()),
  `circle_name` VARCHAR(150) NOT NULL,
  `status`      TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`circle_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `regions` (
  `region_id`   CHAR(36)     NOT NULL DEFAULT (UUID()),
  `circle_id`   CHAR(36)     NOT NULL,
  `region_name` VARCHAR(150) NOT NULL,
  `status`      TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`region_id`),
  CONSTRAINT `fk_regions_circle` FOREIGN KEY (`circle_id`) REFERENCES `circles` (`circle_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `clusters` (
  `cluster_id`   CHAR(36)     NOT NULL DEFAULT (UUID()),
  `region_id`    CHAR(36)     NOT NULL,
  `cluster_name` VARCHAR(150) NOT NULL,
  `status`       TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`cluster_id`),
  CONSTRAINT `fk_clusters_region` FOREIGN KEY (`region_id`) REFERENCES `regions` (`region_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `territories` (
  `territory_id`   CHAR(36)     NOT NULL DEFAULT (UUID()),
  `cluster_id`     CHAR(36)     NOT NULL,
  `territory_name` VARCHAR(150) NOT NULL,
  `status`         TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`territory_id`),
  CONSTRAINT `fk_territories_cluster` FOREIGN KEY (`cluster_id`) REFERENCES `clusters` (`cluster_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `network_zones` (
  `network_zone_id`   CHAR(36)     NOT NULL DEFAULT (UUID()),
  `network_zone_name` VARCHAR(150) NOT NULL,
  `4g_rsrp`           DECIMAL(10,2),
  `4g_rsrq`           DECIMAL(10,2),
  `4g_snr`            DECIMAL(10,2),
  `5g_rsrp`           DECIMAL(10,2),
  `5g_rsrq`           DECIMAL(10,2),
  `5g_snr`            DECIMAL(10,2),
  `status`            TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`network_zone_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `districts` (
  `district_id`   CHAR(36)     NOT NULL DEFAULT (UUID()),
  `district_name` VARCHAR(150) NOT NULL,
  `status`        TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`district_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `areas` (
  `area_id`                CHAR(36)     NOT NULL DEFAULT (UUID()),
  `area_name`              VARCHAR(150) NOT NULL,
  `district_id`            CHAR(36)     NOT NULL,
  `network_zone_id`        CHAR(36),
  `is_4g_area`             TINYINT(1)   NOT NULL DEFAULT 0,
  `is_5g_area`             TINYINT(1)   NOT NULL DEFAULT 0,
  `last_assigned_dh_index` INT          NOT NULL DEFAULT 0,
  `created_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`area_id`),
  CONSTRAINT `fk_areas_district`     FOREIGN KEY (`district_id`)     REFERENCES `districts` (`district_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_areas_network_zone` FOREIGN KEY (`network_zone_id`) REFERENCES `network_zones` (`network_zone_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- DISTRIBUTION NETWORK
-- ============================================================

CREATE TABLE IF NOT EXISTS `channels` (
  `channel_id`        CHAR(36)     NOT NULL DEFAULT (UUID()),
  `channel_name`      VARCHAR(150) NOT NULL,
  `is_assisted`       TINYINT(1)   NOT NULL DEFAULT 0,
  `is_self_delivered` TINYINT(1)   NOT NULL DEFAULT 0,
  `status`            TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sub_channels` (
  `sub_channel_id`   CHAR(36)     NOT NULL DEFAULT (UUID()),
  `channel_id`       CHAR(36)     NOT NULL,
  `sub_channel_name` VARCHAR(150) NOT NULL,
  `delivery_ownership` ENUM('FOLLOW_CHANNEL','SELF_DELIVERY','DH_DELIVERY') NOT NULL DEFAULT 'FOLLOW_CHANNEL',
  `is_direct_delivery` TINYINT(1) NOT NULL DEFAULT 0,
  `status`           TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sub_channel_id`),
  CONSTRAINT `fk_sub_channels_channel` FOREIGN KEY (`channel_id`) REFERENCES `channels` (`channel_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sub_channel_users` (
  `id`             CHAR(36)     NOT NULL DEFAULT (UUID()),
  `user_name`      VARCHAR(150) NOT NULL,
  `employee_id`    VARCHAR(100),
  `msisdn`         VARCHAR(20),
  `sub_channel_id` CHAR(36)     NOT NULL,
  `role`           VARCHAR(100),
  `status`         TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_scu_sub_channel` FOREIGN KEY (`sub_channel_id`) REFERENCES `sub_channels` (`sub_channel_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `distribution_houses` (
  `dh_id`            CHAR(36)     NOT NULL DEFAULT (UUID()),
  `dh_code`          VARCHAR(50)  NOT NULL,
  `territory_id`     CHAR(36),
  `name`             VARCHAR(200) NOT NULL,
  `phone_number`     VARCHAR(20),
  `last_assigned_at` DATETIME,
  `status`           ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`dh_id`),
  UNIQUE KEY `uq_dh_code` (`dh_code`),
  CONSTRAINT `fk_dh_territory` FOREIGN KEY (`territory_id`) REFERENCES `territories` (`territory_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `dh_area_assignments` (
  `dh_id`      CHAR(36) NOT NULL,
  `area_id`    CHAR(36) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`dh_id`, `area_id`),
  CONSTRAINT `fk_daa_dh`   FOREIGN KEY (`dh_id`)   REFERENCES `distribution_houses` (`dh_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_daa_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`area_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- FIELD OPERATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS `hub_managers` (
  `hub_manager_id` CHAR(36)     NOT NULL DEFAULT (UUID()),
  `name`           VARCHAR(200) NOT NULL,
  `email`          VARCHAR(255),
  `msisdn`         VARCHAR(20),
  `dh_id`          CHAR(36),
  `channel_id`     CHAR(36),
  `sub_channel_id` CHAR(36),
  `status`         TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`hub_manager_id`),
  CONSTRAINT `fk_hm_dh`          FOREIGN KEY (`dh_id`)          REFERENCES `distribution_houses` (`dh_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_hm_channel`     FOREIGN KEY (`channel_id`)     REFERENCES `channels` (`channel_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_hm_sub_channel` FOREIGN KEY (`sub_channel_id`) REFERENCES `sub_channels` (`sub_channel_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `field_agents` (
  `agent_id`       CHAR(36)     NOT NULL DEFAULT (UUID()),
  `agent_name`     VARCHAR(200) NOT NULL,
  `dh_id`          CHAR(36),
  `hub_manager_id` CHAR(36),
  `msisdn`         VARCHAR(20),
  `status`         ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`agent_id`),
  CONSTRAINT `fk_fa_dh`          FOREIGN KEY (`dh_id`)          REFERENCES `distribution_houses` (`dh_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fa_hub_manager` FOREIGN KEY (`hub_manager_id`) REFERENCES `hub_managers` (`hub_manager_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `kams` (
  `kam_id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `name`            VARCHAR(200) NOT NULL,
  `msisdn`          VARCHAR(20),
  `hub_manager_id`  CHAR(36),
  `assigned_segments` JSON,
  `status`          TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`kam_id`),
  CONSTRAINT `fk_kams_hub_manager` FOREIGN KEY (`hub_manager_id`) REFERENCES `hub_managers` (`hub_manager_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PRODUCT ENGINE
-- ============================================================

CREATE TABLE IF NOT EXISTS `products` (
  `product_id`        CHAR(36)     NOT NULL DEFAULT (UUID()),
  `product_name`      VARCHAR(200) NOT NULL,
  `product_category`  ENUM('WIFI_PLAN','CPE','SIM','ADDON') NOT NULL,
  `addon_type`        ENUM('PHYSICAL','DIGITAL'),
  `billing_type`      ENUM('ONE_TIME','RECURRING') NOT NULL DEFAULT 'RECURRING',
  `network_capability` ENUM('4G','5G','BOTH','ANY') NOT NULL DEFAULT 'ANY',
  `is_exclusive`      TINYINT(1)   NOT NULL DEFAULT 0,
  `serial_required`   TINYINT(1)   NOT NULL DEFAULT 0,
  `warranty_value`    INT,
  `warranty_unit`     ENUM('DAYS','MONTHS','YEARS'),
  `status`            TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `product_price_versions` (
  `price_version_id` CHAR(36)       NOT NULL DEFAULT (UUID()),
  `product_id`       CHAR(36)       NOT NULL,
  `base_price_bdt`   DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  `start_date`       DATETIME       NOT NULL,
  `end_date`         DATETIME,
  `status`           ENUM('CURRENT','UPCOMING','EXPIRED') NOT NULL DEFAULT 'UPCOMING',
  `created_at`       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`price_version_id`),
  CONSTRAINT `fk_ppv_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `price_components` (
  `component_id`    CHAR(36)      NOT NULL DEFAULT (UUID()),
  `price_version_id` CHAR(36)     NOT NULL,
  `component_name`  VARCHAR(100)  NOT NULL,
  `component_type`  VARCHAR(50)   NOT NULL,
  `amount_bdt`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `sort_order`      INT           NOT NULL DEFAULT 0,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`component_id`),
  CONSTRAINT `fk_pc_price_version` FOREIGN KEY (`price_version_id`) REFERENCES `product_price_versions` (`price_version_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `physical_addon_compatibility` (
  `compatibility_id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `addon_product_id` CHAR(36) NOT NULL,
  `cpe_product_id`   CHAR(36) NOT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`compatibility_id`),
  UNIQUE KEY `uq_addon_cpe` (`addon_product_id`, `cpe_product_id`),
  CONSTRAINT `fk_pac_addon` FOREIGN KEY (`addon_product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pac_cpe`   FOREIGN KEY (`cpe_product_id`)   REFERENCES `products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- CAMPAIGN ENGINE
-- ============================================================

CREATE TABLE IF NOT EXISTS `campaign_master` (
  `campaign_id`                    CHAR(36)     NOT NULL DEFAULT (UUID()),
  `campaign_name`                  VARCHAR(200) NOT NULL,
  `description`                    TEXT,
  `start_date`                     DATETIME,
  `end_date`                       DATETIME,
  `scope`                          ENUM('ACQ','LC','BOTH') NOT NULL DEFAULT 'ACQ',
  `campaign_trigger_type`          ENUM('RULE_BASED','COUPON_BASED','REFERRAL_BASED','HYBRID') NOT NULL DEFAULT 'RULE_BASED',
  `campaign_rank`                  INT          NOT NULL DEFAULT 0,
  `allow_cod_payment`              TINYINT(1)   NOT NULL DEFAULT 1,
  `allow_online_payment`           TINYINT(1)   NOT NULL DEFAULT 1,
  `on_ownership_transfer_behavior` ENUM('KEEP','REMOVE') NOT NULL DEFAULT 'REMOVE',
  `status`                         TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`                     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `campaign_targeting_rules` (
  `rule_id`              CHAR(36) NOT NULL DEFAULT (UUID()),
  `campaign_id`          CHAR(36) NOT NULL,
  `network_zone_id`      CHAR(36),
  `district_id`          CHAR(36),
  `area_id`              CHAR(36),
  `channel_id`           CHAR(36),
  `sub_channel_id`       CHAR(36),
  `network_type`         ENUM('4G','5G','ANY') NOT NULL DEFAULT 'ANY',
  `min_network_age_days` INT,
  `max_network_age_days` INT,
  `block_id`             VARCHAR(100),
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`rule_id`),
  CONSTRAINT `fk_ctr_campaign`      FOREIGN KEY (`campaign_id`)     REFERENCES `campaign_master` (`campaign_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ctr_network_zone`  FOREIGN KEY (`network_zone_id`) REFERENCES `network_zones` (`network_zone_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ctr_district`      FOREIGN KEY (`district_id`)     REFERENCES `districts` (`district_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ctr_area`          FOREIGN KEY (`area_id`)         REFERENCES `areas` (`area_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ctr_channel`       FOREIGN KEY (`channel_id`)      REFERENCES `channels` (`channel_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ctr_sub_channel`   FOREIGN KEY (`sub_channel_id`)  REFERENCES `sub_channels` (`sub_channel_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `campaign_product_rules` (
  `rule_id`                CHAR(36) NOT NULL DEFAULT (UUID()),
  `campaign_id`            CHAR(36) NOT NULL,
  `product_id`             CHAR(36) NOT NULL,
  `rule_type`              ENUM('EXCLUSIVE','UNAVAILABLE','DISCOUNT') NOT NULL DEFAULT 'DISCOUNT',
  `discount_type`          ENUM('FLAT','PERCENT'),
  `discount_value`         DECIMAL(12,2),
  `applicable_components`  JSON,
  `created_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`rule_id`),
  CONSTRAINT `fk_cpr_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaign_master` (`campaign_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cpr_product`  FOREIGN KEY (`product_id`)  REFERENCES `products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `campaign_discount_mappings` (
  `mapping_id`         CHAR(36)      NOT NULL DEFAULT (UUID()),
  `rule_id`            CHAR(36)      NOT NULL,
  `component_name`     VARCHAR(100)  NOT NULL,
  `discount_amount_bdt` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `created_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`mapping_id`),
  CONSTRAINT `fk_cdm_rule` FOREIGN KEY (`rule_id`) REFERENCES `campaign_product_rules` (`rule_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `coupons` (
  `coupon_id`              CHAR(36)     NOT NULL DEFAULT (UUID()),
  `campaign_id`            CHAR(36)     NOT NULL,
  `coupon_code`            VARCHAR(100) NOT NULL,
  `global_usage_limit`     INT,
  `current_global_uses`    INT          NOT NULL DEFAULT 0,
  `max_uses_per_customer`  INT,
  `status`                 TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`coupon_id`),
  UNIQUE KEY `uq_coupon_code` (`coupon_code`),
  CONSTRAINT `fk_coupons_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaign_master` (`campaign_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `referral_programs` (
  `program_id`                  CHAR(36)     NOT NULL DEFAULT (UUID()),
  `campaign_id`                 CHAR(36)     NOT NULL,
  `start_date`                  DATETIME,
  `end_date`                    DATETIME,
  `max_referrals_per_customer`  INT,
  `is_locked`                   TINYINT(1)   NOT NULL DEFAULT 0,
  `reward_on_signup`            TINYINT(1)   NOT NULL DEFAULT 0,
  `referrer_product_id`         CHAR(36),
  `referrer_reward_type`        VARCHAR(50),
  `referrer_reward_value`       DECIMAL(12,2),
  `referrer_reward_unit`        VARCHAR(50),
  `referral_code_prefix`        VARCHAR(50),
  `referee_config_matrix`       JSON,
  `status`                      TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`program_id`),
  CONSTRAINT `fk_rp_campaign`         FOREIGN KEY (`campaign_id`)        REFERENCES `campaign_master` (`campaign_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_referrer_product` FOREIGN KEY (`referrer_product_id`) REFERENCES `products` (`product_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- REFERRAL SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS `customers` (
  `customer_id`            CHAR(36)     NOT NULL DEFAULT (UUID()),
  `customer_type`          ENUM('B2C','B2B') NOT NULL DEFAULT 'B2C',
  `full_name`              VARCHAR(200) NOT NULL,
  `primary_contact_number` VARCHAR(20),
  `account_status`         ENUM('ACTIVE','EXPIRED','CHURNED') NOT NULL DEFAULT 'ACTIVE',
  `joined_date`            DATETIME,
  `created_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `referral_redemptions` (
  `redemption_id`      CHAR(36) NOT NULL DEFAULT (UUID()),
  `program_id`         CHAR(36) NOT NULL,
  `referrer_customer_id` CHAR(36) NOT NULL,
  `referee_customer_id`  CHAR(36) NOT NULL,
  `referral_code`      VARCHAR(100) NOT NULL,
  `applied_rewards`    JSON,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`redemption_id`),
  CONSTRAINT `fk_rr_program`   FOREIGN KEY (`program_id`)          REFERENCES `referral_programs` (`program_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rr_referrer`  FOREIGN KEY (`referrer_customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rr_referee`   FOREIGN KEY (`referee_customer_id`)  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `referral_reward_ledger` (
  `ledger_id`              CHAR(36)     NOT NULL DEFAULT (UUID()),
  `program_id`             CHAR(36)     NOT NULL,
  `referrer_customer_id`   CHAR(36)     NOT NULL,
  `referee_customer_id`    CHAR(36)     NOT NULL,
  `referral_code`          VARCHAR(100) NOT NULL,
  `reward_status`          ENUM('PENDING','AWAITING_ACTIVATION','AWAITING_PAYMENT','EARNED','APPLIED','FORCE_APPROVED') NOT NULL DEFAULT 'PENDING',
  `reward_rule_snapshot`   JSON,
  `referee_service_active` TINYINT(1)   NOT NULL DEFAULT 0,
  `referee_invoice_paid`   TINYINT(1)   NOT NULL DEFAULT 0,
  `earned_at`              DATETIME,
  `applied_at`             DATETIME,
  `force_approved_at`      DATETIME,
  `force_approved_by`      VARCHAR(200),
  `notification_log`       JSON,
  `created_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ledger_id`),
  CONSTRAINT `fk_rrl_program`   FOREIGN KEY (`program_id`)           REFERENCES `referral_programs` (`program_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rrl_referrer`  FOREIGN KEY (`referrer_customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rrl_referee`   FOREIGN KEY (`referee_customer_id`)  REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- CUSTOMERS & SERVICES
-- ============================================================

CREATE TABLE IF NOT EXISTS `anchors` (
  `anchor_id`    CHAR(36)     NOT NULL DEFAULT (UUID()),
  `customer_id`  CHAR(36)     NOT NULL,
  `order_id`     CHAR(36),
  `test_status`  ENUM('PENDING','SUCCESS','FAIL') NOT NULL DEFAULT 'PENDING',
  `location_tac` VARCHAR(50),
  `network_zone` VARCHAR(150),
  `district`     VARCHAR(150),
  `area`         VARCHAR(150),
  `coordinates`  VARCHAR(100),
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`anchor_id`),
  CONSTRAINT `fk_anchors_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `active_services` (
  `service_id`           CHAR(36)     NOT NULL DEFAULT (UUID()),
  `customer_id`          CHAR(36)     NOT NULL,
  `product_id`           CHAR(36)     NOT NULL,
  `anchor_id`            CHAR(36),
  `current_cpe_inventory_id` CHAR(36),
  `service_status`       ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `activation_date`      DATETIME,
  `expiry_date`          DATETIME,
  `validity_days`        INT,
  `gpfi_msisdn`          VARCHAR(20),
  `cpe_model`            VARCHAR(150),
  `product_category`     ENUM('WIFI_PLAN','CPE','SIM','ADDON'),
  `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`service_id`),
  CONSTRAINT `fk_as_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_as_product`  FOREIGN KEY (`product_id`)  REFERENCES `products` (`product_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_as_anchor`   FOREIGN KEY (`anchor_id`)   REFERENCES `anchors` (`anchor_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `customer_assets` (
  `asset_id`            CHAR(36)     NOT NULL DEFAULT (UUID()),
  `customer_id`         CHAR(36)     NOT NULL,
  `anchor_id`           CHAR(36),
  `product_id`          CHAR(36)     NOT NULL,
  `asset_type`          ENUM('CPE','SIM','PHYSICAL_ADDON') NOT NULL,
  `asset_status`        ENUM('ACTIVE','REPLACED','RETURNED','DEFECTIVE') NOT NULL DEFAULT 'ACTIVE',
  `serial_number`       VARCHAR(100),
  `imei`                VARCHAR(50),
  `installation_date`   DATETIME,
  `warranty_start_date` DATETIME,
  `warranty_end_date`   DATETIME,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`asset_id`),
  CONSTRAINT `fk_ca_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ca_product`  FOREIGN KEY (`product_id`)  REFERENCES `products` (`product_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ca_anchor`   FOREIGN KEY (`anchor_id`)   REFERENCES `anchors` (`anchor_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `asset_replacement_history` (
  `replacement_id`  CHAR(36)      NOT NULL DEFAULT (UUID()),
  `anchor_id`       CHAR(36)      NOT NULL,
  `old_asset_id`    CHAR(36),
  `new_asset_id`    CHAR(36),
  `reason`          ENUM('WARRANTY','PAID','UPGRADE') NOT NULL DEFAULT 'WARRANTY',
  `charge_amount_bdt` DECIMAL(12,2),
  `notes`           TEXT,
  `replaced_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`replacement_id`),
  CONSTRAINT `fk_arh_anchor`     FOREIGN KEY (`anchor_id`)    REFERENCES `anchors` (`anchor_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_arh_old_asset`  FOREIGN KEY (`old_asset_id`) REFERENCES `customer_assets` (`asset_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_arh_new_asset`  FOREIGN KEY (`new_asset_id`) REFERENCES `customer_assets` (`asset_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ORDERS & FULFILLMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS `orders` (
  `order_id`           CHAR(36)      NOT NULL DEFAULT (UUID()),
  `customer_name`      VARCHAR(200),
  `customer_type`      ENUM('B2C','B2B') NOT NULL DEFAULT 'B2C',
  `contact_msisdn`     VARCHAR(20),
  `channel_id`         CHAR(36),
  `sub_channel_id`     CHAR(36),
  `assigned_agent_id`  CHAR(36),
  `assigned_dh_kam_id` CHAR(36),
  `staff_user_id`      CHAR(36),
  `order_status`       ENUM('PENDING_DISPATCH','OUT_FOR_DELIVERY','ACTIVE','CANCELLED','ASSIGNED','CONTACTED','NETWORK_TEST','INSTALLED') NOT NULL DEFAULT 'PENDING_DISPATCH',
  `fulfillment_status` ENUM('PAID_AWAITING_INSTALLATION','PROVISIONAL','EARNED','CANCELLED','REFUNDED'),
  `payment_status`     ENUM('PENDING_COD','PAID_COD','ONLINE_PAID') NOT NULL DEFAULT 'PENDING_COD',
  `final_total_bdt`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `price_snapshot_date` DATETIME,
  `created_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_id`),
  CONSTRAINT `fk_orders_channel`     FOREIGN KEY (`channel_id`)     REFERENCES `channels` (`channel_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orders_sub_channel` FOREIGN KEY (`sub_channel_id`) REFERENCES `sub_channels` (`sub_channel_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orders_agent`       FOREIGN KEY (`assigned_agent_id`) REFERENCES `field_agents` (`agent_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `order_items` (
  `item_id`               CHAR(36)      NOT NULL DEFAULT (UUID()),
  `order_id`              CHAR(36)      NOT NULL,
  `product_id`            CHAR(36)      NOT NULL,
  `inventory_id`          CHAR(36),
  `quantity`              INT           NOT NULL DEFAULT 1,
  `unit_price_bdt`        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `locked_unit_price_bdt` DECIMAL(12,2),
  `price_anchor_type`     VARCHAR(50),
  `price_locked_at`       DATETIME,
  `item_fulfillment_status` ENUM('PAID_AWAITING_INSTALLATION','PROVISIONAL','EARNED','CANCELLED','REFUNDED'),
  `fulfillment_date`      DATETIME,
  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  CONSTRAINT `fk_oi_order`   FOREIGN KEY (`order_id`)   REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS `inventory_master` (
  `inventory_id`        CHAR(36)     NOT NULL DEFAULT (UUID()),
  `product_id`          CHAR(36)     NOT NULL,
  `item_type`           ENUM('CPE','SIM','ADDON') NOT NULL,
  `status`              ENUM('IN_WAREHOUSE','ALLOCATED_TO_DH','ALLOCATED_TO_KAM','WITH_AGENT','DELIVERED','DEFECTIVE','IN_GPFI_STAGING','WITH_HUB_MANAGER','WITH_FIELD_STAFF') NOT NULL DEFAULT 'IN_WAREHOUSE',
  `stock_type`          ENUM('GPFI_STAGING','SWAP_BUFFER_STOCK','SALES_STOCK') NOT NULL DEFAULT 'SALES_STOCK',
  `allocated_agent_id`  CHAR(36),
  `allocated_entity_id` CHAR(36),
  `serial_number`       VARCHAR(100),
  `imei`                VARCHAR(50),
  `msisdn`              VARCHAR(20),
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`inventory_id`),
  CONSTRAINT `fk_im_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_transfers` (
  `transfer_id`     CHAR(36)     NOT NULL DEFAULT (UUID()),
  `inventory_id`    CHAR(36)     NOT NULL,
  `from_entity_id`  CHAR(36)     NOT NULL,
  `from_entity_type` VARCHAR(50) NOT NULL,
  `to_entity_id`    CHAR(36)     NOT NULL,
  `to_entity_type`  VARCHAR(50)  NOT NULL,
  `transfer_status` ENUM('PENDING','ACCEPTED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `requested_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `responded_at`    DATETIME,
  `notes`           TEXT,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transfer_id`),
  CONSTRAINT `fk_st_inventory` FOREIGN KEY (`inventory_id`) REFERENCES `inventory_master` (`inventory_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- INVOICING & LEDGERS
-- ============================================================

CREATE TABLE IF NOT EXISTS `onetime_invoices` (
  `invoice_id`               CHAR(36)      NOT NULL DEFAULT (UUID()),
  `customer_id`              CHAR(36)      NOT NULL,
  `parent_summary_invoice_id` CHAR(36),
  `payment_status`           ENUM('PENDING','PAID') NOT NULL DEFAULT 'PENDING',
  `trigger_type`             ENUM('ACQUISITION','CPE_CHANGE','PHYSICAL_ADDON') NOT NULL,
  `charged_amount_bdt`       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `refund_amount_bdt`        DECIMAL(12,2),
  `refund_reason`            TEXT,
  `refunded_at`              DATETIME,
  `created_at`               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`invoice_id`),
  CONSTRAINT `fk_oi_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `transaction_ledger` (
  `ledger_id`             CHAR(36)      NOT NULL DEFAULT (UUID()),
  `customer_id`           CHAR(36)      NOT NULL,
  `product_id`            CHAR(36),
  `product_name`          VARCHAR(200),
  `anchor_id`             CHAR(36),
  `order_id`              CHAR(36),
  `campaign_id`           CHAR(36),
  `campaign_name`         VARCHAR(200),
  `trigger_type`          ENUM('ACQUISITION','CPE_CHANGE','PHYSICAL_ADDON'),
  `total_pre_discount_bdt` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_discount_bdt`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_payable_bdt`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `price_breakdown`       JSON,
  `discount_breakdown`    JSON,
  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ledger_id`),
  CONSTRAINT `fk_tl_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- AUDIT & COMPLIANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `log_id`           CHAR(36)     NOT NULL DEFAULT (UUID()),
  `target_table`     VARCHAR(100) NOT NULL,
  `target_record_id` CHAR(36),
  `action_type`      ENUM('CREATE','UPDATE','DELETE','BULK_IMPORT','STATUS_CHANGE') NOT NULL,
  `admin_id`         CHAR(36),
  `ip_address`       VARCHAR(45),
  `previous_state`   JSON,
  `new_state`        JSON,
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `system_audit_logs` (
  `log_id`     CHAR(36)     NOT NULL DEFAULT (UUID()),
  `table_name` VARCHAR(100) NOT NULL,
  `record_id`  CHAR(36),
  `changed_by` VARCHAR(200),
  `changed_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `old_value`  JSON,
  `new_value`  JSON,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
