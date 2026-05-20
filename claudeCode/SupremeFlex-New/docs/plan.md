# SupremeFlex — GPWEB-3730 Implementation Plan
**Feature: Experience 5G WiFi with Real IP Access and Add-Ons**
**Platform: GPFI — Grameenphone FWA | Version: 2.0 | Date: 2026-05-18**

---

## Codebase Review & Improvement Scope

### Critical Issues

| ID | Layer | File(s) | Issue | Fix |
|----|-------|---------|-------|-----|
| DB-1 | DB | ✅ FIXED | allocated_entity_id mismatch in dashboard | Done (commit 6b6715d) |
| HUB | DB+All | Multiple | Hub Manager entity doesn't exist in real operation | Migration D0 — remove; replace with manager-per-entity model |
| PHP-1 | PHP | routes/api.php | No RBAC — any authenticated user hits any route | Add permission middleware; wire has_role() stored procedure |
| PHP-2 | PHP | AuditLogController.php:35 | Hardcoded audit attribution | Always use auth()->id() |
| PHP-3 | PHP | Multiple controllers | No audit logging on sensitive ops | Add AuditLog::create() per PATTERNS.md |
| PHP-4 | PHP | StockTransferController.php | Race condition (no SELECT FOR UPDATE) | DB::transaction() with lock |
| FE-1 | Frontend | All page.tsx | All 16 pages are JSON dump stubs | Block C — full UI implementation |

### High-Priority Issues

| ID | Layer | Issue | Fix |
|----|-------|-------|-----|
| DB-2 | DB | 30+ missing indexes | Migration 007_add_indexes.sql |
| DB-3 | DB | Inconsistent status types (TINYINT vs ENUM) | Standardise to ENUM('ACTIVE','INACTIVE') |
| PHP-5 | PHP | BaseApiController: no validation in store()/update() | Add $rules property + $request->validate() |
| PHP-6 | PHP | CustomerController: N+1 queries | Replace with JOIN + GROUP BY |
| PHP-7 | PHP | Transactions missing try-catch | Wrap all DB::transaction() in try-catch |
| NODE-1 | Node | No try-catch on route handlers | Wrap all pool.query() (A2) |
| NODE-2 | Node | JWT_SECRET not validated at startup | Startup guard in index.js (A3) |
| FE-3 | Frontend | Pagination has no upper bound | Compute totalPages from data.total |
| FE-4 | Frontend | No error state on any query | Destructure isError; render error card |
| FE-5 | Frontend | No debounce on search | useDebounce hook (B4) |
| FE-7 | Frontend | No 401 interceptor | Add response interceptor (B5) — logout on 401 now works via AuthContext; axios interceptor TODO |

---

## Architecture Changes (v2.0)

### Hub Manager Removal
`hub_managers` does not exist in real GPFI operations. Replaced by manager-per-entity:

| Entity | Manager field | Stock custody |
|--------|--------------|---------------|
| DH | `distribution_houses.manager_admin_id` | Staging → DH → Field Agent |
| Channel | `channels.manager_admin_id` | Channel stock → Field Agent |
| Sub-Channel | `sub_channels.manager_admin_id` | Sub-channel → Field Agent |

Field Agents → DH directly. KAMs are independent.

**Design decision:** `manager_admin_id FK → user_account(id)` (NOT `admin_users`). JWT `sub` is `user_account.id`; Node dashboard resolves `WHERE manager_admin_id = req.user.sub`. JWT payload includes `staff_type` for entity-type routing. Frontend `/manager-dashboard` replaces `/hub-manager-dashboard`.

**Migration D0.5 (`006_order_connection_enforcement.sql`):**
- ALTER `orders` ADD `anchor_id CHAR(36) NOT NULL FK → anchors`, `active_service_id CHAR(36) NOT NULL FK → active_services`
- ALTER `onetime_invoices` ADD `is_summary TINYINT DEFAULT 0`, `anchor_id` (nullable), `active_service_id` (nullable), self-ref FK on `parent_summary_invoice_id`
- ALTER `transaction_ledger` MODIFY `anchor_id` NOT NULL + FK, ADD `active_service_id NOT NULL FK`, ADD `invoice_id` FK
- Update `InvoiceController.$fillable` to include `anchor_id`, `active_service_id`, `is_summary`

