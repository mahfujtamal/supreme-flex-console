# Memory: index.md
Updated: now

Enterprise telecom admin console (SupremeFlex). Inter font, slate palette, blue primary (217 91% 60%), 6px radius.

- Currency: Always "BDT" via src/lib/currency.ts
- Sidebar: Dark slate, 11 nav items, collapsible icon mode
- Design tokens: success (green), warning (amber), destructive (red) in index.css
- DB tables (Phase 1): user_account, role_master, permission_master, role_permission, user_role
- DB tables (Phase 2): network_zones, districts, areas, channels, sub_channels
- DB tables (Phase 10): price_components, campaign_discount_mappings, transaction_ledger; campaign_master.campaign_rank, campaign_product_rules.applicable_components
- Pricing: Component-based (BASE, VAT, SD + custom levies). Total = sum of components.
- Price-Date Logic: Physical assets (CPE/SIM/Addon) use REQUEST_DATE; Digital (WiFi Plan) use FULFILLMENT_DATE
- Fulfillment: orders.fulfillment_status + order_items.item_fulfillment_status (PAID_AWAITING_INSTALLATION→PROVISIONAL→EARNED)
- Refunds: onetime_invoices has refund_amount_bdt, refunded_at, refund_reason columns
- Discounts: PERCENT targets selected components; FLAT requires per-component breakdown that sums to total.
- Transaction ledger: Immutable price+discount snapshot at fulfillment (JSONB breakdowns).
- RLS: Authenticated read/write all (to be tightened with admin roles later)
- Supabase client: auto-generated at src/integrations/supabase/client.ts — do NOT overwrite
- Master Data: tabbed layout at /master-data with 5 CRUD tabs
- updated_at trigger function: public.update_updated_at_column() — reuse for all new tables
