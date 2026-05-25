# SupremeFlex — GPWEB-3730 Implementation Plan
**Feature: Experience 5G WiFi with Real IP Access and Add-Ons**
**Platform: GPFI — Grameenphone FWA | Version: 2.1 | Date: 2026-05-25**
**Status: Implementation complete — all phases done, merged to `main`, DoD verified locally.**

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
✅ Done   Phase 0  (Groundwork — mock services, SMS, system_config, internal bridge)
    ↓
✅ Done   Phase 1  (DB Migrations D0–D4 → files 005–010)
    ↓
✅ Done   Phase 2  (PHP Backend — Block E)  ←parallel→  Phase 3  (Node.js Backend — Block F)
    ↓
✅ Done   Phase 4  (Frontend — Blocks B, C, G, H)
    ↓
⏳ TODO   Phase -1 (Foundation Hardening — P-1.1 through P-1.5 still pending;
          P-1.6 Drupal removal ✅; P-1.7 DB topology + Redis + queue ✅)
```

**As of 2026-05-24:** Phases 0–4 are complete. Remaining: P-1.1 (PK migration), P-1.2 (auth hardening), P-1.3 (idempotency), P-1.4 (PHP tests), P-1.5 (boot guards).

---

## Phase -1 — Foundation Hardening

**Target scale:** 3–10M GPFI subscribers; up to 20k concurrent internal users; ~50k orders/day at peak. **Must complete before Phase 0** (some items can run in parallel — see sequencing at the end of this section).

### P-1.1 — PK strategy: UUIDv7 / BINARY(16)

**Problem:** Random UUIDv4 stored as `CHAR(36) DEFAULT (UUID())` causes B-tree page splits, 4–5× index bloat vs BIGINT, and slow joins at multi-million-row scale. Every secondary index carries the 36-byte PK; `transaction_ledger` joins compound the cost. 123 `CHAR(36)` column occurrences across 48 tables (migrations 001–004).

**Solution:** UUIDv7 (time-ordered) stored as `BINARY(16)`. Generated in application code via `Ramsey\Uuid::uuid7()` (PHP) and the `uuidv7` npm package (Node). A helper layer converts between binary storage and canonical string form for all JSON I/O and URL parameters.

---

#### Table inventory — 48 tables in FK dependency waves

Migration must process parent tables before child tables. The migration uses `SET FOREIGN_KEY_CHECKS=0` globally to allow batch ALTER, then rebuilds all FKs in wave order at the end.

| Wave | Tables |
|---|---|
| 1 (roots) | `user_account`, `role_master`, `permission_master`, `admin_roles`, `circles`, `districts`, `network_zones`, `channels`, `products`, `campaign_master`, `customers` |
| 2 | `user_role`, `role_permission`, `admin_users`, `regions`, `areas`, `sub_channels`, `product_price_versions`, `physical_addon_compatibility`, `campaign_product_rules`, `coupons`, `referral_programs`, `anchors`, `otp_codes`, `inventory_master` |
| 3 | `sub_channel_users`, `price_components`, `campaign_targeting_rules`, `campaign_discount_mappings`, `referral_redemptions`, `referral_reward_ledger`, `active_services`, `customer_assets`, `clusters`, `stock_transfers` |
| 4 | `asset_replacement_history`, `territories` |
| 5 | `distribution_houses` |
| 6 | `dh_area_assignments`, `hub_managers` |
| 7 | `field_agents`, `kams` |
| 8 | `orders`, `onetime_invoices`, `transaction_ledger` |
| 9 | `order_items` |
| Audit | `audit_logs`, `system_audit_logs` (entity IDs stored as VARCHAR — not FK-constrained; convert column type only) |

---

#### Migration SQL strategy — `011_pk_strategy.sql`

Uses a **shadow-column** approach to avoid in-place MODIFY on live PKs:

```
Phase A — prep (per table in wave order):
  1. ALTER TABLE ADD `{pk}_bin` BINARY(16) NULL
  2. UPDATE t SET {pk}_bin = UNHEX(REPLACE({pk}, '-', ''))
  3. Verify COUNT(DISTINCT {pk}_bin) = COUNT(*) — no collision, no NULL

Phase B — cut-over (per table, wave order):
  4. SET FOREIGN_KEY_CHECKS=0
  5. ALTER TABLE DROP FOREIGN KEY {child_fk}   -- all child FKs referencing this table
  6. ALTER TABLE DROP PRIMARY KEY
  7. ALTER TABLE DROP COLUMN {pk}
  8. ALTER TABLE RENAME COLUMN {pk}_bin TO {pk}
  9. ALTER TABLE MODIFY {pk} BINARY(16) NOT NULL
  10. ALTER TABLE ADD PRIMARY KEY ({pk})

Phase C — rebuild FKs (after all tables cut over):
  11. ALTER TABLE ADD CONSTRAINT {fk_name} FOREIGN KEY ({fk_col})
      REFERENCES {parent} ({pk}) ON DELETE {action}
  12. SET FOREIGN_KEY_CHECKS=1
  13. Validate: SELECT COUNT(*) FROM child WHERE fk_col NOT IN (SELECT pk FROM parent) = 0

Phase D — stored procedures only (triggers verified safe):
  14. DROP + recreate stored procedures:
      - has_role(p_user_id BINARY(16), p_role_name VARCHAR)
      - check_and_release_referral_reward(p_ledger_id BINARY(16))
      - force_approve_referral_reward(p_ledger_id BINARY(16), p_admin_name VARCHAR)
  NOTE: All 32 triggers verified — they only SET NEW.updated_at = CURRENT_TIMESTAMP.
  No PK/FK column references. No trigger rewrite required.
```

**Rollback file:** `011_pk_strategy_rollback.sql` — for each table: ADD `{pk}_old CHAR(36)`, populate via `LOWER(INSERT(INSERT(INSERT(INSERT(HEX({pk}),9,0,'-'),14,0,'-'),19,0,'-'),24,0,'-'))`, drop BINARY(16) PK, rename, rebuild FKs. Pre-migration `mysqldump` is the hard fallback.

**Composite PK tables** (`user_role`, `role_permission`, `dh_area_assignments`) — no single PK column to rename; only FK columns need converting via the same shadow-column pattern per FK column.

---

#### Application-layer changes

**PHP — `app/Helpers/UuidHelper.php` (new file)**

```php
use Ramsey\Uuid\Uuid;

class UuidHelper {
    public static function generate(): string { return Uuid::uuid7()->toString(); }

    public static function toBinary(string $uuid): string {
        return hex2bin(str_replace('-', '', $uuid));
    }

    public static function toString(string $binary): string {
        $hex = bin2hex($binary);
        return sprintf('%s-%s-%s-%s-%s',
            substr($hex, 0, 8), substr($hex, 8, 4),
            substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20));
    }
}
```

Controller changes (all domain controllers + BaseApiController):
- Replace any `Str::uuid()` with `UuidHelper::generate()`
- Wrap incoming route params: `UuidHelper::toBinary($request->route('id'))`
- Wrap outgoing JSON: `UuidHelper::toString($model->id)`
- BaseApiController: add `toBinary()` wrapping on all `WHERE id = ?` bindings

**Node — `src/helpers/uuid.js` (new file)**

```js
import { uuidv7 } from 'uuidv7';

export const generateUuid = () => uuidv7();

export const toBinary = (uuid) =>
    Buffer.from(uuid.replace(/-/g, ''), 'hex');

