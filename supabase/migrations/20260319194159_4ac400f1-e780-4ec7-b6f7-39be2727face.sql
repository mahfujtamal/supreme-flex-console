-- Delete price_components for disabled price versions first (child records)
DELETE FROM public.price_components
WHERE price_version_id IN (
  SELECT price_version_id FROM public.product_price_versions WHERE status = false
);

-- Delete disabled price versions
DELETE FROM public.product_price_versions WHERE status = false;