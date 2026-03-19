DELETE FROM public.price_components
WHERE price_version_id IN ('c3c48e2a-c15b-4875-9541-543c91dde610', 'e8460e6d-c892-47e9-8198-5508593cd900');

DELETE FROM public.product_price_versions
WHERE price_version_id IN ('c3c48e2a-c15b-4875-9541-543c91dde610', 'e8460e6d-c892-47e9-8198-5508593cd900');