export const toString = (buf) => {
    const h = buf.toString('hex');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
```

`services/db.js` changes:
- Add `queryById(sql, id, params)` helper that auto-wraps `id` with `toBinary()`
- Add `mapRow(row, binaryFields)` helper that converts BINARY(16) columns in result rows
- All route handlers use these — no inline Buffer handling in handlers

---

#### Packages to add

| Layer | Package | Version pin | Note |
|---|---|---|---|
| PHP | `ramsey/uuid` | `^4.7` | `composer.json` does not exist yet in `backend-php/` — must be created before any PHP dep can be added |
| Node | `uuidv7` | `^1.0` | Replaces existing `uuid` v10 dep; `uuidv7` publishes native ESM — compatible with `"type": "module"` in `package.json` |

---

#### Risk flags

| Risk | Status | Mitigation |
|---|---|---|
| Trigger body references PK as CHAR — after cut-over trigger fires on BINARY, implicit cast silently corrupts | ✅ CLOSED — all 32 triggers verified `updated_at`-only; no PK/FK refs | No trigger rewrite needed |
| SP params typed CHAR(36) — caller passes BINARY, MySQL coerces via HEX, `has_role` returns wrong result | OPEN | Redrop + recreate SPs with BINARY(16) params in Phase D |
| `audit_logs.target_record_id CHAR(36)` and `audit_logs.admin_id CHAR(36)` are non-FK string columns — existing rows hold CHAR(36) text strings | OPEN — confirmed column names | Add `target_record_id_bin BINARY(16)` and `admin_id_bin BINARY(16)` alongside; backfill; new writes use binary |
| `system_audit_logs.record_id CHAR(36)` is non-FK string column | OPEN — confirmed | Add `record_id_bin BINARY(16)` alongside; same pattern |
| Raw string UUID comparison in PHP controllers — `->where('field', $id)` where `$id` is a route param | OPEN — confirmed ~20 call sites across all controllers | No hardcoded literals found. All need `UuidHelper::toBinary($id)` wrap at impl time; not a planning blocker |
| `backend-php/composer.json` does not exist | OPEN — **blocks PHP impl start** | Must create `composer.json` with `ramsey/uuid ^4.7` before any PHP code changes |
| Node `uuid` v10 must be replaced by `uuidv7` — not just added alongside | OPEN | `npm remove uuid && npm install uuidv7` — audit all `uuid` import sites in route handlers |
| Non-transactional DDL — partial failure leaves schema inconsistent | OPEN | Take `mysqldump` immediately before Phase B; have rollback SQL ready |

---

#### Pre-migration checklist — verified 2026-05-20

| # | Item | Result | Action required |
|---|---|---|---|
| 1 | `ramsey/uuid ^4.7` supports `uuid7()` | ✅ PASS — uuid7() added in 4.2, ^4.7 is safe | `composer.json` must be created first (see risk flag) |
| 2 | `uuidv7` npm is ESM-compatible | ✅ PASS — package publishes native ESM; `package.json` already has `"type":"module"` | Replace `uuid` v10 with `uuidv7` at impl start |
| 3 | Audit 32 triggers for CHAR(36) refs | ✅ PASS — all 32 triggers only `SET NEW.updated_at = CURRENT_TIMESTAMP`; zero PK/FK refs | No trigger rewrite needed; remove Phase D trigger step |
| 4 | PHP controllers: raw string UUID literals | ✅ PASS — no hardcoded UUID strings. All `->where()` use route/request variables | ~20 call sites need `UuidHelper::toBinary()` wrap at impl time |
| 5 | Node `services/db.js`: raw string UUID comparisons | ✅ PASS — `db.js` is pool-only (9 lines); no query logic exists | `queryById`/`mapRow` helpers to be written fresh |
| 6 | `audit_logs` / `system_audit_logs` column types | ⚠️ NOTE — corrected column names: `audit_logs.target_record_id CHAR(36)` + `audit_logs.admin_id CHAR(36)` + `system_audit_logs.record_id CHAR(36)` — all non-FK | Add three `_bin` shadow columns; see risk flags |
| 7 | Composite PK tables: shadow-column naming conflicts | ✅ PASS — `user_id_bin`, `role_id_bin`, `permission_id_bin`, `dh_id_bin`, `area_id_bin` — no existing cols with these names | No action |

**Checklist outcome:** 5 clear pass, 1 note (column names corrected), 0 hard blocks on the migration itself. One prerequisite blocker: `composer.json` must be created before PHP implementation starts.

---

**Exit criteria:** `SET FOREIGN_KEY_CHECKS=1` completes with zero errors; all FK validation queries return 0; `SHOW CREATE TABLE orders` shows `BINARY(16)` PK and FK columns; `UuidHelper::generate()` and `generateUuid()` produce valid UUIDv7 strings; on a synthetic 1M-row insert into `transaction_ledger` the sequential-write pattern produces <2% page splits (verified via `innodb_buffer_pool_stats`); rollback SQL tested on a copy of the dump and restores without error.

### P-1.2 — Auth hardening

#### Verified gaps (code-verified 2026-05-20)

| Gap | Location | Detail |
|---|---|---|
| OTP plaintext | `otp_codes.code CHAR(6)` | No hash, no salt |
| No OTP rate limit | `AuthController::requestOtp` | Zero throttle on msisdn or IP |
| No brute-force lockout | `AuthController::verifyOtp` | No `failed_attempts` counter, no `locked_until` |
| Dev OTP leak | `AuthController::requestOtp` | Runtime `if (APP_ENV=local)` branch returns code in response body — present in production binary |
| JWT lifetime too long | `verifyOtp` | `jwt_ttl` defaults to 1440 min (24h); no refresh token |
| No `jti` in JWT | `verifyOtp` payload | Cannot revoke individual tokens |
| `staff_type` missing from JWT | `verifyOtp` payload | Node must DB-lookup to determine manager entity type (violates rule 13) |
| JWT in localStorage | `api.ts` + `AuthContext.tsx` | `localStorage.getItem('sf_token')` — XSS-accessible |
| Logout is client-only | `AuthController::logout` + `AuthContext::logout` | Returns `{message: 'Logged out'}` but invalidates nothing server-side |
| `has_role` SP never called | `JwtMiddleware.php` | All routes guarded by `auth.jwt` only — no permission check |
| No `PermissionMiddleware` | `app/Http/Middleware/` | File does not exist |
| JwtMiddleware reads header | `JwtMiddleware.php` | Uses `bearerToken()` — breaks after cookie migration |
| No revocation check | `JwtMiddleware.php` | No Redis `jwt:revoked:{jti}` lookup |
| WS zero auth | `backend-node/src/index.js` | `wss.on('connection', ...)` accepts every upgrade with no token check |

---

#### DB migration — `012_auth_hardening.sql`

```sql
ALTER TABLE `otp_codes`
  CHANGE COLUMN `code` `code_hash` CHAR(64) NOT NULL,
  ADD COLUMN `salt`            CHAR(32)         NOT NULL AFTER `code_hash`,
  ADD COLUMN `failed_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `locked_until`    DATETIME         NULL;
```

No new tables — refresh tokens live in Redis only.

---

#### Redis key patterns

| Key | TTL | Value | Purpose |
|---|---|---|---|
| `otp_rate:msisdn:{contact_number}` | 3600s | integer count | Request rate limit per msisdn (max 5/h) |
| `otp_rate:ip:{ip}` | 86400s | integer count | Request rate limit per IP (max 20/d) |
| `jwt:revoked:{jti}` | 900s | `1` | Revoked access token JTIs — TTL matches access token TTL |
| `jwt:refresh:{token}` | 604800s | `{user_id}` | Valid refresh tokens (opaque 64-char hex) |
| `rbac:{user_id}:{role_name}` | 300s | `0` or `1` | Cached `has_role` result per user + role |

---

#### JWT payload (new shape)

```json
{
  "iss": "supremeflex",
  "sub": "<user_id>",
  "jti": "<uuidv7>",
  "staff_type": "CS_REP|KAM|DH_MANAGER|CHANNEL_MANAGER|SUBCHANNEL_MANAGER|ADMIN",
  "iat": 1234567890,
  "exp": 1234568790
}
```

Access token TTL: **900s (15 min)**. `staff_type` added — Node reads from payload, no DB lookup needed.

---

#### Cookie spec

| Attribute | `sf_access` (access token) | `sf_refresh` (refresh token) |
|---|---|---|
| HttpOnly | true | true |
| Secure | true (prod) / false (local) | same |
| SameSite | Strict | Strict |
| Path | `/` | `/api/auth/refresh` |
| Max-Age | 900s | 604800s (7d) |

Both set by PHP on `POST /api/auth/otp/verify`; both cleared on `POST /api/auth/logout`.

**Cross-origin note:** PHP (:8000) and Node (:8001) share the `localhost` domain — cookies scoped to `localhost` are sent to both ports. Frontend axios instances must set `withCredentials: true`.

---

#### PHP changes

**`AuthController.php` — rewrite of all 4 methods + 2 new endpoints:**

`requestOtp`:
1. Redis INCR `otp_rate:msisdn:{contact_number}` — if ≥ 5 return 429; set TTL 3600s on first call
2. Redis INCR `otp_rate:ip:{request->ip()}` — if ≥ 20 return 429; set TTL 86400s on first call
3. Generate 6-digit code + 32-char hex salt
4. Compute `code_hash = hash('sha256', $code . $salt)`
5. Insert into `otp_codes` with `code_hash`, `salt`, `failed_attempts=0`, `locked_until=NULL`
6. `Log::info("OTP {$contact_number}: {$code}")` — code never in response body

`verifyOtp`:
1. Fetch latest unused, unexpired row for `contact_number`
2. If no row → 401
3. If `locked_until IS NOT NULL AND locked_until > NOW()` → 423
4. Compare `hash('sha256', $request->code . $row->salt)` vs `$row->code_hash`
5. Mismatch: `failed_attempts++`; if ≥ 5 set `locked_until = NOW() + 15min`; return 401
6. Match: `used=1`, `failed_attempts=0`
7. Build JWT: `sub`, `jti = UuidHelper::generate()`, `staff_type`, TTL 900s
8. Generate refresh token: `bin2hex(random_bytes(32))` (64-char hex); store `jwt:refresh:{token} = user_id` in Redis (604800s)
9. Set `sf_access` + `sf_refresh` httpOnly cookies; return `{user: {...}}` — no token in body

`refreshToken` (new — `POST /api/auth/refresh`):
1. Read `sf_refresh` cookie
2. Redis GET `jwt:refresh:{token}` → if missing return 401
3. Fetch user by `user_id`; build new access JWT with new `jti`
4. Set new `sf_access` cookie; optionally rotate refresh token
5. Return `{user: {...}}`

`logout` (rewrite):
1. Read `jti` from `auth_user` (decoded by JwtMiddleware)
2. Redis SET `jwt:revoked:{jti}` `1` EX 900
3. Read `sf_refresh` cookie; Redis DEL `jwt:refresh:{token}`
4. Clear both cookies (Max-Age=0); return 204

`devPeek` (new — `GET /api/auth/otp/dev-peek?contact_number={n}`):
- Registered only when `app()->environment() !== 'production'`
- Returns the `code_hash` + `salt` of the latest unused OTP for debugging (or store plain code temporarily in a `dev_code` column added only in non-prod migrations)

**`JwtMiddleware.php` — rewrite:**
1. Read from `$request->cookie('sf_access')` instead of `bearerToken()`
2. Decode + verify signature
3. Redis GET `jwt:revoked:{decoded->jti}` → if exists return 401
4. `$request->merge(['auth_user' => [...$decoded, 'jti' => $decoded->jti]])`

**New `PermissionMiddleware.php`:**
```
handle($request, $next, $permission):
  1. $userId = $request->auth_user['sub']
  2. $cacheKey = "rbac:{$userId}:{$permission}"
  3. $result = Redis::get($cacheKey)
  4. if null: CALL has_role($userId, $permission) → cache result 300s
  5. if result == 0 → return 403
  6. return $next($request)
```

**`routes/api.php` — changes:**
- Add `POST /api/auth/refresh` (public, no middleware)
- Conditionally register `GET /api/auth/otp/dev-peek` when not production
- Change all route groups from `auth.jwt` to `auth.jwt,can:{role}` where role matches the resource domain
- Remove runtime OTP branch (moves to dev-peek endpoint)

---

#### Node changes

**New `src/middleware/auth.js`:**
```js
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
    const cookie = req.headers.cookie ?? '';
    const match  = cookie.match(/sf_access=([^;]+)/);
    if (!match) return res.status(401).json({ message: 'Unauthorized' });
    try {
        req.auth = jwt.verify(match[1], process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: 'Token invalid or expired' });
    }
}
```

Apply to all three routers: add `router.use(requireAuth)` at the top of `fieldExecution.js`, `stockTransfers.js`, `dashboard.js`.

**`src/index.js` — WebSocket auth on upgrade:**
```js
// Change WebSocketServer to noServer mode
const wss = new WebSocketServer({ noServer: true });

// Validate JWT before handing off to wss
server.on('upgrade', (req, socket, head) => {
    const cookie = req.headers.cookie ?? '';
    const match  = cookie.match(/sf_access=([^;]+)/);
    if (!match) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
    try {
        jwt.verify(match[1], process.env.JWT_SECRET);
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy();
    }
});
```

---

#### Frontend changes

**`frontend/lib/api.ts`:**
- Remove `attachToken()` and both `attachToken(phpApi)` / `attachToken(nodeApi)` calls
- Add `withCredentials: true` to both `axios.create()` configs
- Add response interceptor on both: on 401 → call `phpApi.post('/auth/refresh')`; on second 401 → `window.location.href = '/login'`

**`frontend/contexts/AuthContext.tsx`:**
- Remove all `localStorage` token reads/writes (`sf_token` key gone)
- `login(userObj)` signature — no token param; store user in React state only
- `logout()` — calls `phpApi.post('/auth/logout')` before clearing state
- `useEffect` on mount — call `phpApi.get('/auth/me')` to rehydrate user state (replaces localStorage `sf_user` read); handles 401 gracefully (unauthenticated on cold load)

---

#### Files created / modified

| File | Action |
|---|---|
| `database/migrations/012_auth_hardening.sql` | New |
| `app/Http/Controllers/Api/AuthController.php` | Rewrite |
| `app/Http/Middleware/JwtMiddleware.php` | Rewrite |
| `app/Http/Middleware/PermissionMiddleware.php` | New |
| `backend-php/routes/api.php` | Modify |
| `backend-node/src/middleware/auth.js` | New |
| `backend-node/src/index.js` | Modify |
| `backend-node/src/routes/fieldExecution.js` | Modify |
| `backend-node/src/routes/stockTransfers.js` | Modify |
| `backend-node/src/routes/dashboard.js` | Modify |
| `frontend/lib/api.ts` | Modify |
| `frontend/contexts/AuthContext.tsx` | Modify |

**Dependency note:** Redis in PHP requires `predis/predis` — add when `composer.json` is created (P-1.1 prerequisite). `firebase/jwt-php` already present — no new JWT package needed.

---

#### Pre-implementation checklist — verified 2026-05-20

| # | Item | Status |
|---|---|---|
| 1 | `otp_codes` supports hashing | ⚠️ Needs migration 012 |
| 2 | `has_role` SP exists and correct | ✅ In migration 003; params need BINARY(16) update after P-1.1 |
| 3 | `PermissionMiddleware` exists | ❌ Must create |
| 4 | `JwtMiddleware` reads from cookie | ❌ Currently reads `bearerToken()` |
| 5 | WS upgrade validates JWT | ❌ Zero check today |
| 6 | `staff_type` in JWT payload | ❌ Missing from current payload |
| 7 | Frontend uses `withCredentials` | ❌ Uses `Authorization: Bearer` from localStorage |
| 8 | Logout invalidates server-side | ❌ Client-only today |
| 9 | Dev OTP in separate endpoint | ❌ Runtime branch in `requestOtp` today |
| 10 | `predis/predis` in composer.json | ⚠️ Blocked until composer.json created (P-1.1 prerequisite) |

---

**Exit criteria:**
- `POST /api/auth/otp/request` (6th call/h on same msisdn) → 429
- `POST /api/auth/otp/verify` (6th wrong attempt in 15 min) → 423
- `SELECT code FROM otp_codes` returns 64-char hex, not `123456`
- `POST /api/auth/otp/verify` response has no `token` field; `Set-Cookie: sf_access; HttpOnly` header present
- `POST /api/auth/refresh` with valid `sf_refresh` cookie → 200 + new `sf_access`
- `POST /api/auth/logout` → Redis `jwt:revoked:{jti}` key exists; old token → 401
- `GET /api/network-zones` with valid JWT but insufficient role → 403
- `ws://localhost:8001/ws/dashboard` upgrade with no cookie → HTTP 401, connection refused
- `GET /api/auth/otp/dev-peek` returns 404 on `APP_ENV=production`

### P-1.3 — Idempotency keys on mutating endpoints
**Why:** Field agents on mobile networks will retry. Without idempotency, retries create duplicate orders, duplicate IP provisioning calls (which trigger GPShop / RealIP external APIs), duplicate stock transfers, duplicate referral redemptions.

**Scope:** POST/PATCH/DELETE on `orders`, `addon_order_history`, `cpe_order_history`, `ott_order_history`, `real_ip_assignments`, `stock_transfers`, `referral_redemptions`.

---

#### Verified state — current gaps

| # | Gap | File(s) | Status |
|---|-----|---------|--------|
| 1 | No `Idempotency-Key` enforcement on any route | All PHP controllers, all Node routes | ❌ Missing |
| 2 | No Redis `idempotency:` key namespace | — | ❌ Missing |
| 3 | No in-flight lock — concurrent duplicate requests race to create duplicate rows | — | ❌ Missing |
| 4 | No `Idempotency-Replay: true` response header on cache hits | — | ❌ Missing |
| 5 | Frontend generates no idempotency key on mutations | `frontend/lib/api.ts` | ❌ Missing |
| 6 | `POST /api/invoices` triggers order creation but is not guarded | `api.php:79` | ❌ Missing |
| 7 | Node stock-transfer + field-execution mutations have no dedup protection | `stockTransfers.js:41,60`, `fieldExecution.js:57` | ❌ Missing |
| 8 | `REDIS_URL` env var absent from both `.env.example` files | `backend-php/.env.example`, `backend-node/.env.example` | ❌ Missing |

---

#### Redis key design

```
idempotency:{sha256(raw-Idempotency-Key-header)}
→ JSON { status: "processing"|"complete", request_hash: <sha256-of-body>,
         status_code: <int>, response_body: <json>, created_at: <unix> }
```

| State | TTL | Meaning |
|-------|-----|---------|
| `processing` | 30 s | In-flight lock — another request is currently executing with this key |
| `complete` | 86 400 s (24 h) | Cached result — replayed verbatim on subsequent hits |

Hashing the header value keeps the Redis key ASCII-safe regardless of client-supplied content.
Shared namespace with P-1.2's `jwt:revoked:` and `jwt:refresh:` keys — same Redis instance, different prefixes.

---

#### PHP — `app/Http/Middleware/IdempotencyMiddleware.php`

```
handle($request, $next):
  1. $key = $request->header('Idempotency-Key')
     if (!$key) → return 422 { message: 'Idempotency-Key header required' }

  2. $redisKey = 'idempotency:' . hash('sha256', $key)
     $bodyHash  = hash('sha256', $request->getContent())

  3. $cached = Redis::get($redisKey)
     if ($cached):
       $entry = json_decode($cached, true)
       if $entry['status'] === 'processing'
         → return 409 { message: 'Duplicate request in flight — retry after a moment' }
       if $entry['request_hash'] !== $bodyHash
         → return 409 { message: 'Idempotency key already used with a different request body' }
       // HIT — replay cached response
       → return response()->json($entry['response_body'], $entry['status_code'])
                          ->header('Idempotency-Replay', 'true')

  4. // MISS — set in-flight lock (30 s TTL)
     Redis::setex($redisKey, 30, json_encode(['status' => 'processing', 'request_hash' => $bodyHash]))

  5. $response = $next($request)

  6. // Store completed response (24 h TTL)
     Redis::setex($redisKey, 86400, json_encode([
       'status'        => 'complete',
       'request_hash'  => $bodyHash,
       'status_code'   => $response->getStatusCode(),
       'response_body' => json_decode($response->getContent(), true),
       'created_at'    => time(),
     ]))

  7. return $response
```

Registration in `app/Http/Kernel.php` `$routeMiddleware`:
```php
'idempotency' => \App\Http\Middleware\IdempotencyMiddleware::class,
```

Applied in `routes/api.php` — a new sub-group inside the existing `auth.jwt` group:
```php
Route::middleware('idempotency')->group(function () {
    Route::post('invoices',                                      [InvoiceController::class, 'store']);
    Route::apiResource('stock-transfers', StockTransferController::class)->only(['store','update','destroy']);
    Route::patch('stock-transfers/{id}/respond',                 [StockTransferController::class, 'respond']);
    Route::apiResource('real-ip-assignments', RealIpAssignmentController::class)->only(['store','update','destroy']);
    Route::post('referrals/check-reward',                        [ReferralRewardController::class, 'checkReward']);
    Route::post('referrals/force-approve',                       [ReferralRewardController::class, 'forceApprove']);
    // addon/cpe/ott order routes registered here when Phase 0 controllers are added
});
```

Note: `orders`, `addon_order_history`, `cpe_order_history`, `ott_order_history` controllers do not yet exist in `api.php` — they are created in Phase 0. When added, register them inside this `idempotency` group.

---

#### Node — `src/middleware/idempotency.js`

```js
import crypto from 'crypto';
import { redis } from '../services/redis.js';  // shared client — see below

export async function requireIdempotency(req, res, next) {
    const key = req.headers['idempotency-key'];
    if (!key) return res.status(422).json({ message: 'Idempotency-Key header required' });

    const redisKey = `idempotency:${crypto.createHash('sha256').update(key).digest('hex')}`;
    const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

    const cached = await redis.get(redisKey);
    if (cached) {
        const entry = JSON.parse(cached);
        if (entry.status === 'processing')
            return res.status(409).json({ message: 'Duplicate request in flight — retry after a moment' });
        if (entry.requestHash !== bodyHash)
            return res.status(409).json({ message: 'Idempotency key already used with a different request body' });
        return res.status(entry.statusCode).set('Idempotency-Replay', 'true').json(entry.responseBody);
    }

    await redis.setEx(redisKey, 30, JSON.stringify({ status: 'processing', requestHash: bodyHash }));

    const origJson = res.json.bind(res);
    res.json = async (body) => {
        await redis.setEx(redisKey, 86400, JSON.stringify({
            status: 'complete', requestHash: bodyHash,
            statusCode: res.statusCode, responseBody: body, createdAt: Date.now(),
        }));
        return origJson(body);
    };

    next();
}
```

**New `src/services/redis.js`** — shared Redis client (also consumed by P-1.2 JWT revocation):
```js
import { createClient } from 'redis';

export const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
redis.on('error', (err) => { console.error('Redis client error', err); process.exit(1); });
await redis.connect();
```

Apply middleware in the two Node routers:
```js
// stockTransfers.js
import { requireIdempotency } from '../middleware/idempotency.js';
router.post('/',             requireIdempotency, async (req, res) => { ... });
router.patch('/:id/respond', requireIdempotency, async (req, res) => { ... });

// fieldExecution.js
router.post('/scan-to-fulfill', requireIdempotency, async (req, res) => { ... });
```

---

#### Frontend — generating `Idempotency-Key` per action

Keys must be stable on retry (same key every time you retry one action) and unique per distinct action (new key for each new operation).

Pattern: generate a `UUIDv4` when the user initiates the action (form open / button click), reuse it on every retry of that same submission, discard on success.

**New `frontend/lib/idempotency.ts`:**
```ts
export function newIdempotencyKey(): string {
    return crypto.randomUUID();
}
```

**Usage at call sites** (not a global interceptor — each mutation needs its own key):
```ts
const key = newIdempotencyKey();
await phpApi.post('/stock-transfers', payload, {
    headers: { 'Idempotency-Key': key },
});
```

---

#### Files created / modified

| File | Action |
|---|---|
| `app/Http/Middleware/IdempotencyMiddleware.php` | New |
| `app/Http/Kernel.php` | Add `'idempotency'` to `$routeMiddleware` |
| `backend-php/routes/api.php` | New `idempotency` sub-group wrapping 6 existing routes |
| `backend-php/.env.example` | Add `REDIS_URL=redis://localhost:6379` |
| `backend-node/src/middleware/idempotency.js` | New |
| `backend-node/src/services/redis.js` | New (shared with P-1.2 JWT revocation) |
| `backend-node/src/routes/stockTransfers.js` | Apply `requireIdempotency` to POST + PATCH respond |
| `backend-node/src/routes/fieldExecution.js` | Apply `requireIdempotency` to POST /scan-to-fulfill |
| `backend-node/.env.example` | Add `REDIS_URL=redis://localhost:6379` |
| `frontend/lib/idempotency.ts` | New |

**Dependency note:** PHP Redis requires `predis/predis` (flagged in P-1.2). Node Redis requires `redis` npm package. `src/services/redis.js` should be created alongside P-1.2's auth work since both consume the same Redis connection.

---

#### Pre-implementation checklist

| # | Item | Status |
|---|---|---|
| 1 | `predis/predis` in `composer.json` and Redis reachable from PHP | ⚠️ Blocked until `composer.json` created (P-1.1 prerequisite) |
| 2 | `redis` npm package in `backend-node/package.json` | ⚠️ Needs verification |
| 3 | `REDIS_URL` added to both `.env.example` files | ❌ Must add |
| 4 | `src/services/redis.js` shared client created | ❌ Must create (coordinate with P-1.2) |
| 5 | `IdempotencyMiddleware.php` exists | ❌ Must create |
| 6 | `'idempotency'` registered in `Kernel.php` `$routeMiddleware` | ❌ Must add |
| 7 | All 6 PHP routes wrapped in `idempotency` sub-group | ❌ `routes/api.php` unchanged |
| 8 | `backend-node/src/middleware/idempotency.js` exists | ❌ Must create |
| 9 | Node mutating routes apply `requireIdempotency` | ❌ No middleware today |
| 10 | `frontend/lib/idempotency.ts` helper created | ❌ Must create |

---

**Exit criteria:**
- `POST /api/stock-transfers` with `Idempotency-Key: test-key-1` twice (same body) → second call returns identical body + `Idempotency-Replay: true` header; only one DB row created
- Same key with different body → 409 `"Idempotency key already used with a different request body"`
- `POST /api/stock-transfers` with no `Idempotency-Key` header → 422 `"Idempotency-Key header required"`
- Two simultaneous requests with same key (same body) → one 200 + one 409 `"Duplicate request in flight"`; only one DB row created
- Redis key for a completed request expires after 24 h → same key accepted as a fresh operation
- `POST /stock-transfers` on Node: same dedup behaviour as PHP tests above
- `GET /api/stock-transfers` (read) — middleware not applied; no `Idempotency-Key` required

### P-1.4 — Test harness

---

#### Verified state — current gaps

| # | Gap | File(s) | Status |
|---|-----|---------|--------|
| 1 | No `tests/` directory in `backend-php/` | — | ❌ Missing |
| 2 | No `phpunit.xml` | — | ❌ Missing |
| 3 | No `composer.json` (blocked on P-1.1) — therefore no PHPUnit dep | — | ⚠️ Blocked |
| 4 | No `test/` directory in `backend-node/` | — | ❌ Missing |
| 5 | No `vitest.config.js` | — | ❌ Missing |
| 6 | No `test` script in `backend-node/package.json` | `package.json` | ❌ Missing |
| 7 | No vitest / supertest deps in Node | `package.json` | ❌ Missing |
| 8 | No `.github/workflows/test.yml` (`.github/` dir absent) | — | ❌ Missing |
| 9 | `AuthController` stores OTP plaintext + has runtime `local`-env branch — post-P-1.2 fix required before auth tests are meaningful | `AuthController.php` | ⚠️ P-1.2 prerequisite |
| 10 | `JwtMiddleware` reads `bearerToken()` — post-P-1.2 rewrite (cookie) must land first | `JwtMiddleware.php` | ⚠️ P-1.2 prerequisite |

---

#### PHP — directory structure

```
backend-php/
├── phpunit.xml
└── tests/
    ├── TestCase.php                        # base: RefreshDatabase + auth helpers
    ├── Feature/
    │   ├── Auth/
    │   │   ├── OtpRequestTest.php          # rate-limit, dedup invalidation, SHA-256 storage
    │   │   ├── OtpVerifyTest.php           # lockout, wrong code, expired, success → cookie
    │   │   ├── RefreshTest.php             # valid refresh cookie → new access token
    │   │   └── LogoutTest.php             # cookie cleared, jti in Redis revocation list
    │   ├── Idempotency/
    │   │   └── IdempotencyMiddlewareTest.php  # all 4 cases (replay, mismatch, in-flight, missing)
    │   └── StockTransfers/
    │       └── StockTransferTest.php       # create, respond, concurrent race (SELECT FOR UPDATE)
    ├── Unit/
    │   ├── Middleware/
    │   │   ├── JwtMiddlewareTest.php       # missing / invalid / revoked / valid token
    │   │   └── PermissionMiddlewareTest.php # role miss → 403, role hit → pass, Redis cache hit
    │   └── Services/
    │       └── ReferralSPTest.php          # check_and_release + force_approve state transitions
    └── Contract/
        ├── GpShopServiceContractTest.php
        ├── LocationChangeServiceContractTest.php
        ├── RealIpServiceContractTest.php
        └── CustomerLifecycleServiceContractTest.php
```

**`phpunit.xml`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit bootstrap="vendor/autoload.php" colors="true">
  <testsuites>
    <testsuite name="Unit">     <directory>tests/Unit</directory>     </testsuite>
    <testsuite name="Feature">  <directory>tests/Feature</directory>  </testsuite>
    <testsuite name="Contract"> <directory>tests/Contract</directory> </testsuite>
  </testsuites>
  <source><include><directory>app</directory></include></source>
  <coverage><report><clover outputFile="coverage.xml"/></report></coverage>
  <php>
    <env name="APP_ENV"      value="testing"/>
    <env name="DB_DATABASE"  value="supremeflex_test"/>
    <env name="REDIS_CLIENT" value="array"/>   <!-- fake in-memory Redis for unit/feature tests -->
    <env name="JWT_SECRET"   value="test-secret-do-not-use-in-prod"/>
  </php>
</phpunit>
```

**`composer.json` test deps** (to be created in P-1.1; test section only):
```json
"require-dev": {
  "phpunit/phpunit": "^11.0",
  "mockery/mockery": "^1.6",
  "orchestra/testbench": "^9.0"
}
"scripts": {
  "test": "phpunit"
}
```

**Coverage targets (PHP):**

| Suite | Target | Key classes |
|-------|--------|-------------|
| Auth middleware (`JwtMiddleware`, `PermissionMiddleware`) | 100% | Token decode, revocation, role check, Redis cache |
| OTP flow (`AuthController::requestOtp/verifyOtp`) | 100% | Rate limit, lockout, SHA-256 write, cookie set |
| Idempotency middleware | 100% | Replay, mismatch, in-flight, missing header |
| Referral SP state transitions | 90% | `PENDING→RELEASED`, `PENDING→EXPIRED`, `force_approve` |
| Service layer (controllers) | 80% | All public methods with happy + error paths |

---

#### PHP — representative test cases

**`OtpRequestTest.php`** key cases:
```
- 6th request in one hour for same msisdn → 429
- 21st request in one day from same IP → 429
- Valid request → otp_codes row has 64-char hex code (SHA-256), not '123456'
- New request invalidates existing unexpired OTP for same number
```

**`OtpVerifyTest.php`** key cases:
```
- 6th wrong OTP attempt in 15 min → 423 Locked
- Correct OTP → 200, response contains no 'token' field, Set-Cookie: sf_access; HttpOnly
- Expired OTP → 422
- Already-used OTP → 422
```

**`JwtMiddlewareTest.php`** key cases (post-P-1.2 cookie transport):
```
- No sf_access cookie → 401
- Malformed / wrong-secret token → 401
- Valid token but jti in Redis revocation list → 401
- Valid token, jti not revoked → passes through, auth_user merged into request
```

**`IdempotencyMiddlewareTest.php`** key cases:
```
- POST without Idempotency-Key header → 422
- POST × 2 same key + same body → second returns 200 with Idempotency-Replay: true, one DB row
- POST × 2 same key + different body → second returns 409 "different request body"
- POST × 2 same key, first still in-flight → second returns 409 "in flight"
```

**`ReferralSPTest.php`** key cases:
```
- check_and_release: reward with PENDING status, order delivered → status becomes RELEASED
- check_and_release: reward with PENDING status, order not delivered → status unchanged
- check_and_release: reward already RELEASED → no duplicate release
- force_approve: PENDING → RELEASED regardless of delivery status
- force_approve: already RELEASED → idempotent (no error)
```

---

#### Node — directory structure

```
backend-node/
├── vitest.config.js
└── test/
    ├── helpers/
    │   ├── app.js          # createApp() — express app without listen(), for supertest
    │   └── redis-mock.js   # vi.mock('../src/services/redis.js', ...) shared setup
    ├── unit/
    │   └── middleware/
    │       ├── auth.test.js           # requireAuth
    │       └── idempotency.test.js    # requireIdempotency
    └── integration/
        ├── stockTransfers.test.js
        └── fieldExecution.test.js
```

**`vitest.config.js`:**
```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**'],
            thresholds: { lines: 80, functions: 80 },
        },
    },
});
```

**`package.json` test deps** (add alongside existing deps):
```json
"devDependencies": {
  "vitest": "^2.0",
  "@vitest/coverage-v8": "^2.0",
  "supertest": "^7.0"
},
"scripts": {
  "dev":  "node --watch src/index.js",
  "start":"node src/index.js",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

**Coverage targets (Node):**

| Suite | Target | Key modules |
|-------|--------|-------------|
| `src/middleware/auth.js` | 100% | No cookie, bad token, revoked jti, valid pass-through |
| `src/middleware/idempotency.js` | 100% | Replay, mismatch, in-flight, missing header |
| `src/routes/stockTransfers.js` | 80% | POST create, PATCH respond, error paths |
| `src/routes/fieldExecution.js` | 80% | PATCH lead status, POST scan-to-fulfill |

**`auth.test.js`** key cases:
```
- No sf_access cookie → 401
- Invalid signature → 401
- Valid token → req.auth populated, next() called
```

**`idempotency.test.js`** key cases (Redis mocked via vi.mock):
```
- Missing header → 422
- Cache miss → in-flight lock written, handler runs, result cached
- Cache hit (complete, same hash) → 200 replay + Idempotency-Replay header
- Cache hit (complete, different hash) → 409
- Cache hit (processing) → 409
```

---

#### Contract tests — PHP

Pattern: abstract base class defines the contract assertions; two concrete subclasses supply the Mock and the ApiService implementation. The ApiService uses a Guzzle `MockHandler` so no real HTTP calls are made in CI.

**`GpShopServiceContractTest.php`** (abstract base):
```php
abstract class GpShopServiceContractTest extends TestCase
{
    abstract protected function makeService(): GpShopServiceInterface;

    public function test_createOrder_returns_required_shape(): void
    {
        $result = $this->makeService()->createOrder('cust-1', 'prod-1');
        $this->assertArrayHasKey('gpshop_order_id', $result);
        $this->assertArrayHasKey('status', $result);
        $this->assertArrayHasKey('estimated_delivery_days', $result);
        $this->assertIsInt($result['estimated_delivery_days']);
    }

    public function test_getOrderStatus_returns_required_shape(): void { ... }
    public function test_cancelOrder_returns_required_shape(): void { ... }
}

class GpShopMockContractTest extends GpShopServiceContractTest
{
    protected function makeService(): GpShopServiceInterface { return new GpShopService(); }
}

class GpShopApiContractTest extends GpShopServiceContractTest
{
    protected function makeService(): GpShopServiceInterface
    {
        // Guzzle MockHandler returns a plausible API response shape
        $mock = new MockHandler([new Response(200, [], json_encode([...]))]);
        return new GpShopApiService(new Client(['handler' => HandlerStack::create($mock)]));
    }
}
```

Same pattern applies to `LocationChange`, `RealIp`, and `CustomerLifecycle` contracts.

---

#### CI — `.github/workflows/test.yml`

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  php-tests:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env: { MYSQL_DATABASE: supremeflex_test, MYSQL_ROOT_PASSWORD: password }
        ports: ['3306:3306']
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-retries=3
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '8.2', extensions: 'pdo_mysql,redis,xdebug', coverage: xdebug }
      - run: cd backend-php && composer install --no-interaction
      - run: cd backend-php && cp .env.example .env && php artisan key:generate
      - run: cd backend-php && php artisan migrate --env=testing
      - run: cd backend-php && composer test -- --coverage-clover coverage.xml
      - uses: actions/upload-artifact@v4
        with: { name: php-coverage, path: backend-php/coverage.xml }

  node-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: cd backend-node && npm ci
      - run: cd backend-node && npm run test:coverage
      - uses: actions/upload-artifact@v4
        with: { name: node-coverage, path: backend-node/coverage }

  frontend-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
