-- Migration 014: B2B/B2C inventory segregation + KAM segment refactor

-- ── Part 1: inventory_master business segment ────────────────────────────────
ALTER TABLE inventory_master
  ADD COLUMN business_segment ENUM('B2B','B2C') NOT NULL DEFAULT 'B2C'
  AFTER stock_type;

-- ── Part 2: stock_transfers — payment method + WAREHOUSE entity type ─────────
ALTER TABLE stock_transfers
  MODIFY COLUMN from_entity_type ENUM('WAREHOUSE','FIELD_STAFF','DH','KAM','CHANNEL','SUB_CHANNEL') NOT NULL,
  MODIFY COLUMN to_entity_type   ENUM('WAREHOUSE','FIELD_STAFF','DH','KAM','CHANNEL','SUB_CHANNEL') NOT NULL,
  ADD COLUMN payment_method      ENUM('ON_CREDIT','UPFRONT') NULL AFTER notes;

-- ── Part 3: KAM segment lookup table ─────────────────────────────────────────
CREATE TABLE kam_segments (
  segment_id   BINARY(16)   NOT NULL,
  segment_name VARCHAR(100) NOT NULL,
  status       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (segment_id),
  UNIQUE KEY uq_segment_name (segment_name)
);

-- ── Part 4: KAM ↔ segment join table ─────────────────────────────────────────
CREATE TABLE kam_segment_assignments (
  kam_id     BINARY(16) NOT NULL,
  segment_id BINARY(16) NOT NULL,
  created_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kam_id, segment_id),
  CONSTRAINT fk_ksa_kam     FOREIGN KEY (kam_id)     REFERENCES kams(kam_id),
  CONSTRAINT fk_ksa_segment FOREIGN KEY (segment_id) REFERENCES kam_segments(segment_id)
);

-- ── Part 5: Seed the 3 initial segments ──────────────────────────────────────
INSERT INTO kam_segments (segment_id, segment_name) VALUES
  (UNHEX(REPLACE(UUID(),'-','')), 'Prime'),
  (UNHEX(REPLACE(UUID(),'-','')), 'Large Account'),
  (UNHEX(REPLACE(UUID(),'-','')), 'SME');

-- ── Part 6: Migrate existing JSON assigned_segments → join table ──────────────
INSERT INTO kam_segment_assignments (kam_id, segment_id)
SELECT k.kam_id, ks.segment_id
FROM kams k
JOIN kam_segments ks
  ON JSON_CONTAINS(k.assigned_segments, JSON_QUOTE(ks.segment_name))
WHERE k.assigned_segments IS NOT NULL;

-- ── Part 7: Drop the old JSON column ─────────────────────────────────────────
ALTER TABLE kams DROP COLUMN assigned_segments;
