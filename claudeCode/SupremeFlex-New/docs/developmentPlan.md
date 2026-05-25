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

### Completed (as of 2026-05-24 — all Blocks A–H)
- All 16 frontend pages — real UI built in Blocks B–C
- Bulk operation endpoints + UI — `BaseApiController` bulkStore/Update/Destroy + `BulkActionBar` + `BulkImportModal`
- GPWEB-3730 feature set — all 5 features delivered across Blocks D–H
- Hub Manager removal — migration 005 (Block D)
- Bug fixes A2–A6 all complete; P-1.7 (DB topology + Redis + queue) merged

### Still To Do — Block 0 items only
- **P-1.1** UUIDv7/BINARY(16) PK migration (Large)
- **P-1.2** Auth hardening — OTP hashing, JWT cookies, RBAC, WS auth (Large)
- **P-1.3** Idempotency-Key middleware — PHP + Node (Medium)
- **P-1.4** PHP test harness — PHPUnit + GitHub Actions CI (Medium)
- **P-1.5** Boot-time production guards — PHP + Node (Small)

---

## How We Work

**You confirm each step before I proceed to the next.**
Each step ends with a "How to verify" section. You test → confirm → I proceed.

**Planning-only mode is the default.** No code, migrations, configs, or env edits happen until you explicitly say "start coding". See `CLAUDE.md` → Workflow Mode.

---

## BLOCK 0 — Phase -1 Foundation Hardening

**Why this block exists:** At 3–10M GPFI subscriber target scale, security and scale foundations must precede feature code. Each item below is a one-way door — cheap now, expensive to retrofit later. See `docs/plan.md` Phase -1 for the full decision-grade write-up of each item (problem, solution, exit criteria).

**BLOCK 0 must complete before BLOCK A.** Items P-1.1 (PK strategy) and P-1.2 (auth hardening) constrain everything in Blocks B–H.

| Step | What | Files / Effort |
|------|------|----------------|
| P-1.1 | **UUIDv7 / BINARY(16) PK migration** — 48 tables across 9 FK dependency waves; shadow-column approach; `011_pk_strategy.sql` (Phases A/B/C/D) + `011_pk_strategy_rollback.sql`; `app/Helpers/UuidHelper.php` (PHP) + `src/helpers/uuid.js` (Node); `services/db.js` queryById/mapRow helpers; all 32 triggers + 3 SPs rewritten with BINARY(16) params; 7-item pre-migration checklist must pass before coding starts. See `docs/plan.md` P-1.1 for full blueprint. | `database/migrations/011_pk_strategy.sql`, `app/Helpers/UuidHelper.php`, all PHP controllers, `src/helpers/uuid.js`, `services/db.js`. **L** |
| P-1.2 | **Auth hardening** — 14 verified gaps closed: OTP SHA-256+salt + rate-limit (5/h msisdn, 20/d IP) + lockout (5 fails/15min); JWT access 15min + refresh 7d in httpOnly cookies; `jti`+`staff_type` in payload; Redis revocation + RBAC cache; new `PermissionMiddleware` calling `has_role()` SP; WS upgrade auth; frontend `withCredentials`; server-side logout; `012_auth_hardening.sql`. `predis/predis` dep required. See `docs/plan.md` P-1.2. | `012_auth_hardening.sql`, `AuthController.php`, `JwtMiddleware.php`, new `PermissionMiddleware.php`, `api.php`, `src/middleware/auth.js`, `src/index.js`, 3 Node routers, `lib/api.ts`, `AuthContext.tsx`. **L** |
| P-1.3 | **Idempotency-Key middleware** — Redis-backed `(key, request_hash, response)` store, 24h TTL; applied to all mutating endpoints | New `IdempotencyMiddleware.php`, new Node `idempotency.js`. **M** |
| P-1.4 | **Test harness** — PHPUnit (PHP) + Vitest + supertest (Node) + GitHub Actions CI; coverage targets per layer; contract tests for the 4 mock services | `phpunit.xml`, `backend-php/tests/`, `backend-node/test/`, `.github/workflows/test.yml`. **M** |
| P-1.5 | **Boot-time production guards** — throw on `APP_ENV=production` + any `*_MOCK=true` / `APP_DEBUG=true` / dev flag; build-step strip of dev-only routes (bulk delete, dev-OTP-peek) | `AppServiceProvider.php`, `backend-node/src/index.js`. **S** |
| P-1.6 | **Drupal removal decision** — kill from architecture; texts → `system_config`; reporting → Metabase deferred to post-launch | Doc-only changes (Drupal never integrated — `/drupal/` directory is empty). **S** |
| P-1.7 | ✅ Done | **DB topology + Redis + queue** — 1 primary + 2 read replicas with ProxySQL; Redis for cache/session/queue/idempotency/revocation; Laravel Horizon replaces daily Artisan crons; partition `audit_logs` / `transaction_ledger` / `otp_codes` monthly; backup (binlogs + XtraBackup; RTO 15min, RPO 5min) | Infra config (out-of-repo) + app-side read-write split, Horizon config, partition migrations. **L** |

