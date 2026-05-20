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