```

---

#### Files created / modified

| File | Action |
|---|---|
| `backend-php/phpunit.xml` | New |
| `backend-php/composer.json` | Add `require-dev` PHPUnit + Mockery + Testbench; add `test` script |
| `backend-php/tests/TestCase.php` | New — base test case |
| `backend-php/tests/Feature/Auth/OtpRequestTest.php` | New |
| `backend-php/tests/Feature/Auth/OtpVerifyTest.php` | New |
| `backend-php/tests/Feature/Auth/RefreshTest.php` | New |
| `backend-php/tests/Feature/Auth/LogoutTest.php` | New |
| `backend-php/tests/Feature/Idempotency/IdempotencyMiddlewareTest.php` | New |
| `backend-php/tests/Feature/StockTransfers/StockTransferTest.php` | New |
| `backend-php/tests/Unit/Middleware/JwtMiddlewareTest.php` | New |
| `backend-php/tests/Unit/Middleware/PermissionMiddlewareTest.php` | New |
| `backend-php/tests/Unit/Services/ReferralSPTest.php` | New |
| `backend-php/tests/Contract/GpShopServiceContractTest.php` | New |
| `backend-php/tests/Contract/LocationChangeServiceContractTest.php` | New |
| `backend-php/tests/Contract/RealIpServiceContractTest.php` | New |
| `backend-php/tests/Contract/CustomerLifecycleServiceContractTest.php` | New |
| `backend-node/vitest.config.js` | New |
| `backend-node/package.json` | Add vitest + supertest devDeps; add `test` + `test:coverage` scripts |
| `backend-node/test/helpers/app.js` | New — express app factory for supertest |
| `backend-node/test/helpers/redis-mock.js` | New — shared Redis vi.mock setup |
| `backend-node/test/unit/middleware/auth.test.js` | New |
| `backend-node/test/unit/middleware/idempotency.test.js` | New |
| `backend-node/test/integration/stockTransfers.test.js` | New |
| `backend-node/test/integration/fieldExecution.test.js` | New |
| `.github/workflows/test.yml` | New |

**Sequencing note:** Auth tests (`OtpVerifyTest`, `JwtMiddlewareTest`, `auth.test.js`) must be written against the post-P-1.2 state (cookie transport, SHA-256 OTP). Write these after P-1.2 lands. Idempotency tests depend on P-1.3. The contract tests and referral SP tests are independent — they can be written now.

---

#### Pre-implementation checklist

| # | Item | Status |
|---|---|---|
| 1 | `composer.json` exists (P-1.1 prerequisite) | ⚠️ Blocked on P-1.1 |
| 2 | PHPUnit + Mockery + Testbench in `composer.json` `require-dev` | ❌ Must add |
| 3 | `phpunit.xml` created at `backend-php/` root | ❌ Must create |
| 4 | `supremeflex_test` MySQL database created in CI + local | ❌ Must provision |
| 5 | `REDIS_CLIENT=array` fake driver works for unit/feature (no real Redis needed in tests) | ❌ Must verify |
| 6 | `GpShopApiService` (and the other 3 real services) accept injected Guzzle client for testability | ❌ Must refactor constructor (currently hardcodes `new Client()`) |
| 7 | `vitest` + `@vitest/coverage-v8` + `supertest` in `backend-node/package.json` devDeps | ❌ Must add |
| 8 | `vitest.config.js` created at `backend-node/` root | ❌ Must create |
| 9 | `test` + `test:coverage` scripts in `backend-node/package.json` | ❌ Must add |
| 10 | `.github/` directory + `test.yml` workflow created | ❌ Must create |

---

**Exit criteria:**
- `cd backend-php && composer test` → all suites green, coverage report at `coverage.xml`
- PHP coverage: auth+RBAC+idempotency middleware ≥ 100%; referral SP ≥ 90%; services ≥ 80%
- `cd backend-node && npm test` → all unit + integration tests green
- Node coverage: auth + idempotency middleware ≥ 100%; route handlers ≥ 80%
- All 4 contract test pairs (Mock + ApiService stub) pass against the same assertion suite
- `cd frontend && npm run lint` → zero ESLint errors
- GitHub Actions `test.yml` workflow passes on push to `main`
- Coverage artifacts uploaded and downloadable from GH Actions run

### P-1.5 — Boot-time production guards

---

#### Verified state — current gaps

| # | Gap | File(s) | Status |
|---|-----|---------|--------|
| 1 | `AppServiceProvider` has no `boot()` method — zero production guard in PHP | `AppServiceProvider.php` | ❌ Missing |
| 2 | All 4 mock flags default to `true` in `mock_services.php` — active in prod if env vars omitted | `config/mock_services.php` | ❌ Dangerous default |
| 3 | `APP_DEBUG` not checked at startup — can expose stack traces in production | `AppServiceProvider.php` | ❌ Missing |
| 4 | `OTP_DEV_PEEK_ENABLED` flag not defined anywhere — when P-1.2 creates the endpoint, there's nothing to guard it at boot | `AppServiceProvider.php`, `.env.example` | ❌ Missing |
| 5 | `Route::delete("{resource}/bulk")` registered unconditionally — bulk-delete route present in production binary | `routes/api.php:140` | ❌ No gate |
| 6 | Dev-OTP-peek endpoint (`GET /api/auth/otp/dev-peek`) will be added by P-1.2 — needs conditional registration guard before that lands | `routes/api.php` | ⚠️ Pre-register guard |
| 7 | `AuthController::requestOtp` returns OTP in response body when `APP_ENV=local` — runtime branch, not a separate endpoint (P-1.2 fixes this; P-1.5 adds boot-time enforcement) | `AuthController.php:50` | ⚠️ P-1.2 prerequisite |
| 8 | Node `index.js` has only `JWT_SECRET` guard — no check for mock flags or `NODE_ENV=production` | `src/index.js` | ❌ Missing |

---

#### Design decisions

**Throw, don't silently fix.** `mock_services.php` could return `false` when `APP_ENV=production`, silently disabling mocks. This is wrong — it hides operator misconfiguration. The guard must be LOUD: throw/exit so the operator knows immediately what is wrong and why.

**`boot()` not `register()`.** `register()` is for service bindings resolved during the container build phase. Boot-time guards that depend on environment state belong in `boot()`, which runs after all providers are registered but before requests are handled.

**Route registration, not middleware.** Dev-only routes are absent from the production binary rather than blocked at request time. A missing route can never be probed; a blocked-but-present route can still leak information in error responses.

**One flag per concern.** Each `*_MOCK` flag corresponds to one external service. `APP_DEBUG` is a separate flag for Laravel's debug mode. `OTP_DEV_PEEK_ENABLED` is a separate flag for the dev endpoint. Checking them individually gives a clear error message naming exactly which flag is the problem.

---

#### PHP — `AppServiceProvider::boot()`

Add `boot()` to the existing `AppServiceProvider`:

```php
public function boot(): void
{
    if (!$this->app->environment('production')) {
        return;
    }

    $flags = [
        'GPSHOP_MOCK'              => config('mock_services.gpshop'),
        'LOCATION_CHANGE_API_MOCK' => config('mock_services.location_change'),
        'REAL_IP_API_MOCK'         => config('mock_services.real_ip'),
        'CUSTOMER_LIFECYCLE_MOCK'  => config('mock_services.customer_lifecycle'),
        'APP_DEBUG'                => config('app.debug'),
        'OTP_DEV_PEEK_ENABLED'     => (bool) env('OTP_DEV_PEEK_ENABLED', false),
    ];

    $active = array_keys(array_filter($flags));

    if (!empty($active)) {
        throw new \RuntimeException(
            '[FATAL] Production boot aborted — dangerous flags are enabled: '
            . implode(', ', $active)
            . '. Set each to false/0 before starting in production.'
        );
    }
}
```

---

#### PHP — `routes/api.php` conditional route registration

**Bulk delete** — move the `Route::delete` line inside the existing `foreach` to a non-production guard:

```php
foreach ([...] as $resource => $controller) {
    Route::post("{$resource}/bulk",  [$controller, 'bulkStore']);
    Route::patch("{$resource}/bulk", [$controller, 'bulkUpdate']);
    if (!app()->environment('production')) {
        Route::delete("{$resource}/bulk", [$controller, 'bulkDestroy']);
    }
}
```

**Dev OTP peek** — register conditionally alongside the other public auth routes (to be wired in by P-1.2, but guard placed now):

```php
Route::post('/auth/otp/request', [AuthController::class, 'requestOtp']);
Route::post('/auth/otp/verify',  [AuthController::class, 'verifyOtp']);