**Migration D0 (`005_remove_hub_manager.sql`):**
- DROP TRIGGER `trg_hub_managers_updated_at`
- ALTER `field_agents` DROP FK `fk_fa_hub_manager`, DROP COLUMN `hub_manager_id`
- ALTER `kams` DROP FK `fk_kams_hub_manager`, DROP COLUMN `hub_manager_id`
- DROP TABLE `hub_managers`
- ALTER `channels`, `sub_channels`, `distribution_houses` ADD `manager_admin_id CHAR(36) NULL FK → user_account(id)`
- MODIFY `inventory_master.status` ENUM: remove `WITH_HUB_MANAGER`
- MODIFY `stock_transfers.to_entity_type` VARCHAR(50) → ENUM('FIELD_STAFF','DH','KAM'): remove `HUB_MANAGER`

### Multi-Connection Per Customer
- One customer → many anchors → many active_services
- All order tables carry `anchor_id` + `active_service_id`
- Customer 360 organises tabs per connection

### B2C/B2B Delivery Routing
B2C resolution order (sub-channel override → sub-channel default → channel override → channel default → DH).

**Migration D4 (`010_delivery_routing.sql`) adds:**
- `channels`: `default_delivery_mode ENUM('DH','OWN') DEFAULT 'DH'`, `inventory_pull_mode ENUM('CREDIT','UPFRONT') DEFAULT 'UPFRONT'`
- `sub_channels`: `inventory_pull_mode ENUM('CREDIT','UPFRONT') DEFAULT 'UPFRONT'` only — existing `delivery_ownership ENUM('FOLLOW_CHANNEL','SELF_DELIVERY','DH_DELIVERY')` is the authoritative routing column; do NOT add `default_delivery_mode` (dual source of truth)
- `distribution_houses`: `inventory_pull_mode ENUM('CREDIT','UPFRONT') DEFAULT 'UPFRONT'`
- `kams`: `inventory_pull_mode ENUM('CREDIT','UPFRONT') DEFAULT 'CREDIT'`
- NEW: `order_delivery_overrides` (override_id PK, order_id FK → orders, entity_type ENUM('CHANNEL','SUB_CHANNEL'), entity_id CHAR(36), delivery_mode ENUM('OWN','DH') DEFAULT 'OWN', reason TEXT, created_by FK → user_account ON DELETE SET NULL)

### Bulk Operations
`BaseApiController` adds `bulkStore()`, `bulkUpdate()`, `bulkDestroy()` (destroy: `X-Dev-Mode: true` required). All bulk ops audit-logged.

### Mock API Strategy ✅ E0 Done
| Service | Interface | Mock (default) | Real stub | Env Flag |
|---------|-----------|---------------|-----------|----------|
| GPShop | `GpShopServiceInterface` | `GpShopService` | `GpShopApiService` | `GPSHOP_MOCK` |
| Location Change | `LocationChangeApiServiceInterface` | `LocationChangeApiService` | `LocationChangeApiRealService` | `LOCATION_CHANGE_API_MOCK` |
| Real IP | `RealIpApiServiceInterface` | `RealIpApiService` | `RealIpApiRealService` | `REAL_IP_API_MOCK` |
| Customer Lifecycle | `CustomerLifecycleServiceInterface` | `CustomerLifecycleService` | `CustomerLifecycleApiService` | `CUSTOMER_LIFECYCLE_MOCK` |

All defaults `true`. Real stubs throw `RuntimeException`. `AppServiceProvider` binds via `config/mock_services.php`. Registered in `bootstrap/providers.php`.

---

## GPWEB-3730 Context

| # | Feature | Effort |
|---|---------|--------|
| 1 | Physical Add-Ons — GPShop (mock) + DH-IT + Cockpit | L |
| 2 | CPE History — device change tracking + drill-down | M |
| 3 | Digital Add-Ons (OTT) — one-time pass + modality config | M |
| 4 | Location Change — profile update real; network API mock | L |
| 5 | Real IP — eligibility + grace period; provisioning mock | M |

