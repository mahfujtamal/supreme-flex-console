-- Migration 020: Enforce one-area-one-DH and unique phone numbers
-- Duplicates in dh_area_assignments were cleaned up before this migration.

ALTER TABLE dh_area_assignments
  ADD CONSTRAINT uq_daa_area UNIQUE (area_id);

ALTER TABLE distribution_houses
  ADD CONSTRAINT uq_dh_phone UNIQUE (phone_number);