if (!app()->environment('production')) {
    Route::get('/auth/otp/dev-peek', [AuthController::class, 'devPeek']);
}
```

---

#### Node — `src/index.js` production guard

Add immediately after the existing `JWT_SECRET` check:

```js
if (!process.env.JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET is not set — refusing to start');
    process.exit(1);
}

// Production mock-flag guard
if (process.env.NODE_ENV === 'production') {
    const MOCK_FLAGS = {
        GPSHOP_MOCK:               process.env.GPSHOP_MOCK,
        LOCATION_CHANGE_API_MOCK:  process.env.LOCATION_CHANGE_API_MOCK,
        REAL_IP_API_MOCK:          process.env.REAL_IP_API_MOCK,
        CUSTOMER_LIFECYCLE_MOCK:   process.env.CUSTOMER_LIFECYCLE_MOCK,
    };
    const active = Object.entries(MOCK_FLAGS)
        .filter(([, v]) => v === 'true' || v === '1')
        .map(([k]) => k);
    if (active.length > 0) {
        console.error('[FATAL] Production boot aborted — mock flags enabled:', active.join(', '));
        process.exit(1);
    }
}
```

Note: Node does not serve the OTP dev-peek or bulk-delete routes (those are PHP-only), so no route-registration guard is needed on the Node side.

---

#### `.env.example` additions (PHP)

```
# Production guards — all must be false/0 in production
GPSHOP_MOCK=true
LOCATION_CHANGE_API_MOCK=true
REAL_IP_API_MOCK=true
CUSTOMER_LIFECYCLE_MOCK=true
OTP_DEV_PEEK_ENABLED=false
```

Defaults to `true` for local dev so the app works out of the box. The boot guard prevents these defaults from surviving into a production deployment.

---

#### Files created / modified

| File | Action |
|---|---|
| `backend-php/app/Providers/AppServiceProvider.php` | Add `boot()` method with 6-flag guard |
| `backend-php/routes/api.php` | Wrap `Route::delete` bulk in `!production` check; add conditional dev-peek registration |
| `backend-php/.env.example` | Add `OTP_DEV_PEEK_ENABLED=false` entry with comment block |
| `backend-node/src/index.js` | Add mock-flag production guard block after JWT_SECRET check |
| `backend-node/.env.example` | Add `NODE_ENV=development` + mock flag entries with comment |

---

#### Pre-implementation checklist

| # | Item | Status |
|---|---|---|
| 1 | `AppServiceProvider::boot()` does not exist today | ❌ Must add |
| 2 | `mock_services.php` all 4 flags default `true` — dangerous defaults deliberately left for dev | ⚠️ Intentional; boot guard is the enforcement layer |
| 3 | `APP_DEBUG` included in the boot guard flag list | ❌ Must include in `boot()` |
| 4 | `OTP_DEV_PEEK_ENABLED` flag absent from `.env.example` | ❌ Must add |
| 5 | `Route::delete` bulk registration is unconditional today (`api.php:140`) | ❌ Must wrap in `!production` check |
| 6 | Dev-peek route guard placeholder in `api.php` (P-1.2 will add the handler) | ❌ Must pre-register conditional block |
| 7 | Node `index.js` mock-flag guard absent | ❌ Must add after JWT_SECRET check |
| 8 | P-1.4 test suite includes boot-guard case: `APP_ENV=production + GPSHOP_MOCK=true → RuntimeException` | ❌ Test to be written in P-1.4 |

---

**Exit criteria:**
- `APP_ENV=production php artisan serve` with `GPSHOP_MOCK=true` in env → process exits immediately with `[FATAL] Production boot aborted — dangerous flags are enabled: GPSHOP_MOCK`
- Same test with `APP_DEBUG=true` → exits with `APP_DEBUG` in the flag list
- All 6 flags individually trigger the guard when set in production
- `APP_ENV=local` with any mock flag true → boots normally (guard skipped)
- `APP_ENV=production` with all 6 flags false/0 → boots normally
- `GET /api/auth/otp/dev-peek` returns 404 when `APP_ENV=production` (route not registered)
- `DELETE /api/network-zones/bulk` returns 404 when `APP_ENV=production` (route not registered)
- Node: `NODE_ENV=production` with `GPSHOP_MOCK=true` → process exits 1 with `[FATAL]` message
- Node: `NODE_ENV=production` with all mock flags unset/false → boots normally

### P-1.6 — Drupal removal

**Decision:** Kill Drupal from the architecture. The maintenance + CVE-patching cost is not justified for "configurable texts and reporting views."
- Configurable texts → `system_config` table (already in schema).
- Reporting → Metabase (or Superset) behind SSO + read replica, deferred to post-launch.

---

#### Verified state

| File / Artifact | Drupal reference type | Status |
|---|---|---|
| `CLAUDE.md` | "Drupal removed from architecture — see P-1.6" | ✅ Already updated |
| `docs/SupremeFlex_Consolidated_Requirements.md` | "Drupal removed from architecture — see P-1.6" | ✅ Already updated |
| `docs/architecture.md` | ADR-007 documents removal decision | ✅ Already updated |
| `docs/developmentPlan.md` | Table row + sequencing note for P-1.6 | ✅ Already updated |
| `README.md` | Architecture diagram lists Drupal as active; ports table shows `:8080` | ❌ Still active — must fix |
| `/drupal/` directory | Empty directory tracked in git | ❌ Still present — must delete |
| `backend-php/`, `backend-node/`, `frontend/` | No code references `:8080` or any Drupal API | ✅ Verified clean |

---

#### Remaining actions (both doc-only)

**1. Update `README.md`**

Remove Drupal from the ASCII architecture diagram:
```
Browser (Next.js :3000)
    │  axios
    ├──► PHP/Laravel API (:8000)  — CRUD, auth, campaigns, customers
    └──► Node.js API (:8001)      — Field ops, stock transfers, WS dashboard
              │
              ▼
         MySQL :3306
              │
              ▼
         Redis :6379   — sessions, cache, queue, idempotency keys
