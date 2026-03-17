# Memory: index.md
Updated: now

Enterprise telecom admin console (SupremeFlex). Inter font, slate palette, blue primary (217 91% 60%), 6px radius.

- Currency: Always "BDT" via src/lib/currency.ts
- Sidebar: Dark slate, 10 nav items, collapsible icon mode
- Design tokens: success (green), warning (amber), destructive (red) in index.css
- DB tables (Phase 1): user_account, role_master, permission_master, role_permission, user_role
- DB tables (Phase 2): network_zones, districts, areas, channels, sub_channels
- DB tables (Phase 7): customers, active_services, onetime_invoices
- DB enums (Phase 7): account_status, service_status, invoice_trigger_type, invoice_payment_status
- RLS: Dev mode open (dev_full_*), Secure mode to enforce RBAC later
- DevMode toggle: src/contexts/DevModeContext.tsx, persisted in localStorage
- Supabase client: auto-generated at src/integrations/supabase/client.ts — do NOT overwrite
- Master Data: tabbed layout at /master-data with 5 CRUD tabs
- Expiry calc: WIFI_PLAN = activation_date + validity_days + 1; others = activation_date + validity_days
- updated_at trigger function: public.update_updated_at_column() — reuse for all new tables
