# SupremeFlex — Consolidated Requirements
**Platform: GPFI (Grameenphone FWA) | Version: 2.1 | Date: 2026-05-20**

---

## 1. Platform Overview

SupremeFlex is an internal back-office (BO) CRM and operations platform for the **GPFI — Grameenphone FWA** product line. It manages the full lifecycle of FWA connections: acquisition, field delivery, customer management, invoicing, and add-on services.

- **Customer types:** B2C (individual) and B2B (business)
- **Stack:** Next.js :3000 → PHP/Laravel :8000 (auth, CRUD, campaigns, invoicing) + Node.js :8001 (field ops, stock transfers, WS dashboard) → MySQL :3306 (1 primary + 2 read replicas — Phase -1 / P-1.7) + Redis :6379 (sessions, idempotency, JWT revocation, queue, hot-data cache — Phase -1 / P-1.7)
- **Authentication:** OTP-based. Users log in with mobile number → 6-digit OTP → JWT delivered via httpOnly + Secure + SameSite=Strict cookie (Phase -1 / P-1.2). No email/password login.
- **CMS / reporting:** Configurable texts live in the `system_config` table. Reporting via Metabase (or Superset) behind SSO + read replica, deferred to post-launch. **Drupal removed from architecture** — see Phase -1 / P-1.6.

---

## 2. Customer Model

### 2.1 Multi-Connection
- A single customer (B2C or B2B) may own **one or more GPFI connections**
- Each connection = one `anchor` (installation location) + one `active_service` (subscription)
- Every order must reference `anchor_id` + `active_service_id` — never attached to a customer alone

### 2.2 Invoicing
- **Individual invoice:** per connection per transaction — child row on `onetime_invoices` with `anchor_id` + `active_service_id` set, `is_summary = 0`
- **Combined summary invoice:** parent invoice covering multiple connections for the same customer — row with `is_summary = 1`, `anchor_id` + `active_service_id` NULL, children reference it via `parent_summary_invoice_id` FK
- `onetime_invoices.parent_summary_invoice_id` is a self-referencing FK to `onetime_invoices.invoice_id` (migration 006)

### 2.3 Customer Lifecycle Status
- Fetched from external API — **mocked** (`CustomerLifecycleService`, `CUSTOMER_LIFECYCLE_MOCK=true`)
- Values: `Active`, `Expired`
- **Dev toggle:** when `isDevMode = true`, DevPanel allows overriding per customer (stored in `localStorage` as `sf_lifecycle_override_{customerId}`)

---

## 3. Delivery Routing

### 3.1 B2B
- Initiated by **KAM** (Key Account Manager)
- KAM pulls inventory (credit or upfront — configurable per KAM)
- KAM delivers directly to B2B customer
- KAMs are **independent** — not linked to any DH or Channel

### 3.2 B2C — Resolution Order
| Priority | Condition | Delivery Agent |
|----------|-----------|---------------|
| 1 | Sub-channel per-order override | Sub-channel own delivery |
| 2 | Sub-channel `delivery_ownership = SELF_DELIVERY` | Sub-channel own delivery |
| 3 | Channel per-order override | Channel own delivery |
| 4 | Channel `default_delivery_mode = OWN` | Channel own delivery |
| 5 | No override | DH (global default) |

Per-order overrides stored in `order_delivery_overrides` table.

### 3.3 Manager Per Entity (Hub Manager removed)
Each delivery entity has a manager user linked via `manager_admin_id CHAR(36) FK → user_account(id)`:
- **DH Manager** — manages DH stock and its Field Agents
- **Channel Manager** — manages channel delivery ops
- **Sub-Channel Manager** — manages sub-channel ops
- *(Future)* **Online Delivery virtual manager**

Field Agents report directly to their DH (`field_agents.dh_id`). **Hub Manager does not exist.**

**FK target is `user_account(id)`, not `admin_users`** — this allows Node to resolve the manager's entity via `WHERE manager_admin_id = req.user.sub` (JWT sub = user_account.id). The JWT payload includes `staff_type` so endpoints can route by manager type without an extra lookup. The unified `/manager-dashboard` frontend page adapts its display based on `staff_type` ('DH Manager' / 'Channel Manager' / 'Sub-Channel Manager').

---

## 4. Inventory Pull Mode

| Entity | Default |
|--------|---------|
| DH | `UPFRONT` |
| Channel | `UPFRONT` |
| Sub-Channel | `UPFRONT` |
| KAM | `CREDIT` |