```

Remove Drupal row from the ports table. Ports table becomes:

| Service | Port |
|---|---|
| Next.js frontend | 3000 |
| PHP/Laravel API | 8000 |
| Node.js API + WebSocket | 8001 |
| MySQL | 3306 |
| Redis | 6379 |

**2. Delete `/drupal/` directory**

```bash
git rm -r drupal/
```

Empty directory but tracked in git — remove it so there is no stub that a future developer mistakes for a real service.

---

#### Exit criteria
- `grep -r "Drupal\|:8080" README.md` → zero matches
- `/drupal/` directory absent from the repository (`git ls-files drupal/` → empty)
- All other plan/requirements docs already updated (verified above)
- No active Drupal reference anywhere in `backend-php/`, `backend-node/`, or `frontend/`

### P-1.7 — DB topology + Redis + queue

---

#### Verified state — current gaps

| # | Gap | Status |
|---|-----|--------|
| 1 | No `config/database.php` — no read/write split, no replica connections | ❌ Missing |
| 2 | No `config/queue.php` or `config/horizon.php` | ❌ Missing |
| 3 | No `app/Console/` — the three cron jobs (`AutoCancelAddonOrders`, `AutoUnassignRealIp`, SMS retry) don't exist yet | ⚠️ Created in BLOCK E/F — must be Horizon jobs from day one |
| 4 | No partition migration for `audit_logs`, `system_audit_logs`, `transaction_ledger`, `otp_codes` | ❌ Missing |
| 5 | No Redis config in PHP beyond what P-1.2/P-1.3 add (`predis/predis`) | ⚠️ Covered by P-1.2 dep; this item adds the `config/database.php` Redis connection |
| 6 | No ProxySQL, no XtraBackup schedule, no binlog config (infra-only — out of repo) | ❌ Infra decisions documented here |
| 7 | Node `src/services/redis.js` created in P-1.3 — but `REDIS_URL` env var not yet confirmed in both `.env.example` files | ⚠️ P-1.3 covers this |

---

#### Component 1 — MySQL topology (infra-side, out of repo)

**Target:**
- 1 primary (writes) + 2 read replicas (reads), same availability zone
- ProxySQL v2 in front: routes `SELECT` to replicas via round-robin, all writes to primary
- Binary log (`binlog_format=ROW`) enabled on primary; replicas configured with `read_only=1`
- Nightly `XtraBackup` full + continuous binlog streaming → object storage
- **RTO 15 min** (restore from last XtraBackup + replay binlogs); **RPO 5 min** (binlog flush interval)
- Documented restore drill: quarterly test of full restore to a throwaway instance

**ProxySQL routing rule (pseudoconfig):**
```
mysql_query_rules:
  - rule_id: 1
    match_pattern: "^SELECT"
    destination_hostgroup: 20   # replica group
  - rule_id: 2
    match_pattern: "."
    destination_hostgroup: 10   # primary group