**Exit criteria for BLOCK 0:** see `docs/plan.md` Phase -1 for per-item acceptance tests.

**Internal sequencing within BLOCK 0:**
- **Must complete before BLOCK A:** P-1.1, P-1.2, P-1.5
- **Parallel with BLOCK A/B:** P-1.3, P-1.4
- **Doc-only, anytime:** P-1.6
- **Infra parallel; app-side queue refactor before E5–E10:** P-1.7

---

## BLOCK A — Bug Fixes

| Step | Status | What | Files |
|------|--------|------|-------|
| A1 | ✅ Done | Fix allocated_entity_id mismatch | dashboard.js |
| A2 | ✅ Done | Node.js try-catch on all route handlers | fieldExecution.js, stockTransfers.js, dashboard.js, dashboardBroadcast.js |
| A3 | ✅ Done | JWT_SECRET startup guard | backend-node/src/index.js |
| A4 | ✅ Done | StockTransferController race condition (SELECT FOR UPDATE) | StockTransferController.php |
| A5 | ✅ Done | Fix audit attribution (always auth()->id()) | AuditLogController.php |
| A6 | ✅ Done | AppHeader: real username + logout button (OTP auth) | frontend/components/layout/AppHeader.tsx |

---

## BLOCK B — Frontend Foundation

| Step | What | Files |
|------|------|-------|
| B1 | ✅ Done | `DataTable` — paginated, total-page-aware, row checkboxes for bulk ops | components/ui/DataTable.tsx |
| B2 | ✅ Done | `StatusBadge` — ENUM → colored Badge | components/ui/StatusBadge.tsx |
| B3 | ✅ Done | `ConfirmDialog` — reusable confirmation modal | components/ui/ConfirmDialog.tsx |
| B4 | ✅ Done | `useDebounce` hook | hooks/useDebounce.ts |
| B5 | ✅ Done | Fix `lib/api.ts` — 401 interceptor (auto-logout), timeout | lib/api.ts |
| B6 | ✅ Done | Fix `AppHeader` — real username + logout (done via OTP auth) | components/layout/AppHeader.tsx |
| B7 | ✅ Done | TypeScript strict mode + fix type errors | tsconfig.json + page stubs |
| B8 | ✅ Done | `ConnectionSelector` — connection picker for order flows | components/ui/ConnectionSelector.tsx |
| B9 | ✅ Done | `DevPanel` — dev-mode lifecycle toggle overlay | components/ui/DevPanel.tsx |
| B10 | ✅ Done | `BulkActionBar` — shows on row selection; Insert/Update/Delete(dev-only) | components/ui/BulkActionBar.tsx |
| B11 | ✅ Done | `BulkImportModal` — CSV template download + drag-drop upload + preview | components/ui/BulkImportModal.tsx |

---

## BLOCK C — Real UI for Existing Pages

**Bulk pattern (all except B2C order flows, read-only dashboards, logs):**
- Row checkboxes → BulkActionBar → Bulk Insert (CSV) / Bulk Update / Bulk Delete (dev-only)
- All bulk ops audit-logged

