
-- Remove duplicate areas (keep oldest)
DELETE FROM areas a1
USING areas a2
WHERE a1.area_id > a2.area_id
  AND LOWER(a1.area_name) = LOWER(a2.area_name);

-- Add unique constraint
ALTER TABLE areas ADD CONSTRAINT areas_area_name_unique UNIQUE (area_name);