---

## Execution Order

```
✅ Done   (OTP Auth — migration 004, login page, AuthContext, auth guard)
    ↓
Phase -1 (Foundation Hardening — PKs UUIDv7/BINARY(16), auth hardening,
          idempotency, tests, prod guards, Drupal kill, DB topology+Redis+queue)
    ↓
Phase 0  (Groundwork — mock services, SMS, system_config, internal bridge)
    ↓
Phase 1  (DB Migrations D0–D4 → now files 005–009)
    ↓
Phase 2  (PHP Backend)  ←parallel→  Phase 3  (Node.js Backend)
    ↓
Phase 4  (Frontend)
```

---

## Phase -1 — Foundation Hardening

**Target scale:** 3–10M GPFI subscribers; up to 20k concurrent internal users; ~50k orders/day at peak. **Must complete before Phase 0** (some items can run in parallel — see sequencing at the end of this section).

### P-1.1 — PK strategy: UUIDv7 / BINARY(16)
**Problem:** Random UUIDv4 stored as `CHAR(36) DEFAULT (UUID())` causes B-tree page splits, 4–5× index bloat vs BIGINT, and slow joins at multi-million-row scale. Every secondary index carries the 36-byte PK; `transaction_ledger` joins compound the cost.

**Solution:** UUIDv7 (time-ordered) stored as `BINARY(16)`. Generated in application code via `Ramsey\Uuid::uuid7()` (PHP) and the `uuidv7` npm package (Node). New helper layer renders to/from canonical string form for JSON I/O.

**Migration approach:** `011_pk_strategy.sql` ALTERs all 39 tables' PK + FK columns; converts existing rows via `UNHEX(REPLACE(uuid, '-', ''))`. Triggers updated. Because the codebase has only ~50k orders today, this is the cheapest window to do this — every additional row makes it harder.

**Exit criteria:** All migrations 001–004 retrofitted or wrapped; PHP and Node generate UUIDv7 in code; on a 1M-row insert test the page-split rate is <2%.

### P-1.2 — Auth hardening
**Verified gaps (Explore agent run 2026-05-20):** No OTP rate limit on `requestOtp`; no brute-force lockout on `verifyOtp`; OTP stored as plaintext `CHAR(6)`; OTP returned in HTTP response when `APP_ENV=local` (runtime branch — leakable); JWT in `localStorage`; no refresh token; no revocation mechanism; `has_role` SP defined but never called from PHP; WebSocket `/ws/dashboard` has zero auth check.

**Solution:**
- **OTP:** Hash before storage (SHA-256 + per-row salt). Rate-limit request 5/hour/msisdn + 20/day/IP. Lockout verify after 5 failed attempts within 15 min. Move dev-mode response to a separate `/api/auth/otp/dev-peek` endpoint registered only when `APP_ENV != production` — eliminate the runtime branch in `verifyOtp`.
- **JWT:** Access token 15-min TTL + refresh token 7-day TTL. Cookies: httpOnly + Secure + SameSite=Strict. Revocation list in Redis keyed by `jti`. `/auth/logout` actually invalidates the refresh token and adds the access `jti` to the revocation set.
- **RBAC:** New `PermissionMiddleware` invokes the existing `has_role(user_id, role_name)` stored procedure. Result cached in Redis 300s per user. Applied per-route: `middleware('auth.jwt,can:order.create')`. `auth.jwt` alone is never sufficient.
- **WebSocket:** JWT delivered via subprotocol on upgrade; unauthenticated upgrades rejected with 401.

**Exit criteria:** Black-box test verifies each gap closed (rate limit returns 429, lockout returns 423, plaintext OTP no longer present in `otp_codes.code`, JWT in cookie not localStorage, refresh-then-revoke works, RBAC denies cross-role access, WS rejects upgrade without token).

