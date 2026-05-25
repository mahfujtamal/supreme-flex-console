# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# SupremeFlex

Internal CRM and operations platform for the GPFI (Grameenphone FWA) product line. Serves both **B2C** and **B2B** customers. A single customer may own **multiple GPFI connections** — every order is scoped to a specific connection (`anchor_id` + `active_service_id`), not just a customer.  
**GitHub:** `https://github.com/mahfujtamal/supreme-flex-console`

---

## Project Status (2026-05-25)

**All blocks complete and merged to `main`.** BLOCK 0 (Phase -1 foundation hardening) + Blocks A–H are fully implemented and DoD-verified locally. Next step: IT team staging deployment to wire real API endpoints (replacing mocks), followed by migration strategy from the current platform.

Active development focus: admin and customer-facing pages, and ensuring everything works end-to-end once staging is live.

---

## Architecture

```
Browser (Next.js :3000)
    │  axios (phpApi / nodeApi from lib/api.ts)
    ├──► PHP/Laravel :8000  — auth, CRUD, campaigns, invoicing, master data
    └──► Node.js :8001      — field execution, stock transfers, REST + WS dashboard
              │
              ▼
         MySQL :3306  — 1 primary + 2 read replicas (Phase -1 / P-1.7)
              │
              ▼
         Redis :6379  — sessions, idempotency keys, JWT revocation, queue, hot-data cache
```

Reporting tool (Metabase or Superset behind SSO + read replica) deferred to post-launch. Configurable texts live in the `system_config` table. **Drupal removed from architecture** — see Phase -1 / P-1.6.

WebSocket endpoint: `ws://localhost:8001/ws/dashboard` — server-push only, 10-second intervals. No client messages are handled. JWT authentication via subprotocol on upgrade; unauthenticated connections are rejected (close code 1008).

**Authentication:** OTP-based login. User enters mobile number → PHP issues 6-digit OTP → user submits OTP → JWT issued as httpOnly + Secure + SameSite=Strict cookie (access 15 min, refresh 7 days). Dev-only peek endpoint `/api/auth/otp/dev-peek` registered only when `APP_ENV != production`. No email/password login.

JWT delivered via `sf_access_token` + `sf_refresh_token` httpOnly cookies. Redis-backed revocation list keyed by `jti`. Both `phpApi` and `nodeApi` instances in `frontend/lib/api.ts` use cookie credentials automatically. `AuthContext` (`contexts/AuthContext.tsx`) manages auth state; unauthenticated users are redirected to `/login` by the `(app)` route group layout.

---

## Target Scale (5-year horizon)

- GPFI subscribers under management: **3–10M**
- Concurrent internal users (CS reps, KAMs, DH managers, field agents): up to **20k peak**
- Orders/day at peak: **~50k**
- `transaction_ledger` rows: low hundreds of millions over 5 years

Phase -1 (see `docs/developmentPlan.md` BLOCK 0) addresses the foundational decisions that this scale requires: PK strategy, auth hardening, idempotency, test harness, prod guards, Drupal removal, and DB topology (replicas + Redis + queue).

---

## Commands

```bash
# PHP backend
cd backend-php && php artisan serve --port=8000

# Node backend (uses ES modules; --watch replaces nodemon)
cd backend-node && npm run dev        # port 8001

# Frontend
cd frontend && npm run dev            # port 3000
cd frontend && npm run lint           # ESLint via next lint

# Database (first time only — run in order)
mysql -u root -p supremeflex < database/migrations/001_create_all_tables.sql
mysql -u root -p supremeflex < database/migrations/002_create_triggers.sql
mysql -u root -p supremeflex < database/migrations/003_create_stored_procedures.sql
mysql -u root -p supremeflex < database/migrations/004_otp_auth.sql
mysql -u root -p supremeflex < database/migrations/005_uuid7_binary16_migration.sql
mysql -u root -p supremeflex < database/migrations/008_remove_hub_manager.sql
mysql -u root -p supremeflex < database/migrations/009_gpweb3730_new_tables.sql
mysql -u root -p supremeflex < database/migrations/010_gpweb3730_triggers.sql
mysql -u root -p supremeflex < database/migrations/011_add_indexes.sql
mysql -u root -p supremeflex < database/migrations/012_delivery_routing.sql
```

