
-- Remove duplicate territories (keep the oldest entry)
DELETE FROM territories t1
USING territories t2
WHERE t1.territory_id > t2.territory_id
  AND LOWER(t1.territory_name) = LOWER(t2.territory_name);

-- Add unique constraints
ALTER TABLE circles ADD CONSTRAINT circles_circle_name_unique UNIQUE (circle_name);
ALTER TABLE regions ADD CONSTRAINT regions_region_name_unique UNIQUE (region_name);
ALTER TABLE clusters ADD CONSTRAINT clusters_cluster_name_unique UNIQUE (cluster_name);
ALTER TABLE territories ADD CONSTRAINT territories_territory_name_unique UNIQUE (territory_name);