### P-1.3 — Idempotency keys on mutating endpoints
**Why:** Field agents on mobile networks will retry. Without idempotency, retries create duplicate orders, duplicate IP provisioning calls (which trigger GPShop / RealIP external APIs), duplicate stock transfers, duplicate referral redemptions.

**Scope:** POST/PATCH/DELETE on `orders`, `addon_order_history`, `cpe_order_history`, `ott_order_history`, `real_ip_assignments`, `stock_transfers`, `referral_redemptions`.

**Solution:** New `IdempotencyMiddleware.php` (PHP) and `idempotency.js` (Node). Middleware extracts `Idempotency-Key` header, hashes `(key, request_body)`, looks up in Redis. On hit: return cached response. On miss: execute handler, cache `(key, request_hash, response)` for 24 h, return response.

**Exit criteria:** Sending the same `Idempotency-Key` twice with the same body returns identical response and creates only one row. Sending the same key with a different body returns 409 Conflict.

### P-1.4 — Test harness
**Verified state:** Zero test infrastructure — no `tests/` directory, no `phpunit.xml`, no `*.test.js`, no `test` script in `backend-node/package.json`.

**Solution:**
- **PHP:** PHPUnit + Laravel test client. Coverage targets — 80% on services, 90% on stored-procedure state transitions (`check_and_release_referral_reward`, `force_approve_referral_reward`), 100% on auth/RBAC middleware.
- **Node:** Vitest (ES modules) + supertest. 80% on route handlers, 100% on auth middleware.
- **Contract tests:** every `*_MOCK` service has a contract suite that both the Mock and the Real Stub must satisfy — so flipping the env flag never surprises us.
- **CI:** `.github/workflows/test.yml` runs lint + tests on every push and on PR.

**Exit criteria:** `composer test`, `npm test` (in `backend-node`), and GH Actions all green. Coverage report published as a workflow artifact.

### P-1.5 — Boot-time production guards
**Why:** Mocks default to ON. `APP_DEBUG` can leak in prod. Dev-mode OTP-return is a runtime flag. `X-Dev-Mode: true` is a client-trusted header. Bulk-delete route exists in the production binary.

**Solution:**
- `AppServiceProvider::boot()` throws `RuntimeException` when `APP_ENV=production` AND any of `GPSHOP_MOCK / LOCATION_CHANGE_API_MOCK / REAL_IP_API_MOCK / CUSTOMER_LIFECYCLE_MOCK / APP_DEBUG / OTP_DEV_PEEK_ENABLED` is `true`.
- Node `index.js` mirrors the same guard.
- Build pipeline strips dev-only route registrations (bulk-delete controller, dev-OTP-peek endpoint) from the production artifact.

**Exit criteria:** `APP_ENV=production php artisan serve` with `GPSHOP_MOCK=true` exits 1 with a clear error message. Production artifact does not register `/api/auth/otp/dev-peek` or `DELETE /api/{resource}/bulk`.

### P-1.6 — Drupal removal
**Verified:** `/drupal/` directory exists but is empty; no PHP or Node code references `:8080` or any Drupal API. Drupal is documentation-only.

**Decision:** Kill Drupal from the architecture. The maintenance + CVE-patching cost is not justified for "configurable texts and reporting views."
- Configurable texts → already covered by the `system_config` table (per P0-3).
- Reporting → Metabase (or Superset) behind SSO + read replica, deferred to post-launch.

**Exit criteria:** No mention of Drupal in any of the 4 plan docs (`CLAUDE.md`, this file, `docs/developmentPlan.md`, `docs/SupremeFlex_Consolidated_Requirements.md`). Architecture diagram updated. (Already done in this planning round.)

### P-1.7 — DB topology + Redis + queue
**Target topology:**
- **MySQL:** 1 primary + 2 read replicas. ProxySQL routes reads to replicas, writes to primary. Binlog enabled. Nightly XtraBackup + retained binlogs. **RTO 15 min, RPO 5 min**, with documented restore drills.
- **Redis:** sessions, idempotency keys, JWT revocation list, hot-data cache (geography, product catalog, RBAC permissions), Laravel Horizon backing store.
- **Queue (Laravel Horizon, Redis-backed):** replaces daily Artisan crons (`AutoCancelAddonOrders`, `AutoUnassignRealIp`, SMS retries) with chunked workers, automatic retry, and a Dead Letter Queue. Per-job observability via Horizon dashboard.
- **Partitioning:** monthly date-range partitions on `audit_logs`, `system_audit_logs`, `transaction_ledger`, `otp_codes`. Per-table retention policy.