**First-time env setup:**
```bash
# PHP
cd backend-php && cp .env.example .env && php artisan key:generate

# Node
cd backend-node && cp .env.example .env

# Frontend
cd frontend && cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_PHP=http://localhost:8000/api
# Set NEXT_PUBLIC_API_NODE=http://localhost:8001/api
# Mock API flags (set true to use mock implementations)
# GPSHOP_MOCK=true
# LOCATION_CHANGE_API_MOCK=true
# REAL_IP_API_MOCK=true
# CUSTOMER_LIFECYCLE_MOCK=true
```

**Test suite:** PHPUnit via `./vendor/bin/phpunit` (43 tests, SQLite in-memory) + Vitest/supertest via `npm test` (55 tests) + GitHub Actions CI on every push to `main`.

---

## Frontend Stack

- **React Query** (`@tanstack/react-query`) — all server state; no raw `useEffect` for data fetching
- **Zod + react-hook-form** — all form validation
- **Radix UI** primitives + **Tailwind CSS** — UI components
- **Recharts** — dashboard charts
- **sonner** — toast notifications

---

## Absolute Rules (Never Break)

1. PHP (:8000) owns all CRUD, auth, campaigns, invoicing. Node (:8001) owns field execution, stock transfers, WS dashboard. Never cross-assign.
2. All PKs use **UUIDv7 stored as `BINARY(16)`**. Generate in application code (`Ramsey\Uuid::uuid7()` in PHP, `uuidv7` npm package in Node) — never `DEFAULT (UUID())`, never auto-increment. (Phase -1 / P-1.1 migrates existing `CHAR(36)` tables from migrations 001–004.)
3. Never hard-delete master data — use `status ENUM('ACTIVE','INACTIVE')`.
4. Price changes go through `product_price_versions` — never overwrite the existing row. Add a new version.
5. Campaign targeting lives in `campaign_targeting_rules` — never embed geo/channel logic in application code.
6. All JWT auth via `auth.jwt` middleware on PHP. Node does not have its own auth — it trusts the same token. Login is OTP-based (`POST /api/auth/otp/request` + `POST /api/auth/otp/verify`). No email/password login exists.
7. `referral_reward_ledger` status transitions are owned by the stored procedure `check_and_release_referral_reward` — never update status directly from application code.
8. Bulk operations must write to `audit_logs` (action_type = `BULK_IMPORT`).
9. Node DB queries go through `services/db.js` only — never inline `mysql2` in route handlers.
10. Node uses ES modules (`import`/`export`). Do not use `require()`.
11. B2B orders are initiated and delivered by KAM. B2C default delivery agent is DH; channel/sub-channel may override with own delivery (default or per-order). Sub-channel routing uses `delivery_ownership ENUM('FOLLOW_CHANNEL','SELF_DELIVERY','DH_DELIVERY')` — do NOT add a separate `default_delivery_mode` column to sub_channels. Channel routing uses `default_delivery_mode ENUM('DH','OWN')`. Per-order overrides stored in `order_delivery_overrides`.
12. Every order must reference a specific connection via `anchor_id` + `active_service_id` — never attach an order to a customer alone. Both are `NOT NULL` FK columns on `orders` and `transaction_ledger` (migration 006). On `onetime_invoices`, child rows carry both fields; parent summary rows (`is_summary = 1`) leave them NULL. `InvoiceController.$fillable` must include `anchor_id`, `active_service_id`, `is_summary`.
13. Hub Managers do not exist in this system. Each delivery entity (DH, Channel, Sub-Channel) has a manager user linked via `manager_admin_id CHAR(36) FK → user_account(id)` (NOT `admin_users` — must reference `user_account` so Node can resolve `WHERE manager_admin_id = req.user.sub`). Field Agents report directly to their DH. KAMs are independent. JWT payload includes `staff_type` so Node endpoints can determine manager entity type without a DB lookup.
14. Bulk operations (insert/update) are available on all admin entities. Bulk delete is dev-mode only (`isDevMode = true` + `X-Dev-Mode: true` header) AND the bulk-delete route is registered only when `APP_ENV != production`. All bulk ops write to `audit_logs`.
15. **OTP storage:** SHA-256 + per-row salt — never plaintext. **Rate limit OTP request:** 5/hour/msisdn + 20/day/IP. **Lockout OTP verify:** 5 failed attempts within 15 min. **Dev-mode OTP response** is a separate `/api/auth/otp/dev-peek` endpoint registered only when `APP_ENV != production` — never a runtime branch inside `verifyOtp`. (Phase -1 / P-1.2)
16. **JWT transport:** httpOnly + Secure + SameSite=Strict cookies. **Access token TTL** 15 min; **refresh token TTL** 7 days. **Revocation list** in Redis keyed by `jti`. **WebSocket** authenticates via JWT in subprotocol; unauthenticated upgrades are rejected. (Phase -1 / P-1.2)
17. **RBAC** enforced on every protected route via a `PermissionMiddleware` that invokes the `has_role(user_id, role_name)` stored procedure. Permission result cached per-user in Redis for 300s. `auth.jwt` alone is never sufficient. (Phase -1 / P-1.2)
18. **All mutating endpoints** (POST/PATCH/DELETE on `orders`, `addon_order_history`, `cpe_order_history`, `ott_order_history`, `real_ip_assignments`, `stock_transfers`, `referral_redemptions`) require an `Idempotency-Key` header. Server caches `(key, request_hash, response)` in Redis for 24 h. Duplicate key returns the cached response without re-executing. (Phase -1 / P-1.3)
19. **Boot-time production guard:** `AppServiceProvider::boot()` and Node `index.js` startup throw immediately when `APP_ENV=production` if any of `GPSHOP_MOCK / LOCATION_CHANGE_API_MOCK / REAL_IP_API_MOCK / CUSTOMER_LIFECYCLE_MOCK / APP_DEBUG / OTP dev-peek flag` is `true`. Misconfiguration must be impossible, not just unlikely. (Phase -1 / P-1.5)