| Step | Route | What Gets Built | Bulk |
|------|-------|-----------------|------|
| C1 | ✅ Done | `/master-data` | 9 tabs: Zones, Districts, Areas, Channels (+delivery_mode/pull_mode), Sub-Channels (+delivery_mode/pull_mode), DHs (+manager), Field Agents, KAMs. Hub Managers tab removed. |
| C2 | ✅ Done | `/product-engine` | Products, Addon Compatibility (+location/DH scope), Pricing Versions |
| C3 | ✅ Done | `/pricing-engine` | Timeline price list + Add version form |
| C4 | ✅ Done | `/campaign-engine` | Campaigns (+Clone), Coupons, Referral Programs, Targeting Rules, Product Rules |
| C5 | ✅ Done | `/customers` + `/customers/[id]` | List → Customer 360 (per-connection tabs) + lifecycle badge + DevPanel |
| C6 | ✅ Done | `/invoicing` | Invoice list + Ledger + Summary Invoice generator |
| C7 | ✅ Done | `/assets` | Assets table + Replace action + CPE History tab |
| C8 | ✅ Done | `/bulk-inwarding` | CSV upload form (existing bulk insert) |
| C9 | ✅ Done | `/stock-transfers` | List + ACCEPT/REJECT + bulk respond |
| C10 | ✅ Done | `/gpfi-dashboard` | Live stock flow chart, WebSocket |
| C11 | ✅ Done | `/manager-dashboard` | Unified — adapts to logged-in manager's entity (DH/Channel/Sub-Channel), WebSocket |
| C12 | ✅ Done | `/field-execution` | Lead cards with status progression |
| C13 | ✅ Done | `/governance` | Admin Users + Roles + Permissions |
| C14 | ✅ Done | `/operations` | Inventory levels by location |
| C15 | ✅ Done | `/logs` | Audit log table with filters |

> `/hub-manager-dashboard` is replaced by `/manager-dashboard` (C11).

---

## BLOCK D — Database Migrations

| Step | File | What |
|------|------|------|
| ~~004~~ | ✅ Done | `004_otp_auth.sql` — OTP auth: `contact_number` on `user_account`; `otp_codes` table |
| D0 | ✅ Done | `005_remove_hub_manager.sql` | DROP trigger + hub_managers table; DROP hub_manager_id from field_agents + kams; ADD `manager_admin_id CHAR(36) FK → user_account(id)` to channels/sub_channels/distribution_houses; MODIFY inventory_master status ENUM (remove WITH_HUB_MANAGER); MODIFY stock_transfers.to_entity_type → ENUM('FIELD_STAFF','DH','KAM'). Also: add `staff_type` to JWT payload; add `/dashboard/manager` Node endpoint; replace /hub-manager-dashboard with /manager-dashboard |
| D0.5 | ✅ Done | `006_order_connection_enforcement.sql` | ADD `anchor_id NOT NULL` + `active_service_id NOT NULL` to `orders`; ADD `is_summary`, `anchor_id`, `active_service_id` + self-ref FK to `onetime_invoices`; MODIFY `transaction_ledger` anchor_id NOT NULL + add `active_service_id` + `invoice_id` FK. Also: update `InvoiceController.$fillable`. |
| D1 | ✅ Done | `007_gpweb3730_new_tables.sql` | system_config; ALTER existing tables; NEW: addon_order_history, cpe_order_history, ott_order_history, location_change_history, real_ip_assignments, tac_area_mapping |
| D2 | ✅ Done | `008_gpweb3730_triggers.sql` | BEFORE UPDATE triggers for 5 new tables |
| D3 | ✅ Done | `009_add_indexes.sql` | Missing FK/status indexes on existing tables |
| D4 | ✅ Done | `010_delivery_routing.sql` | ALTER channels: add `default_delivery_mode` + `inventory_pull_mode`; ALTER sub_channels: add `inventory_pull_mode` only (existing `delivery_ownership` is authoritative); ALTER distribution_houses + kams: add `inventory_pull_mode`; NEW: `order_delivery_overrides` table |

---

## BLOCK E — PHP APIs

