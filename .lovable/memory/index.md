# Memory: index.md
Updated: now

Enterprise telecom admin console (SupremeFlex). Inter font, slate palette, blue primary (217 91% 60%), 6px radius.

- Currency: Always "BDT" via src/lib/currency.ts
- Sidebar: Dark slate, 8 nav items, collapsible icon mode
- Design tokens: success (green), warning (amber), destructive (red) in index.css
- DB tables (Phase 1): user_account, role_master, permission_master, role_permission, user_role
- DB tables (Phase 2): network_zones, districts, areas, channels, sub_channels
- DB tables (Phase 4): campaign_master, campaign_product_rules, campaign_targeting_rules, coupons, referral_programs, customer_referral_codes, referral_usage_history
- DB tables (Phase 5): inventory_master, orders, order_items
- DB tables (Phase 6): admin_roles (JSONB permissions), admin_users, audit_logs (audit_action_type enum)
- RLS: Dev-mode open policies (dev_full_*) on all public tables for testing
- Supabase client: auto-generated at src/integrations/supabase/client.ts — do NOT overwrite
- Master Data: tabbed layout at /master-data with 5 CRUD tabs
- Governance: tabbed layout at /governance with Admin Users + Admin Roles tabs
- Logs: /logs (component at src/pages/governance/AuditLogs.tsx) with filterable audit trail + JSON diff viewer
- Dev/Secure Mode: Toggle in header via DevModeContext (src/contexts/DevModeContext.tsx), persisted in localStorage. Use `useDevMode()` hook to check `isDevMode` before enforcing RBAC.
- updated_at trigger function: public.update_updated_at_column() — reuse for all new tables
