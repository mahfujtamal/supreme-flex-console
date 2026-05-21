-- Migration 007: Auth Hardening (P-1.2)
-- OTP: plaintext code → SHA-256 hash + per-row salt
-- Run: mysql -u root -p supremeflex < database/migrations/007_auth_hardening.sql

ALTER TABLE `otp_codes`
  CHANGE COLUMN `code` `code_hash` CHAR(64) NOT NULL COMMENT 'SHA-256(code || salt) hex',
  ADD COLUMN `salt` CHAR(64) NOT NULL DEFAULT '' AFTER `code_hash`;

-- Remove the DEFAULT '' placeholder (salt must always be set by application)
ALTER TABLE `otp_codes`
  ALTER COLUMN `salt` DROP DEFAULT;