**Sequencing:** Topology decisions documented now. Redis + queue in place before first feature code in BLOCK A. Replicas + partitioning deployed before any public traffic.

**Exit criteria:** Read traffic routes to a replica (verified via slow-query log); at least one Artisan command refactored as a queued Horizon job; Redis cache hit-rate >80% on Customer 360 lookup under load test; partition pruning verified on a 10M-row test table.

### Sequencing summary
```
P-1.1 ─┐
P-1.2 ─┤── MUST complete before Phase 0 (D0/D0.5/D1/D2/D3/D4 migrations)
P-1.5 ─┘

P-1.3 ──── parallel with Phase 0 (middleware drops in cleanly)
P-1.4 ──── parallel; every feature ships with tests from day one
P-1.6 ──── documentation-only; can complete in this planning round
P-1.7 ──── infra parallel; app-side queue refactor before Phase 2 E5–E10
```

---

## Phase 0 — Groundwork

### P0-1: Mock API Services (`backend-php/app/Services/`)
Four classes, each with a PHP interface + mock implementation:
- `GpShopService` — `createOrder()`, `getOrderStatus()`, `cancelOrder()`
- `LocationChangeApiService` — `callLocationChangeApi()`
- `RealIpApiService` — `provisionIp()`, `unassignIp()`
- `CustomerLifecycleService` — `getStatus(customerId, anchorId): 'Active'|'Expired'`

### P0-2: SMS Service
- `backend-php/app/Services/SmsService.php` — `send(msisdn, template, vars)`: calls HTTP gateway; on failure logs to system_audit_logs, never throws
- `backend-php/config/sms.php` — templates: ACCESSORY_SETUP, LOCATION_CHANGE, CPE_SETUP
- **Note:** OTP delivery for login currently logs to Laravel log and returns code in response on `APP_ENV=local`. Wire to `SmsService` when integrating a real SMS gateway.

### P0-3: System Config Table
```sql
CREATE TABLE system_config (config_key VARCHAR(100) PK, config_value VARCHAR(500), updated_at DATETIME);
-- Seeds: accessory_auto_cancel_days=7, real_ip_grace_period_days=30, ott_modality=WITH_PLAN
```
- `SystemConfigController`: GET /api/system-config, PATCH /api/system-config/{key}

### P0-4: Internal SMS Bridge
- `InternalController` + `InternalKeyMiddleware`: POST /api/internal/sms — proxies to SmsService
- `backend-node/src/services/phpBridge.js`: `callPhpSms(msisdn, template, vars)`

---

## Phase 1 — DB Migrations

See `developmentPlan.md` BLOCK D for file names.

**New tables — all require `anchor_id` + `active_service_id` FKs:**

| Table | Feature | Key columns |
|-------|---------|-------------|
| `addon_order_history` | Physical Add-Ons | order_status ENUM(PENDING,ACTIVE,CANCELLED,AUTO_CANCELLED), auto_cancel_at, gpshop_order_id |
| `cpe_order_history` | CPE History | cpe_product_id FK, imei, device_count, invoice_id FK |
| `ott_order_history` | OTT | ott_product_id FK, order_status ENUM(PENDING,ACTIVE,CANCELLED,EXPIRED) |
| `location_change_history` | Location Change | from/to district/area FKs, tac, network_type_before/after ENUM(4G,5G), plan_changed, old/new_plan_product_id FK |
| `real_ip_assignments` | Real IP | ip_address VARCHAR(45), status ENUM(ACTIVE,UNASSIGNED,IN_PROGRESS), grace_period_end, auto_unassign_at |
| `tac_area_mapping` | Location Change | tac VARCHAR(50) PK, area_id FK |

---