Configurable per entity via `inventory_pull_mode ENUM('CREDIT','UPFRONT')`.

---

## 5. Bulk Operations

Applies to all admin entities **except** B2C order flows, read-only dashboards, and audit logs.

| Operation | Guard |
|-----------|-------|
| Bulk Insert (CSV upload) | All users (subject to RBAC) |
| Bulk Update | All users (subject to RBAC) |
| Bulk Delete | Dev mode only (`isDevMode = true` + `X-Dev-Mode: true` header) AND route registered only when `APP_ENV != production` (Phase -1 / P-1.5) |

All bulk ops write to `audit_logs` (`action_type = BULK_IMPORT | BULK_UPDATE | BULK_DELETE`).

---

## 6. GPWEB-3730 Feature Set

### 6.1 Physical Add-Ons
- Orderable per connection; CPE-compatibility checked via `physical_addon_compatibility`
- **GPShop journey:** API integration — mocked (`GpShopService`, `GPSHOP_MOCK=true`)
- **DH-IT / Cockpit:** internal BO flow — real implementation
- Auto-cancel: PENDING orders past `auto_cancel_at` → `AUTO_CANCELLED` (queued Horizon job — Phase -1 / P-1.7 replaces the daily Artisan command)

### 6.2 CPE History
- Tracks device changes per connection
- Populated on CPE swap via Node.js `setup-complete` endpoint
- Drill-down modal per connection in Asset Lifecycle page

### 6.3 Digital Add-Ons (OTT)
- Modality: `WITH_PLAN` (requires active WiFi plan) or `ONE_TIME_PASS`
- Modality configured per product; overridable via `system_config.ott_modality`

### 6.4 Location Change
- **Customer profile update:** real — updates district, area, address, TAC; detects 4G↔5G mismatch; updates plan if needed
- **External network API:** mocked (`LocationChangeApiService`, `LOCATION_CHANGE_API_MOCK=true`)
- TAC auto-fills area via `tac_area_mapping` table

### 6.5 Real IP
- Eligibility: gpfi1900 or gpfi2500/5G plans only
- Grace period via `system_config.real_ip_grace_period_days`
- Auto-unassign: queued Horizon job (Phase -1 / P-1.7)
- **External IP provisioning API:** mocked (`RealIpApiService`, `REAL_IP_API_MOCK=true`)

---

## 7. Mock API Strategy

| Feature | Service Class | Env Flag | Default |
|---------|--------------|----------|---------|
| Physical Add-Ons (GPShop) | `GpShopService` | `GPSHOP_MOCK` | `true` |
| Location Change | `LocationChangeApiService` | `LOCATION_CHANGE_API_MOCK` | `true` |
| Real IP | `RealIpApiService` | `REAL_IP_API_MOCK` | `true` |
| Customer Lifecycle | `CustomerLifecycleService` | `CUSTOMER_LIFECYCLE_MOCK` | `true` |

Each service implements a PHP interface. Mock returns fixture data. Real makes HTTP calls. Toggle via `.env`.

**Production safety (Phase -1 / P-1.5):** `AppServiceProvider::boot()` throws when `APP_ENV=production` and any `*_MOCK=true`. Misconfiguration is impossible, not just unlikely.

---

## 8. Current Codebase State

### Done
- DB: 39 tables, 32 triggers, 3 stored procedures; `otp_codes` table (migration 004); `audit_logs.action_type` ENUM extended with `BULK_UPDATE`, `BULK_DELETE` (migration 006)
- PHP: 50+ routes, all controllers scaffolded, JwtMiddleware complete; OTP auth endpoints; `BaseApiController` with soft-delete `destroy()` + `bulkStore()` / `bulkUpdate()` / `bulkDestroy()` (audit-logged, X-Dev-Mode guard on delete); bulk routes registered for 21 admin resources
- PHP Services (E0): 4 mock API services with interfaces + mock impls + real stubs + `AppServiceProvider` DI binding; toggled via `GPSHOP_MOCK`, `LOCATION_CHANGE_API_MOCK`, `REAL_IP_API_MOCK`, `CUSTOMER_LIFECYCLE_MOCK` (all default `true`)
- Node.js: 8 endpoints with real logic + transactions; WebSocket every 10s; JWT_SECRET startup guard; try-catch on all route handlers; `HUB_MANAGER` references removed from stock transfers and dashboard
- Frontend: AppSidebar, AppHeader (real username + logout), JWT auto-attach in api.ts; `/login` page; `AuthContext`; `(app)` route group with auth guard

