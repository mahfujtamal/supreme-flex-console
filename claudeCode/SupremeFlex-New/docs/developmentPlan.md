# SupremeFlex — Development Roadmap
**Date: 2026-05-18 | Platform: GPFI — Grameenphone FWA**

---

## What Is Already Built

| Layer | Status | Detail |
|-------|--------|--------|
| Database schema | ✅ Done | 39 tables, 32 triggers, 3 stored procedures (migrations 001–003); OTP table (migration 004) |
| PHP routes | ✅ Done | 50+ endpoints in routes/api.php |
| PHP controllers | ✅ Done | All controllers scaffolded (BaseApiController + all domain controllers) |
| Node.js routes | ✅ Done | fieldExecution, stockTransfers, dashboard — all with real logic |
| WebSocket | ✅ Done | ws://localhost:8001/ws/dashboard — 10s push |
| OTP Auth | ✅ Done | Mobile number → 6-digit OTP → JWT; `otp_codes` table; `/login` page; `AuthContext`; `(app)` route group with auth guard |
| Frontend layout | ✅ Done | AppSidebar, AppHeader (real username + logout), ThemeProvider, JWT auto-attach; authenticated shell in `app/(app)/layout.tsx` |
| A1 bug fix | ✅ Done | allocated_entity_id mismatch fixed (commit 6b6715d) |

### Needs Building
- All 16 frontend pages are `<pre>JSON.stringify(data)</pre>` stubs
- Bulk operation endpoints + UI
- GPWEB-3730 feature set (5 features)
- Hub Manager removal migration
- Bug fixes A2–A6

---

## How We Work

**You confirm each step before I proceed to the next.**
Each step ends with a "How to verify" section. You test → confirm → I proceed.

---

## BLOCK A — Bug Fixes

| Step | Status | What | Files |
|------|--------|------|-------|
| A1 | ✅ Done | Fix allocated_entity_id mismatch | dashboard.js |
| A2 | TODO | Node.js try-catch on all route handlers | fieldExecution.js, stockTransfers.js, dashboard.js, dashboardBroadcast.js |
| A3 | TODO | JWT_SECRET startup guard | backend-node/src/index.js |
| A4 | TODO | StockTransferController race condition (SELECT FOR UPDATE) | StockTransferController.php |
| A5 | TODO | Fix audit attribution (always auth()->id()) | AuditLogController.php |
| A6 | ✅ Done | AppHeader: real username + logout button (OTP auth) | frontend/components/layout/AppHeader.tsx |

---

## BLOCK B — Frontend Foundation

| Step | What | Files |
|------|------|-------|
| B1 | `DataTable` — paginated, total-page-aware, row checkboxes for bulk ops | components/ui/DataTable.tsx |
| B2 | `StatusBadge` — ENUM → colored Badge | components/ui/StatusBadge.tsx |
| B3 | `ConfirmDialog` — reusable confirmation modal | components/ui/ConfirmDialog.tsx |
| B4 | `useDebounce` hook | hooks/useDebounce.ts |
| B5 | Fix `lib/api.ts` — 401 interceptor (auto-logout), timeout | lib/api.ts |
| B6 | ✅ Done | Fix `AppHeader` — real username + logout (done via OTP auth) | components/layout/AppHeader.tsx |
| B7 | TypeScript strict mode + fix type errors | tsconfig.json + page stubs |
| B8 | `ConnectionSelector` — connection picker for order flows | components/ui/ConnectionSelector.tsx |
| B9 | `DevPanel` — dev-mode lifecycle toggle overlay | components/ui/DevPanel.tsx |
| B10 | `BulkActionBar` — shows on row selection; Insert/Update/Delete(dev-only) | components/ui/BulkActionBar.tsx |
| B11 | `BulkImportModal` — CSV template download + drag-drop upload + preview | components/ui/BulkImportModal.tsx |

---

## BLOCK C — Real UI for Existing Pages

**Bulk pattern (all except B2C order flows, read-only dashboards, logs):**
- Row checkboxes → BulkActionBar → Bulk Insert (CSV) / Bulk Update / Bulk Delete (dev-only)
- All bulk ops audit-logged

| Step | Route | What Gets Built | Bulk |
|------|-------|-----------------|------|
| C1 | `/master-data` | 9 tabs: Zones, Districts, Areas, Channels (+delivery_mode/pull_mode), Sub-Channels (+delivery_mode/pull_mode), DHs (+manager), Field Agents, KAMs. Hub Managers tab removed. | ✅ |
| C2 | `/product-engine` | Products, Addon Compatibility (+location/DH scope), Pricing Versions | ✅ |
| C3 | `/pricing-engine` | Timeline price list + Add version form | ✅ |
| C4 | `/campaign-engine` | Campaigns (+Clone), Coupons, Referral Programs, Targeting Rules, Product Rules | ✅ |
| C5 | `/customers` + `/customers/[id]` | List → Customer 360 (per-connection tabs) + lifecycle badge + DevPanel | ✅ list only |
| C6 | `/invoicing` | Invoice list + Ledger + Summary Invoice generator | ✅ |
| C7 | `/assets` | Assets table + Replace action | ✅ |
| C8 | `/bulk-inwarding` | CSV upload form (existing bulk insert) | existing |
| C9 | `/stock-transfers` | List + ACCEPT/REJECT + bulk respond | ✅ |
| C10 | `/gpfi-dashboard` | Live stock flow chart, WebSocket | ❌ read-only |
| C11 | `/manager-dashboard` | Unified — adapts to logged-in manager's entity (DH/Channel/Sub-Channel), WebSocket | ❌ read-only |
| C12 | `/field-execution` | Lead cards with status progression | ❌ B2C order flow |
| C13 | `/governance` | Admin Users + Roles + Permissions | ✅ |
| C14 | `/operations` | Inventory levels by location | ✅ |
| C15 | `/logs` | Audit log table with filters | ❌ read-only |

