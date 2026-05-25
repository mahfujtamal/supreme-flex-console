# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# SupremeFlex

Internal CRM and operations platform for the GPFI (Grameenphone FWA) product line. Serves both **B2C** and **B2B** customers. A single customer may own **multiple GPFI connections** — every order is scoped to a specific connection (`anchor_id` + `active_service_id`), not just a customer.  
**GitHub:** `https://github.com/mahfujtamal/supreme-flex-console`

---

## Project Status (2026-05-25)

**All blocks complete and merged to `main`.** BLOCK 0 (Phase -1) + Blocks A–H fully implemented and DoD-verified locally. Next: IT team staging deployment to wire real API endpoints (replacing mocks), then migration strategy from the current platform.

---

## Architecture

```
Browser (Next.js :3000)
    │  axios (phpApi / nodeApi from lib/api.ts)
    ├──► PHP/Laravel :8000  — auth, CRUD, campaigns, invoicing, master data
    └──► Node.js :8001      — field execution, stock transfers, REST + WS dashboard
              │
              ▼
         MySQL :3306  — 1 primary + 2 read replicas
              │
              ▼
         Redis :6379  — sessions, idempotency keys, JWT revocation, queue, hot-data cache
```

- **Auth:** OTP → JWT via httpOnly+Secure+SameSite=Strict cookies (access 15 min, refresh 7 days). Redis revocation by `jti`. No email/password.
- **WebSocket:** `ws://localhost:8001/ws/dashboard` — server-push only, JWT via subprotocol, unauthenticated connections rejected (close 1008).
- **Reporting:** Metabase/Superset behind SSO + read replica — deferred to post-launch.

---

## Commands

```bash
# Servers
cd backend-php  && php artisan serve --port=8000
cd backend-node && npm run dev          # port 8001
cd frontend     && npm run dev          # port 3000

# Tests
cd backend-php  && ./vendor/bin/phpunit # 43 tests, SQLite in-memory
cd backend-node && npm test             # 55 tests (Vitest + supertest)

# Database — first time, run in order 001 → 012
mysql -u root -p supremeflex < database/migrations/001_create_all_tables.sql
# ... through 012_delivery_routing.sql

# Env setup
cd backend-php  && cp .env.example .env && php artisan key:generate
cd backend-node && cp .env.example .env
cd frontend     && cp .env.local.example .env.local
```

---

## Frontend Stack

- **React Query** (`@tanstack/react-query`) — all server state; no raw `useEffect` for data fetching
- **Zod + react-hook-form** — all form validation
- **Radix UI** + **Tailwind CSS** — UI components
- **Recharts** — dashboard charts
- **sonner** — toast notifications

---

## Absolute Rules (Never Break)

1. PHP (:8000) owns auth, CRUD, campaigns, invoicing. Node (:8001) owns field execution, stock transfers, WS dashboard. Never cross-assign.
2. All PKs are **UUIDv7 stored as `BINARY(16)`**. Generate in app code (`Ramsey\Uuid::uuid7()` PHP, `uuidv7` npm Node) — never `DEFAULT (UUID())`, never auto-increment.
3. Never hard-delete master data — use `status ENUM('ACTIVE','INACTIVE')`.
4. Price changes go through `product_price_versions` — never overwrite the existing row.
5. Campaign targeting lives in `campaign_targeting_rules` — never embed geo/channel logic in application code.
6. All JWT auth via `auth.jwt` middleware on PHP. Node trusts the same token. Login is OTP-based only — no email/password.
7. `referral_reward_ledger` status transitions are owned by the stored procedure `check_and_release_referral_reward` — never update status directly from application code.
8. Bulk operations must write to `audit_logs` (action_type = `BULK_IMPORT`).
9. Node DB queries go through `services/db.js` only — never inline `mysql2` in route handlers.
10. Node uses ES modules (`import`/`export`). Do not use `require()`.
11. B2B delivery = KAM. B2C default = DH; sub-channel/channel may override. Sub-channel uses `delivery_ownership ENUM('FOLLOW_CHANNEL','SELF_DELIVERY','DH_DELIVERY')`. Channel uses `default_delivery_mode ENUM('DH','OWN')`. Per-order overrides in `order_delivery_overrides`.
12. Every order must reference `anchor_id` + `active_service_id` — never attach to a customer alone. Both `NOT NULL` on `orders` and `transaction_ledger`. On `onetime_invoices`, summary rows (`is_summary=1`) leave them NULL.
13. No Hub Manager entity. Each delivery entity (DH, Channel, Sub-Channel) has `manager_admin_id FK → user_account(id)`. JWT payload includes `staff_type` for role resolution without DB lookup.
14. Bulk insert/update available on all admin entities. Bulk delete: dev-mode only + `APP_ENV != production`. All bulk ops write to `audit_logs`.
15. OTP stored as SHA-256 + per-row salt. Rate limit: 5/h/msisdn + 20/day/IP. Lockout: 5 failed verifies/15 min. `/api/auth/otp/dev-peek` registered only when `APP_ENV != production`.
16. JWT: httpOnly + Secure + SameSite=Strict cookies. Access 15 min, refresh 7 days. Revocation in Redis by `jti`. WebSocket: JWT via subprotocol — unauthenticated upgrades rejected.
17. RBAC on every protected route via `PermissionMiddleware` → `has_role()` stored procedure. Result cached per-user in Redis 300s. `auth.jwt` alone is never sufficient.
18. All mutating endpoints (`orders`, `addon_order_history`, `cpe_order_history`, `ott_order_history`, `real_ip_assignments`, `stock_transfers`, `referral_redemptions`) require `Idempotency-Key` header. Redis-cached 24h. Duplicate key returns cached response — no re-execution.
19. Boot-time production guard: PHP `AppServiceProvider::boot()` + Node `index.js` throw if `APP_ENV=production` and any of `GPSHOP_MOCK / LOCATION_CHANGE_API_MOCK / REAL_IP_API_MOCK / CUSTOMER_LIFECYCLE_MOCK / APP_DEBUG / OTP dev-peek` is `true`.

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
| `docs/SupremeFlex_Consolidated_Requirements.md` | Full platform requirements (B2C/B2B, delivery routing, GPWEB-3730, Section 11 = Security & Scale) |
| `docs/architecture.md` | Architecture diagrams, security model, scale targets, ADR log |
| `docs/developmentPlan.md` | Execution roadmap — block-by-block status |
| `docs/phase-1-dod.md` | Phase -1 Definition of Done + end-of-phase verification results |

**Load only the file(s) relevant to the current task. Do not load all at once.**

---

## Wiki (Karpathy pattern)

Distilled knowledge base at `/Users/mahfujrahman/ClaudeCowork/work-wiki/`.  
Read `wiki/index.md` for the full map. Key pages:

| Wiki Page | When to read |
|---|---|
| `wiki/projects/supreme-flex/overview.md` | Architecture, module list, design patterns |
| `wiki/projects/supreme-flex/db-schema.md` | Deep schema reference with all relationships |
| `wiki/projects/supreme-flex/api-routes.md` | Full route inventory |
| `wiki/projects/supreme-flex/frontend-pages.md` | Page map, backend ownership per page |
| `wiki/products/gpfi.md` | GPFI product context — what this CRM serves |

**Rule:** Never query `raw/` directly. Wiki pages are the source of truth for distilled knowledge.