```

---

#### Component 2 — MySQL app-side read/write split

**`config/database.php`** — add replica connections inside the `mysql` driver block:

```php
'mysql' => [
    'read' => [
        'host' => [
            env('DB_REPLICA_1_HOST', '127.0.0.1'),
            env('DB_REPLICA_2_HOST', '127.0.0.1'),
        ],
    ],
    'write' => [
        'host' => env('DB_HOST', '127.0.0.1'),
    ],
    'sticky' => true,   // writes within a request are immediately readable on primary
    'driver'   => 'mysql',
    'database' => env('DB_DATABASE', 'supremeflex'),
    'username' => env('DB_USERNAME', 'root'),
    'password' => env('DB_PASSWORD', ''),
    'charset'  => 'utf8mb4',
    'collation'=> 'utf8mb4_unicode_ci',
],
```

`sticky => true` prevents read-your-own-write anomalies: after a write in the same request, subsequent reads on the same connection go to primary. This is critical for flows like "create order → immediately show order detail."

**`.env.example` additions:**
```
DB_REPLICA_1_HOST=127.0.0.1
DB_REPLICA_2_HOST=127.0.0.1
```

In local dev both replicas point to the primary — no replica setup needed locally. In production the hostnames differ.

---

#### Component 3 — Redis configuration

Redis serves five distinct namespaces. All use the same connection (`REDIS_URL`) but different key prefixes:

| Namespace prefix | Owner | TTL | Set by |
|---|---|---|---|
| `jwt:revoked:{jti}` | P-1.2 auth | 900 s (access token lifetime) | `AuthController::logout` |
| `jwt:refresh:{token}` | P-1.2 auth | 7 days | `AuthController::verifyOtp` |
| `rbac:{userId}:{perm}` | P-1.2 RBAC | 300 s | `PermissionMiddleware` |
| `idempotency:{sha256}` | P-1.3 | 86 400 s | `IdempotencyMiddleware` |
| `cache:*` | P-1.7 hot data | varies | see below |

**Hot-data cache keys (P-1.7 specific):**

| Key | Content | TTL | Invalidated by |
|---|---|---|---|
| `cache:geo:network_zones` | All network zones (small table) | 3 600 s | Any `POST/PATCH/DELETE /api/network-zones` |
| `cache:geo:districts:{zone_id}` | Districts for a zone | 3 600 s | Any district mutation |
| `cache:products:catalog` | Active product list + current price versions | 600 s | Any `POST /api/price-versions` |
| `cache:customer360:{customerId}` | Customer + anchors + active services (flattened) | 120 s | Any order mutation for that customer |
| `cache:rbac:*` | Already covered by P-1.2 RBAC namespace | 300 s | — |

Cache-aside pattern for all hot-data keys:
```
1. $cached = Redis::get($cacheKey)
2. if ($cached) return json_decode($cached, true)
3. $data = DB::...query...
4. Redis::setex($cacheKey, $ttl, json_encode($data))
5. return $data
```

Invalidation: mutating endpoints call `Redis::del($cacheKey)` after committing the DB write — simple key-level delete, no cache stampede protection needed at this scale.

---

#### Component 4 — Laravel Horizon (queue)

**Why Horizon over raw `php artisan queue:work`:** Horizon provides per-job metrics (throughput, runtime, failure rate), supervisor-style worker management, automatic retry with configurable backoff, a web dashboard, and a Dead Letter Queue for permanently failed jobs — all critical for production visibility at 50k orders/day.

**Replaces these Artisan commands** (stubbed in BLOCK E/F — must be Jobs, never Artisan commands):

| Job class | Replaces | Trigger | Frequency |
|---|---|---|---|
| `App\Jobs\AutoCancelAddonOrders` | `AutoCancelAddonOrders` Artisan command | Horizon scheduler | Every 5 min |
| `App\Jobs\AutoUnassignRealIp` | `AutoUnassignRealIp` Artisan command | Horizon scheduler | Every 10 min |
| `App\Jobs\SmsRetry` | Ad-hoc SMS retry loop | Dispatched on failure by `SmsService` | On failure, max 3 retries |

**`config/horizon.php`** (key sections):
```php
'environments' => [
    'production' => [
        'supervisor-1' => [
            'connection' => 'redis',
            'queue'      => ['default', 'high', 'low'],
            'balance'    => 'auto',
            'minProcesses' => 2,
            'maxProcesses' => 10,
            'tries'      => 3,
            'timeout'    => 60,
        ],
    ],
    'local' => [
        'supervisor-1' => [
            'connection' => 'redis',
            'queue'      => ['default'],
            'balance'    => 'simple',
            'processes'  => 2,
            'tries'      => 1,
        ],
    ],
],
```

**Queue priority:** `high` → order confirmations, OTP dispatch; `default` → auto-cancel, auto-unassign; `low` → audit log writes, SMS retry.

**Dead Letter Queue:** failed jobs after `tries` exhausted are stored in `failed_jobs` table (standard Laravel) and surfaced in Horizon dashboard. Ops team monitors and manually requeues or escalates.

---

#### Component 5 — Table partitioning (`013_partitioning.sql`)

Monthly `RANGE` partitions on `created_at` for the four high-volume tables. Partitioning requires the partition column to be part of (or the entire) primary key — a constraint that interacts with P-1.1's `BINARY(16)` UUIDv7 PKs.

**Partition key design:** Add `created_month DATE GENERATED ALWAYS AS (DATE_FORMAT(created_at, '%Y-%m-01')) STORED` to each table, then partition on `TO_DAYS(created_month)`. Include `created_month` in the PK to satisfy MySQL's partitioning constraint.

**Example for `audit_logs`:**
```sql
ALTER TABLE audit_logs
  ADD COLUMN created_month DATE GENERATED ALWAYS AS
    (DATE_FORMAT(created_at, '%Y-%m-01')) STORED,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (id, created_month)
  PARTITION BY RANGE (TO_DAYS(created_month)) (
    PARTITION p2026_01 VALUES LESS THAN (TO_DAYS('2026-02-01')),
    PARTITION p2026_02 VALUES LESS THAN (TO_DAYS('2026-03-01')),
    -- ... auto-extend script adds future partitions monthly
    PARTITION p_future VALUES LESS THAN MAXVALUE
  );