---

## Reference Files (load the one matching your task)

| File | When to read |
|------|-------------|
| `.claude/DB.md` | Full table schema, domain map, key relationships, stored procedures |
| `.claude/API.md` | All PHP routes + Node routes + WebSocket spec |
| `.claude/FRONTEND.md` | Next.js pages, layout components, api.ts abstraction |
| `.claude/CAMPAIGN.md` | Campaign engine: targeting rules, product rules, coupons, referral lifecycle |
| `.claude/INVENTORY.md` | Inventory master, stock transfer chain, bulk-inward flow |
| `.claude/PATTERNS.md` | Coding conventions, commit format, error handling, query patterns |
| `docs/SupremeFlex_Consolidated_Requirements.md` | Full platform requirements (B2C/B2B, delivery routing, GPWEB-3730, Section 11 = Security & Scale Targets) |
| `docs/architecture.md` | System architecture — Mermaid diagrams (context, container, component, sequence, deployment, queue, trust boundaries), security model, scale targets, ADR log |
| `docs/plan.md` | GPWEB-3730 implementation plan — **Phase -1 (Foundation Hardening) must precede Phase 0** |
| `docs/developmentPlan.md` | Step-by-step development roadmap — **BLOCK 0 (Phase -1) must complete before BLOCK A**; Blocks A–H follow |
| `docs/phase-1-dod.md` | Phase -1 Definition of Done — per-item checklists (P-1.1–P-1.7) + end-of-phase verification |

**Load only the file(s) relevant to the current task. Do not load all at once.**

---

## Wiki (Karpathy pattern)

Distilled knowledge base at `/Users/mahfujrahman/ClaudeCowork/work-wiki/`.  
Read `wiki/index.md` for the full map. Key pages for this project:

| Wiki Page | When to read |
|---|---|
| `wiki/projects/supreme-flex/overview.md` | Architecture, module list, design patterns |
| `wiki/projects/supreme-flex/db-schema.md` | Deep schema reference with all relationships |
| `wiki/projects/supreme-flex/api-routes.md` | Full route inventory |
| `wiki/projects/supreme-flex/frontend-pages.md` | Page map, backend ownership per page |
| `wiki/products/gpfi.md` | GPFI product context — what this CRM serves |
| `wiki/products/gpfi/customer-base-timeline.md` | ~46,884 activated orders, growth data, 54-col schema |

**Rule:** Never query `raw/` directly. Wiki pages are the source of truth for distilled knowledge.
