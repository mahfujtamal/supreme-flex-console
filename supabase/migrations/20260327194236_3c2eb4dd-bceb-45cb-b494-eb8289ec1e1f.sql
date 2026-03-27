ALTER TABLE public.areas DROP CONSTRAINT areas_area_name_unique;
ALTER TABLE public.areas ADD CONSTRAINT areas_district_area_unique UNIQUE (district_id, area_name);