-- Migration 004: OTP-based authentication
-- Replaces email+password login with mobile OTP.
-- Run: mysql -u root -p supremeflex < database/migrations/004_otp_auth.sql

ALTER TABLE `user_account`
  ADD COLUMN `contact_number` VARCHAR(20) NULL AFTER `email`,
  ADD UNIQUE KEY `uq_user_contact` (`contact_number`);

CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id`             BINARY(16) NOT NULL,
  `contact_number` VARCHAR(20) NOT NULL,
  `code`           CHAR(6)     NOT NULL,
  `expires_at`     DATETIME    NOT NULL,
  `used`           TINYINT(1)  NOT NULL DEFAULT 0,
  `created_at`     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_otp_contact` (`contact_number`, `used`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