| Step | What | Files |
|------|------|-------|
| E0 | ✅ Done | 4 Mock API services (GpShop, LocationChangeApi, RealIpApi, CustomerLifecycle) — interfaces + mock impls + real stubs + AppServiceProvider + config/mock_services.php | app/Services/, app/Providers/, config/, bootstrap/providers.php |
| E1 | ✅ Done | SmsService + config/sms.php | app/Services/SmsService.php |
| E2 | ✅ Done | SystemConfigController | SystemConfigController.php |
| E3 | ✅ Done | InternalController + InternalKeyMiddleware | InternalController.php |
| E4 | ✅ Done | Extend AddonCompatibilityController | existing |
| E5 | ✅ Done | AddonOrderController + AutoCancelAddonOrders (GpShopService) | AddonOrderController.php |
| E6 | ✅ Done | CpeOrderController | CpeOrderController.php |
| E7 | ✅ Done | OttOrderController | OttOrderController.php |
| E8 | ✅ Done | LocationChangeController (LocationChangeApiService) | LocationChangeController.php |
| E9 | ✅ Done | RealIpController + RealIpService + AutoUnassignRealIp | RealIpController.php |
| E10 | ✅ Done | Extend CustomerController::view360() | existing |
| E11 | ✅ Done | BaseApiController: bulkStore(), bulkUpdate(), bulkDestroy() — soft-delete on destroy(); audit log writes; X-Dev-Mode guard on bulkDestroy | BaseApiController.php |
| E12 | ✅ Done | Update routes/api.php — bulk routes (POST/PATCH/DELETE /{resource}/bulk) for 21 admin resources | routes/api.php |

---

## BLOCK F — Node.js APIs

| Step | What | Files |
|------|------|-------|
| F1 | ✅ Done | phpBridge.js — PHP internal SMS caller | services/phpBridge.js |
| F2 | ✅ Done | Accessories CRUD on lead card | routes/fieldExecution.js |
| F3 | ✅ Done | setup-complete endpoint (CPE swap + plan upgrade + SMS) | routes/fieldExecution.js |

---

## BLOCK G — Frontend Pages (GPWEB-3730)

| Step | What | Files |
|------|------|-------|
| G1 | ✅ Done | `/accessories` — Accessories History | app/accessories/page.tsx |
| G2 | ✅ Done | `/ott-orders` — OTT Orders | app/ott-orders/page.tsx |
| G3 | ✅ Done | `/location-change` — Lookup + form + history | app/location-change/page.tsx |
| G4 | ✅ Done | `/real-ip` — Real IP table + actions | app/real-ip/page.tsx |
| G5 | ✅ Done | Product Engine — Addon Compat + Display Config tabs | existing |
| G6 | ✅ Done | Asset Lifecycle — CPE History tab + modal | existing |
| G7 | ✅ Done | Customer 360 — 7 tabs + lifecycle + DevPanel | app/customers/[id]/page.tsx |
| G8 | ✅ Done | Sidebar — 4 new nav entries | AppSidebar.tsx |

---

## BLOCK H — Delivery Routing UI

| Step | What | Files |
|------|------|-------|
| H1 | ✅ Done | Channel/Sub-Channel delivery + pull mode fields (part of C1) | master-data page |
| H2 | ✅ Done | `lib/deliveryRouting.ts` — delivery agent resolution | lib/deliveryRouting.ts |
| H3 | ✅ Done | `DeliveryOverrideSelector` component — drop-in override UI for order modals | components/ui/DeliveryOverrideSelector.tsx |

---

## Current Status (2026-05-25)

**All blocks complete. Codebase merged to `main`.**

| Block | Status |
|-------|--------|
| BLOCK 0 — Phase -1 Foundation Hardening | ✅ Complete — DoD verified locally (2026-05-25) |
| BLOCK A — Bug Fixes | ✅ Complete |
| BLOCK B — Frontend Foundation | ✅ Complete |
| BLOCK C — Real UI for Existing Pages | ✅ Complete |
| BLOCK D — Database Migrations | ✅ Complete (001–012) |
| BLOCK E — PHP APIs | ✅ Complete |
| BLOCK F — Node.js APIs | ✅ Complete |
| BLOCK G — Frontend Pages (GPWEB-3730) | ✅ Complete |
| BLOCK H — Delivery Routing UI | ✅ Complete |

**Next steps (outside codebase):**
1. IT team staging deployment — wire real API endpoints (replace mocks)
2. UAT / staging verification
3. Migration strategy from current platform to this solution
