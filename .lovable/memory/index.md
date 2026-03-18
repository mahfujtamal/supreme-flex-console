# Memory: index.md
Updated: now

Enterprise telecom admin console (SupremeFlex). Inter font, slate palette, blue primary (217 91% 60%), 6px radius.

- Currency: Always "BDT" via src/lib/currency.ts
- Sidebar: Dark slate, 11 nav items, collapsible icon mode
- Design tokens: success (green), warning (amber), destructive (red) in index.css
- DB tables (Phase 1): user_account, role_master, permission_master, role_permission, user_role
- DB tables (Phase 2): network_zones, districts, areas, channels, sub_channels
- DB tables (Phase 7): customers, anchors, active_services, onetime_invoices
- DB tables (Phase 7.1): customer_assets, asset_replacement_history
- DB tables (Phase 8): distribution_houses, field_agents, kams
- DB enums (Phase 7): account_status, service_status, invoice_trigger_type, invoice_payment_status, test_status
- DB enums (Phase 7.1): asset_status, asset_type, replacement_reason (WARRANTY/PAID/UPGRADE)
- DB enums (Phase 8): dh_status, agent_status (ACTIVE/INACTIVE); order_status extended: ASSIGNED, CONTACTED, NETWORK_TEST, INSTALLED
- Channels: is_assisted boolean added (assisted channels require sub_channel)
- Anchors: Created at LEAD/ORDER stage, link customer→order with location test data
- Active services: linked to anchor_id, gpfi_msisdn UNIQUE, cpe_model column
- Customer assets: linked to anchor_id, serial_number UNIQUE, warranty tracking
- Warranty rules: CPE=365 days, ADDON=180 days from installation_date. NO +1 rule for warranty.
- RLS: Dev mode open (dev_full_*), Secure mode to enforce RBAC later
- DevMode toggle: src/contexts/DevModeContext.tsx, persisted in localStorage
- Supabase client: auto-generated at src/integrations/supabase/client.ts — do NOT overwrite
- Master Data: tabbed layout at /master-data with 8 CRUD tabs (zones, districts, areas, channels, sub-channels, DHs, agents, KAMs)
- Expiry calc: WIFI_PLAN = activation_date + validity_days + 1; others = activation_date + validity_days
- updated_at trigger function: public.update_updated_at_column() — reuse for all new tables
- Customer 360: 4-tab lifecycle view (Anchors/Orders, Service Details, Physical Assets, Network Info)
- Asset Lifecycle: /assets page with search by serial/GPFI/mobile, type/status filters
- Asset replacement: History timeline dialog + Replace CPE dialog in Customer 360
- Asset replacement logs: asset_replacement_history table with old/new asset refs + reason
- DH bulk CSV: dh_code, name, district_name, area_name
- Agent bulk CSV: agent_id, agent_name, msisdn, dh_code (FK mapped)
- KAM bulk CSV: kam_id, name, msisdn, segments (pipe-delimited)
- Work Order Lifecycle: PENDING_DISPATCH→ASSIGNED→CONTACTED→OUT_FOR_DELIVERY→NETWORK_TEST→INSTALLED (or CANCELLED at any stage)
- Smart Dispatch: B2C = round-robin DH by oldest last_assigned_at; B2B = direct KAM assignment
- Cancel reasons: Customer Refused, Unreachable, Wrong Address, FI Test Failed, Inventory Issue, Other
- Cancel safety: inventory returns to WITH_AGENT on cancel
- Installation form: pre-populated from order, override from WITH_AGENT inventory, SIM selection defines gpfi_msisdn
- Fulfillment: creates customer_assets (ACTIVE, 365d warranty), active_services (WiFi +1 day expiry), onetime_invoices