## Phase 2 — PHP Backend

### 2.1 Extend `AddonCompatibilityController`
- Add `area_id`, `district_id`, `dh_id`, `price_override_bdt`, `discount_bdt`, `status` to fillable
- Soft-delete override; new route: GET /api/addon-compatibility/by-cpe/{cpe_product_id}

### 2.2 `AddonOrderController`
- `store()`: transaction; `auto_cancel_at = NOW() + INTERVAL X DAY` from system_config; GPShop branch calls `GpShopService::createOrder()`; audit log
- `cancel()`: STATUS_CHANGE; audit log
- Routes: apiResource + PATCH cancel + GET by-customer/{customer_id}

### 2.3 `AutoCancelAddonOrders` Artisan Command
- Daily; PENDING → AUTO_CANCELLED where `auto_cancel_at <= NOW()`; admin_id = NULL

### 2.4 `CpeOrderController`
- `history(customerId)`: all CPE rows, JOINs invoice; ordered by order_date DESC
- Routes: apiResource + GET history/{customer_id}

### 2.5 `OttOrderController`
- `store()`: validates modality (WITH_PLAN → requires active service; reads system_config.ott_modality + product.ott_modality)
- Routes: apiResource + GET by-customer/{customer_id}

### 2.6 `LocationChangeController` (most complex)
Transaction steps:
1. Validate customer + destination (to_district + to_area OR tac → auto-fill via tac_area_mapping)
2. Get active_service → plan network_capability
3. Get to_area 4G/5G flags → detect 4G↔5G mismatch
4. If mismatch: plan_changed=1, resolve new plan product
5. INSERT location_change_history (status=ACTIVE, set previous INACTIVE)
6. UPDATE anchors with new district/area/tac
7. If plan changed: deactivate old active_service, insert new
8. Audit log
9. `LocationChangeApiService::callLocationChangeApi()` (mocked)
10. `SmsService::send(LOCATION_CHANGE)`

New route on AreaController: GET /api/areas/by-tac/{tac}

### 2.7 `RealIpController` + `RealIpService`
- `checkEligibility()`: plan is gpfi1900 or gpfi2500/5G
- `assign()`: INSERT real_ip_assignments (IN_PROGRESS); `RealIpApiService::provisionIp()` (mocked); compute grace_period_end from system_config
- `unassign()`: UNASSIGNED; clear active_services.real_ip_id
- Routes: GET list, GET show, POST assign, PATCH status

### 2.8 `AutoUnassignRealIp` Command
- Daily at 01:00; ACTIVE → UNASSIGNED where `auto_unassign_at <= NOW()`; admin_id = NULL

### 2.9 Extend `CustomerController::view360()`
Returns per-connection structure:
```php
'connections' => [[
  'anchor' => ..., 'active_service' => ...,
  'lifecycle_status' => CustomerLifecycleService::getStatus($customerId, $anchorId),
  'addon_orders' => ..., 'cpe_orders' => ..., 'ott_orders' => ...,
  'location_history' => ..., 'real_ip' => ...,
]]
```

### 2.10 `BaseApiController` Bulk Methods
```php
bulkStore(Request $request)   // POST /api/{resource}/bulk
bulkUpdate(Request $request)  // PATCH /api/{resource}/bulk
bulkDestroy(Request $request) // DELETE /api/{resource}/bulk — X-Dev-Mode: true required
```

---

## Phase 3 — Node.js Backend

### 3.1 Accessories on Lead Card
- GET `/api/field-execution/leads/:id/accessories`
- POST — validate CPE compatibility via physical_addon_compatibility
- PATCH `:addon_order_id` — update imei_system, setup_date, status; if ACTIVE → phpBridge SMS
- DELETE `:addon_order_id` — soft-delete (CANCELLED)

### 3.2 Setup Complete
`POST /api/field-execution/leads/:id/setup-complete` — transaction:
1. Old CPE inventory → DELIVERED/REPLACED
2. New CPE inventory → DELIVERED
3. Order → INSTALLED
4. If upgrade_plan_product_id: swap active_service
5. INSERT cpe_order_history
6. Update customer_assets (REPLACED + new insert)
7. INSERT asset_replacement_history
8. phpBridge SMS (CPE_SETUP)