```

Same pattern applies to `system_audit_logs`, `transaction_ledger`, `otp_codes`.

**Retention policy (applied via monthly cron):**

| Table | Retain | Drop partition older than |
|---|---|---|
| `audit_logs` | 2 years | 24 months |
| `system_audit_logs` | 2 years | 24 months |
| `transaction_ledger` | 7 years (regulatory) | 84 months |
| `otp_codes` | 30 days | 1 month |

Partition drop is instantaneous (`ALTER TABLE ... DROP PARTITION`) — no row-by-row `DELETE`.

**Constraint with P-1.1:** The generated `created_month` column + PK change in `013_partitioning.sql` must run *after* P-1.1's `011_pk_strategy.sql` Phase D (final PK cutover). Migration order: 011 → 012 → 013.

---

#### Component 6 — `config/queue.php` and `config/cache.php`

**`config/queue.php`** — Redis as the queue driver:

```php
return [
    'default' => env('QUEUE_CONNECTION', 'redis'),

    'connections' => [
        'redis' => [
            'driver'       => 'redis',
            'connection'   => 'default',
            'queue'        => env('REDIS_QUEUE', 'default'),
            'retry_after'  => 90,       // seconds — longer than the longest expected job
            'block_for'    => null,
        ],
        'sync' => ['driver' => 'sync'],  // kept for testing (P-1.4 feature tests use QUEUE_CONNECTION=sync)
    ],

    'failed' => [
        'driver'   => env('QUEUE_FAILED_DRIVER', 'database-uuids'),
        'database' => env('DB_CONNECTION', 'mysql'),
        'table'    => 'failed_jobs',
    ],
];
```

Note: `retry_after` must exceed the longest job timeout set in `config/horizon.php` (currently 60 s). Set to 90 s to give headroom. If `retry_after` is shorter than a job's actual runtime, Laravel will dispatch a duplicate.

`QUEUE_CONNECTION=sync` in test environments (`.env.testing`) ensures jobs run inline during feature tests — no worker process needed.

**`config/cache.php`** — Redis as the default cache store (required for hot-data caching in Component 3):

```php
return [
    'default' => env('CACHE_DRIVER', 'redis'),

    'stores' => [
        'redis' => [
            'driver'     => 'redis',
            'connection' => 'cache',   // separate Redis connection from queue (see database.php)
            'lock_connection' => 'default',
        ],
        'array' => ['driver' => 'array', 'serialize' => false],  // for testing
    ],

    'prefix' => env('CACHE_PREFIX', 'supremeflex_cache'),
];
```

Add a dedicated `cache` Redis connection in `config/database.php` to avoid queue/cache key collisions:

```php
'redis' => [
    'client'  => env('REDIS_CLIENT', 'predis'),
    'default' => ['url' => env('REDIS_URL', 'redis://127.0.0.1:6379'), 'database' => 0],
    'cache'   => ['url' => env('REDIS_URL', 'redis://127.0.0.1:6379'), 'database' => 1],
],
```

Queue uses DB 0; cache uses DB 1. Same Redis instance, different logical databases — clean separation without a second server.

**`.env.example` additions:**
```
CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
REDIS_QUEUE=default
```

---

#### Component 7 — Laravel Scheduler (dispatching Horizon jobs)

Horizon runs the workers, but something must *dispatch* the scheduled jobs. That is Laravel's built-in scheduler (`php artisan schedule:run`), invoked every minute by a system cron. **One system crontab entry** is the only external dependency:

```
* * * * * cd /var/www/backend-php && php artisan schedule:run >> /dev/null 2>&1
```

**`routes/console.php`** (Laravel 11 schedule definition — replaces `app/Console/Kernel.php`):

```php
use Illuminate\Support\Facades\Schedule;
use App\Jobs\AutoCancelAddonOrders;
use App\Jobs\AutoUnassignRealIp;
use App\Jobs\PartitionMaintenance;