> `/hub-manager-dashboard` is replaced by `/manager-dashboard` (C11).

---

## BLOCK D — Database Migrations

| Step | File | What |
|------|------|------|
| ~~004~~ | ✅ Done | `004_otp_auth.sql` — OTP auth: `contact_number` on `user_account`; `otp_codes` table |
| D0 | `005_remove_hub_manager.sql` | DROP hub_managers; ALTER field_agents DROP hub_manager_id; ALTER kams DROP hub_manager_id; ADD manager_admin_id to channels/sub_channels/distribution_houses; MODIFY inventory_master status ENUM; MODIFY stock_transfers entity_type ENUM |
| D1 | `006_gpweb3730_new_tables.sql` | system_config; ALTER existing tables; NEW: addon_order_history, cpe_order_history, ott_order_history, location_change_history, real_ip_assignments, tac_area_mapping |
| D2 | `007_gpweb3730_triggers.sql` | BEFORE UPDATE triggers for 5 new tables |
| D3 | `008_add_indexes.sql` | Missing FK/status indexes on existing tables |
| D4 | `009_delivery_routing.sql` | ALTER channels/sub_channels/distribution_houses/kams (delivery + pull mode); NEW: order_delivery_overrides |

---

## BLOCK E — PHP APIs

| Step | What | Files |
|------|------|-------|
| E0 | 4 Mock API services (GpShop, LocationChangeApi, RealIpApi, CustomerLifecycle) | app/Services/ |
| E1 | SmsService + config/sms.php | app/Services/SmsService.php |
| E2 | SystemConfigController | SystemConfigController.php |
| E3 | InternalController + InternalKeyMiddleware | InternalController.php |
| E4 | Extend AddonCompatibilityController | existing |
| E5 | AddonOrderController + AutoCancelAddonOrders (GpShopService) | AddonOrderController.php |
| E6 | CpeOrderController | CpeOrderController.php |
| E7 | OttOrderController | OttOrderController.php |
| E8 | LocationChangeController (LocationChangeApiService) | LocationChangeController.php |
| E9 | RealIpController + RealIpService + AutoUnassignRealIp | RealIpController.php |
| E10 | Extend CustomerController::view360() | existing |
| E11 | BaseApiController: bulkStore(), bulkUpdate(), bulkDestroy() | BaseApiController.php |
| E12 | Update routes/api.php | existing |

---

## BLOCK F — Node.js APIs

| Step | What | Files |
|------|------|-------|
| F1 | phpBridge.js — PHP internal SMS caller | services/phpBridge.js |
| F2 | Accessories CRUD on lead card | routes/fieldExecution.js |
| F3 | setup-complete endpoint (CPE swap + plan upgrade + SMS) | routes/fieldExecution.js |

---

## BLOCK G — Frontend Pages (GPWEB-3730)

| Step | What | Files |
|------|------|-------|
| G1 | `/accessories` — Accessories History | app/accessories/page.tsx |
| G2 | `/ott-orders` — OTT Orders | app/ott-orders/page.tsx |
| G3 | `/location-change` — Lookup + form + history | app/location-change/page.tsx |
| G4 | `/real-ip` — Real IP table + actions | app/real-ip/page.tsx |
| G5 | Product Engine — Addon Compat + Display Config tabs | existing |
| G6 | Asset Lifecycle — CPE History tab + modal | existing |
| G7 | Customer 360 — 7 tabs + lifecycle + DevPanel | app/customers/[id]/page.tsx |
| G8 | Sidebar — 4 new nav entries | AppSidebar.tsx |

---

## BLOCK H — Delivery Routing UI

| Step | What | Files |
|------|------|-------|
| H1 | Channel/Sub-Channel delivery + pull mode fields (part of C1) | master-data page |
| H2 | `lib/deliveryRouting.ts` — delivery agent resolution | lib/deliveryRouting.ts |
| H3 | Order delivery override UI on order creation modals | order modals |

---

## Recommended Starting Point

1. **A2 + A3** — Node error handling + JWT guard (quick, foundational)
2. **D0** — Hub Manager removal (structural, run before building any UI)
3. **B1–B4** — DataTable, StatusBadge, ConfirmDialog, useDebounce (unblocks all C steps)
4. **C1** — Master Data (first real page, validates the full stack)