---

## Phase 4 — Frontend

### New Pages
| Route | Feature | Key APIs |
|-------|---------|----------|
| `/accessories` | Physical Add-Ons history | GET /api/addon-orders |
| `/ott-orders` | OTT Orders | GET /api/ott-orders |
| `/location-change` | Hotline: lookup + form + history | GET lookup, POST create, GET /areas/by-tac |
| `/real-ip` | Real IP table + status actions | GET /api/real-ip, PATCH status |
| `/customers/[id]` | Customer 360 — per-connection tabs | GET /api/customers/{id}/360 |

### Modified Pages
| Page | Change |
|------|--------|
| `/product-engine` | Addon Compatibility tab + Display Config tab |
| `/assets` | CPE Order History tab + CpeHistoryModal |
| `/customers` | "View 360" → `/customers/[id]` |
| `/master-data` | Remove Hub Managers tab; add delivery_mode/pull_mode to Channel/Sub-Channel |
| `/manager-dashboard` (was `/hub-manager-dashboard`) | Adapts to logged-in manager's entity |

### Sidebar Addition
```typescript
{ title: 'Accessories',     href: '/accessories',     icon: Package },
{ title: 'OTT Orders',      href: '/ott-orders',      icon: Tv },
{ title: 'Location Change', href: '/location-change', icon: MapPin },
{ title: 'Real IP',         href: '/real-ip',         icon: Globe },
```

---

## Audit Log Targets

| Action | target_table | action_type | admin_id |
|--------|-------------|-------------|----------|
| Addon order create/cancel | addon_order_history | CREATE / STATUS_CHANGE | auth()->id() |
| Auto-cancel addons | addon_order_history | STATUS_CHANGE | NULL |
| CPE order create | cpe_order_history | CREATE | auth()->id() |
| OTT create/cancel | ott_order_history | CREATE / STATUS_CHANGE | auth()->id() |
| Location change | location_change_history | CREATE | auth()->id() |
| Real IP assign/update | real_ip_assignments | CREATE / STATUS_CHANGE | auth()->id() |
| Auto-unassign real IP | real_ip_assignments | STATUS_CHANGE | NULL |
| System config change | system_config | UPDATE | auth()->id() |
| Bulk insert | any | BULK_IMPORT | auth()->id() |
| Bulk update | any | BULK_UPDATE | auth()->id() |
| Bulk delete (dev) | any | BULK_DELETE | auth()->id() |

---

## Verification Checklist

| Check | How |
|-------|-----|
| Hub Manager removed | SHOW TABLES — no hub_managers; DESCRIBE inventory_master — no WITH_HUB_MANAGER |
| Multi-connection orders | Create 2 anchors for one customer; place addon order on each separately |
| Summary invoice | Select 2 connections on Invoicing page; generate combined invoice |
| Delivery routing | B2B order → KAM assigned; B2C → DH; set channel OWN → channel agent assigned |
| Bulk ops | CSV import creates rows; bulk update patches; bulk delete requires isDevMode=true |
| Mock toggle | Set GPSHOP_MOCK=false → GpShopService::createOrder() called without error |
| Dev lifecycle toggle | isDevMode=true → DevPanel visible → toggle changes getStatus() return |
| Physical Add-Ons | Create addon → GPShop mock responds; auto-cancel command flips status |
| Location Change | Lookup customer → fill form → submit → history row; SMS in system_audit_logs |
| Real IP | Assign → grace_period_end set; auto-unassign command clears ACTIVE rows |
| CPE History | setup-complete → cpe_order_history row; modal shows on Asset Lifecycle page |

---

## Complexity Estimate

| Feature | Effort |
|---------|--------|
| Hub Manager removal | S |
| Bulk operations | M |
| Physical Add-Ons | L |
| CPE History | M |
| OTT | M |
| Location Change | L |
| Real IP | M |
| Delivery routing | M |
| **Total estimated** | **5–7 weeks** |
