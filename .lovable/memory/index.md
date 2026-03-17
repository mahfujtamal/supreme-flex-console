Enterprise telecom admin console (SupremeFlex). Inter font, slate palette, blue primary (217 91% 60%), 6px radius.

- Currency: Always "BDT" via src/lib/currency.ts (formatBDT)
- Sidebar: Dark slate, 8 nav items, collapsible icon mode
- Design tokens: success (green), warning (amber), destructive (red) in index.css
- DB tables (Phase 1): user_account, role_master, permission_master, role_permission, user_role
- DB tables (Phase 2): network_zones, districts, areas, channels, sub_channels
- DB tables (Phase 3): products, physical_addon_compatibility, product_price_versions
- DB tables (Phase 4): campaign_master, campaign_targeting_rules, campaign_product_rules
- DB tables (Phase 4B): coupons, referral_programs, customer_referral_codes, referral_usage_history
- DB enums: campaign_scope, ownership_transfer_behavior, campaign_trigger_type, campaign_rule_type, discount_type, campaign_network_type, reward_status, referrer_product_type
- RLS: anon+authenticated open access (dev mode — tighten before production)
- Supabase client: auto-generated at src/integrations/supabase/client.ts — do NOT overwrite
- Master Data: tabbed layout at /master-data with 5 CRUD tabs
- Campaign Engine: tabbed layout with Campaigns, Coupon Management, Referral Programs
- updated_at trigger function: public.update_updated_at_column() — reuse for all new tables
