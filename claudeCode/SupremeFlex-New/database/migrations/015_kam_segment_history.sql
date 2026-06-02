-- Migration 015: KAM segment history
-- One active segment per KAM at a time; transfers tracked via effective_from/until

ALTER TABLE kam_segment_assignments
  ADD COLUMN effective_from  DATE         NOT NULL DEFAULT (CURDATE()) AFTER segment_id,
  ADD COLUMN effective_until DATE         NULL                          AFTER effective_from,
  ADD COLUMN transfer_reason VARCHAR(255) NULL                          AFTER effective_until;

-- Enforce only one active (effective_until IS NULL) segment per KAM
-- NULL values are not considered equal in UNIQUE indexes so this correctly
-- allows multiple historical rows while blocking two active rows for the same KAM
CREATE UNIQUE INDEX uq_kam_active_segment ON kam_segment_assignments (kam_id, effective_until);

-- Backfill existing seeded rows with a sensible start date
UPDATE kam_segment_assignments SET effective_from = '2026-01-01' WHERE effective_from = CURDATE();
