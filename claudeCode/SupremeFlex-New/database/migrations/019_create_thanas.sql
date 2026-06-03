-- Migration 019: Create thanas table and link areas to thanas
-- Inserts Thana as a geographic level between District and Area.
-- thana_id on areas is nullable so existing 6850 areas remain valid; ops team fills it via bulk import.

CREATE TABLE thanas (
  thana_id    BINARY(16)   NOT NULL,
  thana_name  VARCHAR(150) NOT NULL,
  district_id BINARY(16)   NOT NULL,
  status      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (thana_id),
  CONSTRAINT fk_thanas_district FOREIGN KEY (district_id) REFERENCES districts (district_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE areas
  ADD COLUMN thana_id BINARY(16) NULL AFTER district_id,
  ADD CONSTRAINT fk_areas_thana FOREIGN KEY (thana_id) REFERENCES thanas (thana_id);