### Phase -1 — Foundation Hardening (MUST precede all feature work)
See Section 11 (Security & Scale Targets), `docs/developmentPlan.md` BLOCK 0, and `docs/plan.md` Phase -1:
- **P-1.1** PK migration to UUIDv7 / BINARY(16) (replaces CHAR(36) DEFAULT (UUID()) across all 39 tables)
- **P-1.2** Auth hardening (OTP hash + rate limit + lockout; JWT in httpOnly cookies; refresh + revocation; RBAC enforcement via `PermissionMiddleware`; WS auth)
- **P-1.3** Idempotency-Key middleware on mutating endpoints (orders, addon orders, real IP, stock transfers, referrals)
- **P-1.4** Test harness (PHPUnit + Vitest + supertest + CI; coverage targets per layer)
- **P-1.5** Boot-time production guards (no mocks / debug / dev flags in prod)
- **P-1.6** Drupal removal (architecture decision — no code changes; doc-only)
- **P-1.7** DB topology (1 primary + 2 read replicas; Redis; Horizon queue; partitioning; backup with RTO 15min / RPO 5min)

### Feature work (after Phase -1)
- All 16 frontend pages are JSON dump stubs — no real UI, forms, or tables
- GPWEB-3730 features (5 feature sets) — PHP controllers E1–E10, Node E5 setup-complete, frontend pages G1–G8
- Hub Manager removal migration (D0) + delivery routing migration (D4)

### Known Bugs
| ID | Status | Bug | File |
|----|--------|-----|------|
| BUG-1 | ✅ Fixed | `allocated_entity_id` mismatch in dashboard | dashboard.js |
| BUG-2 | TODO | Race condition in StockTransferController (folded into Phase -1 / P-1.3 idempotency + transaction lock) | StockTransferController.php |
| BUG-3 | TODO | Audit attribution hardcoded | AuditLogController.php |
| BUG-4 | ✅ Fixed | JWT_SECRET not validated at startup | index.js |
| BUG-5 | ✅ Fixed | No try-catch on Node route handlers | fieldExecution.js, stockTransfers.js, dashboard.js |

---

## 9. Absolute Rules

1. PHP owns CRUD/auth/campaigns/invoicing. Node owns field execution/stock transfers/WS. Never cross-assign.
2. All PKs: **UUIDv7 stored as `BINARY(16)`**. Generated in app code via `Ramsey\Uuid::uuid7()` / `uuidv7` npm. Phase -1 / P-1.1 migrates existing CHAR(36) tables. No auto-increment, no `DEFAULT (UUID())`.
3. Never hard-delete master data — use `status ENUM('ACTIVE','INACTIVE')`.
4. Price changes: new row in `product_price_versions`. Never overwrite.
5. Campaign targeting in `campaign_targeting_rules`. No geo/channel logic in app code.
6. JWT auth via `auth.jwt` on PHP. Node trusts the same token. Login is OTP-based — no email/password login exists.
7. `referral_reward_ledger` transitions owned by stored procedure only.
8. All bulk ops write to `audit_logs`.
9. Node DB queries via `services/db.js` only.
10. Node uses ES modules — no `require()`.
11. B2B orders delivered by KAM. B2C default delivery is DH.
12. Every order references `anchor_id` + `active_service_id`.
13. No Hub Manager. Field Agents report to DH. KAMs are independent.
14. Bulk delete is dev-mode only AND route registered only when `APP_ENV != production`.
15. **OTP storage:** hashed (SHA-256 + salt); rate-limit 5/h/msisdn + 20/d/IP; lockout 5 attempts/15min; dev-mode response is a separate endpoint, not a runtime branch. (Phase -1 / P-1.2)
16. **JWT in httpOnly cookies** (access 15m + refresh 7d); revocation list in Redis keyed by `jti`; WS auth via subprotocol. (Phase -1 / P-1.2)
17. **RBAC enforced** via `PermissionMiddleware` invoking `has_role()` SP on every protected route; cached in Redis 300s. (Phase -1 / P-1.2)
18. **Mutating endpoints require `Idempotency-Key`** header; server caches `(key, request_hash, response)` in Redis 24h. (Phase -1 / P-1.3)
19. **`APP_ENV=production` boot guard** throws on any mock / debug / dev flag. (Phase -1 / P-1.5)

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| GPFI | Grameenphone FWA — fixed wireless internet product |
| FWA | Fixed Wireless Access |
| B2C / B2B | Business-to-Consumer / Business-to-Business |
| DH | Distribution House — physical stock distribution point |
| KAM | Key Account Manager — handles B2B, independent entity |
| Anchor | Installation location for one GPFI connection |
| Active Service | Active subscription: customer → product → anchor |
| Connection | One anchor + one active_service = one GPFI connection |
| Hub Manager | Does NOT exist — removed from system |
| TAC | Tower Area Code — auto-fills district/area on location change |
| CPE | Customer Premises Equipment (router/device) |
| OTT | Over-the-Top digital add-on (streaming pass etc.) |
| UUIDv7 | Time-ordered UUID — replaces UUIDv4 for PK insertion ordering (Phase -1 / P-1.1) |
| RTO / RPO | Recovery Time Objective / Recovery Point Objective — DR targets |
| DLQ | Dead Letter Queue — failed-job sink in Horizon queue (Phase -1 / P-1.7) |