Schedule::job(new AutoCancelAddonOrders, 'default')->everyFiveMinutes()
    ->withoutOverlapping()
    ->onOneServer();          // prevents duplicate dispatch on multi-server deployments

Schedule::job(new AutoUnassignRealIp, 'default')->everyTenMinutes()
    ->withoutOverlapping()
    ->onOneServer();

Schedule::job(new PartitionMaintenance, 'low')->monthlyOn(1, '02:00')
    ->onOneServer();          // runs on the 1st of every month at 02:00
```

`onOneServer()` requires a Redis-backed cache (Component 6) to hold the distributed lock — it uses `Cache::lock()` internally. This is why `CACHE_DRIVER=redis` is mandatory in production, not optional.

`withoutOverlapping()` prevents a second dispatch if the previous run is still executing — essential for `AutoCancelAddonOrders` which scans the whole orders table and could take >5 min under load.

**`SmsRetry` is not scheduled** — it is dispatched imperatively by `SmsService` on failure:
```php
// inside SmsService::send() catch block
dispatch(new SmsRetry($msisdn, $message))->onQueue('low')->delay(now()->addMinutes(2));
```

---

#### Component 8 — Partition maintenance job (`PartitionMaintenance`)

The partition migration (`013_partitioning.sql`) pre-creates partitions through the end of the launch year. After that, new months need partitions added and old ones pruned. This runs as a Horizon Job dispatched monthly by the scheduler.

**`App\Jobs\PartitionMaintenance` — logic:**

```
handle():
  1. $nextMonth = now()->addMonth()->startOfMonth()
  2. $partitionName = 'p' . $nextMonth->format('Y_m')
  3. $upperBound = "TO_DAYS('" . $nextMonth->addMonth()->format('Y-m-01') . "')"

  // Add next month's partition (idempotent — fails silently if already exists)
  4. foreach (['audit_logs', 'system_audit_logs', 'transaction_ledger', 'otp_codes'] as $table):
       DB::statement("ALTER TABLE {$table}
         REORGANIZE PARTITION p_future INTO (
           PARTITION {$partitionName} VALUES LESS THAN ({$upperBound}),
           PARTITION p_future VALUES LESS THAN MAXVALUE
         )")

  // Drop expired partitions according to retention policy
  5. $retentionMonths = ['audit_logs' => 24, 'system_audit_logs' => 24,
                          'transaction_ledger' => 84, 'otp_codes' => 1]
  6. foreach $retentionMonths as $table => $months:
       $dropBefore = now()->subMonths($months)->startOfMonth()
       $dropName   = 'p' . $dropBefore->format('Y_m')
       // Verify partition exists before dropping
       $exists = DB::selectOne("SELECT PARTITION_NAME FROM information_schema.PARTITIONS
                                WHERE TABLE_NAME = ? AND PARTITION_NAME = ?", [$table, $dropName])
       if ($exists): DB::statement("ALTER TABLE {$table} DROP PARTITION {$dropName}")
```

`REORGANIZE PARTITION` is used instead of `ADD PARTITION` because the `p_future` catch-all must always exist. Reorganizing it splits it into the new named partition + a new `p_future`.

---

#### Files created / modified

| File | Action | Phase |
|---|---|---|
| `backend-php/config/database.php` | New — read/write split + replica hosts + Redis DB-0/DB-1 split | P-1.7 |
| `backend-php/config/queue.php` | New — Redis queue driver, `retry_after=90`, sync for tests | P-1.7 |
| `backend-php/config/cache.php` | New — Redis cache store (DB 1), array store for tests | P-1.7 |
| `backend-php/config/horizon.php` | New — worker supervisor config | P-1.7 |
| `backend-php/routes/console.php` | New — scheduler: AutoCancelAddonOrders (5 min), AutoUnassignRealIp (10 min), PartitionMaintenance (monthly) | P-1.7 |
| `backend-php/.env.example` | Add replica hosts, `CACHE_DRIVER=redis`, `QUEUE_CONNECTION=redis`, `REDIS_QUEUE=default` | P-1.7 |
| `database/migrations/013_partitioning.sql` | New — partitions on 4 tables; must run after 011 | P-1.7 |
| `app/Jobs/PartitionMaintenance.php` | New — monthly add-next + drop-expired partition job | P-1.7 |
| `app/Jobs/AutoCancelAddonOrders.php` | New stub — dispatched every 5 min by scheduler | BLOCK E5 |
| `app/Jobs/AutoUnassignRealIp.php` | New stub — dispatched every 10 min by scheduler | BLOCK E9 |
| `app/Jobs/SmsRetry.php` | New stub — dispatched imperatively by `SmsService` on failure | BLOCK F1 |

**Infra-only (out of repo, documented decisions):** ProxySQL config, XtraBackup cron, binlog settings (`binlog_format=ROW`, `sync_binlog=1`), Redis Sentinel (if HA needed), Horizon dashboard access control, system `* * * * * php artisan schedule:run` crontab entry.

---

#### Pre-implementation checklist

| # | Item | Status |
|---|---|---|
| 1 | `config/database.php` with read/write split + Redis DB-0/DB-1 split | ❌ Must create |
| 2 | `config/queue.php` with `retry_after=90` and sync fallback for tests | ❌ Must create |
| 3 | `config/cache.php` pointing to Redis DB-1 | ❌ Must create |
| 4 | `config/horizon.php` with production + local supervisor config | ❌ Must create |
| 5 | `routes/console.php` scheduler with 3 job entries + `onOneServer()` | ❌ Must create |
| 6 | `laravel/horizon` in `composer.json` | ❌ Blocked until `composer.json` created (P-1.1) |
| 7 | `DB_REPLICA_1_HOST`, `DB_REPLICA_2_HOST`, `CACHE_DRIVER`, `QUEUE_CONNECTION` in `.env.example` | ❌ Must add |
| 8 | `013_partitioning.sql` authored and sequenced after `011_pk_strategy.sql` Phase D | ❌ Must write |
| 9 | `PartitionMaintenance` job uses `REORGANIZE PARTITION` (not `ADD PARTITION`) to preserve `p_future` | ❌ Must implement correctly |
| 10 | `QUEUE_CONNECTION=sync` in `.env.testing` so feature tests run jobs inline | ❌ Must set |
| 11 | `sticky => true` on DB write connection (prevents read-your-write anomaly) | ❌ Must set in `config/database.php` |
| 12 | Hot-data cache-aside pattern in `CustomerController::view360` | ❌ Implemented in BLOCK C/D |
| 13 | System crontab `* * * * * php artisan schedule:run` entry documented in ops runbook | ❌ Infra gate |
| 14 | Partition pruning verified on a 10M-row test table before production traffic | ❌ Pre-launch gate |

---

**Exit criteria:**
- `EXPLAIN SELECT ... FROM audit_logs WHERE created_at > '2026-01-01'` → `partitions: p2026_01` only (partition pruning active)
- `SHOW VARIABLES LIKE 'read_only'` on a replica → `ON`
- Laravel slow-query log shows replica hostname in read queries (not primary)
- `php artisan horizon` starts without error; Horizon dashboard reachable at `/horizon`
- Scheduled job `AutoCancelAddonOrders` appears in Horizon metrics after 5 min of uptime
- `PartitionMaintenance` dispatched on the 1st of the month; next month's partition appears in `information_schema.PARTITIONS`
- `Redis::get('cache:customer360:{id}')` populated after first Customer 360 load; hit-rate > 80% under load
- Queue DB (Redis DB 0) and cache DB (Redis DB 1) are separate — `Redis::connection('cache')->dbSize()` does not include queue keys
- `retry_after=90` confirmed: a job that sleeps 91 s is re-dispatched after 90 s (verify in test environment)
- `ALTER TABLE audit_logs DROP PARTITION p_oldest` on a 10M-row table completes in < 1 s

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