---

## 11. Security & Scale Targets

### 11.1 Target scale (5-year horizon)
- **GPFI subscribers under management:** 3–10M
- **Concurrent internal users** (CS reps, KAMs, DH managers, field agents): up to **20k peak**
- **Orders/day at peak:** ~50k
- **`transaction_ledger` size:** low hundreds of millions of rows over 5 years

The CRM serves internal GP staff (thousands of concurrent users), not the full 80M+ GP subscriber base directly. The 3–10M figure represents GPFI customer records under management.

### 11.2 Security requirements (Phase -1 / P-1.2)
- **OTP storage:** SHA-256 + per-row salt — never plaintext
- **OTP rate limit:** 5/hour/msisdn + 20/day/IP on `requestOtp`
- **OTP lockout:** 5 failed attempts within 15 min on `verifyOtp`
- **JWT transport:** httpOnly + Secure + SameSite=Strict cookies — never localStorage
- **JWT lifecycle:** 15-min access token + 7-day refresh token; revocation list in Redis keyed by `jti`
- **RBAC:** every protected route enforces `PermissionMiddleware` backed by `has_role()` SP, cached 300s in Redis
- **WebSocket auth:** JWT via subprotocol on upgrade; unauthenticated upgrades rejected
- **Boot-time guard:** `APP_ENV=production` throws if any mock / debug / dev flag is `true`
- **No PII in logs:** OTP, JWT, NID, full MSISDN must be redacted before any log write

### 11.3 Data integrity requirements (Phase -1 / P-1.3)
- All mutating endpoints require an `Idempotency-Key` header
- Server caches `(key, request_hash, response)` in Redis for 24 h
- Duplicate key with same body → cached response, no re-execution
- Duplicate key with different body → 409 Conflict
- Scope: `orders`, `addon_order_history`, `cpe_order_history`, `ott_order_history`, `real_ip_assignments`, `stock_transfers`, `referral_redemptions`

### 11.4 Infrastructure requirements (Phase -1 / P-1.7)
- **MySQL:** 1 primary + 2 read replicas; ProxySQL routing; binlog + nightly XtraBackup; **RTO 15 min, RPO 5 min**; documented restore drills
- **Redis:** cache, sessions, queue, idempotency keys, JWT revocation list
- **Queue:** Laravel Horizon (Redis-backed) replaces daily Artisan crons; chunked workers with automatic retry + DLQ; Horizon dashboard for per-job observability
- **Partitioning:** monthly date-range on `audit_logs`, `system_audit_logs`, `transaction_ledger`, `otp_codes`; per-table retention policy

### 11.5 Test coverage requirements (Phase -1 / P-1.4)
- PHP services: ≥80%
- Stored-procedure state transitions: ≥90%
- Auth / RBAC middleware: 100%
- Node route handlers: ≥80%
- Node auth middleware: 100%
- Contract tests on all four `*_MOCK` services — Mock and Real Stub must satisfy the same contract

### 11.6 Out-of-scope decisions (deferred to post-launch)
- Reporting / BI tool deployment (Metabase or Superset behind SSO + read replica)
- Multi-region deployment
- Customer-facing mobile app (this CRM is internal-only)
- Bangladesh DPA / BTRC compliance audit (must complete before any production traffic, but not part of Phase -1 build work)
