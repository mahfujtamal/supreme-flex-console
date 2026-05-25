# Phase -1 (BLOCK 0) — Definition of Done

Each P-1.x item is "done" when every checkbox below is ticked and the end-of-phase verification passes.

---

## Execution Order

```
P-1.1  ──►  P-1.2  ──►  P-1.5  ──►  P-1.3 ┐
                                       P-1.4 ┘  (parallel)
P-1.6  (doc only — already done)
P-1.7  (infra: anytime; app-side: before Phase 2 E5–E10)
```

**Hard gate before P-1.1:** `backend-php/composer.json` must exist. Run `composer init` first.

---

## P-1.1 — UUIDv7 / BINARY(16) PK Migration ✅ Done

- [x] All 48 tables have `BINARY(16)` PKs (verify via `SHOW CREATE TABLE`)
- [x] No `DEFAULT (UUID())` or `AUTO_INCREMENT` remains in any migration file
- [x] `ramsey/uuid` in `composer.json`; `Uuid::make()` used in all PHP controllers
- [x] `uuidv7` npm package installed; used in all Node route handlers via `services/db.js`
- [x] Migration `005_uuid7_binary16_migration.sql` runs cleanly on a fresh DB
- [x] Full sequence 001–005 applies cleanly in order (test end-to-end)
- [x] `audit_logs` PK migrated; `BULK_IMPORT` FK chain intact

---

## P-1.2 — Auth Hardening ✅ Done

- [x] OTP stored as SHA-256 + per-row salt (never plaintext)
- [x] 6th OTP request within 1 h from same msisdn → `429`
- [x] 21st OTP request within 1 day from same IP → `429`
- [x] 5th failed verify within 15 min → `423` (locked)
- [x] JWT issued as httpOnly + Secure + SameSite=Strict cookie (access 15 min, refresh 7 d)
- [x] Revoked token (by `jti`) → `401` on next request
- [x] Insufficient role → `403` via `PermissionMiddleware`
- [x] WebSocket upgrade without valid JWT in subprotocol → rejected (close code 1008)
- [x] `/api/auth/otp/dev-peek` → `404` when `APP_ENV=production`

---

## P-1.3 — Idempotency Middleware ✅ Done

- [x] Missing `Idempotency-Key` header on mutating endpoint → `422`
- [x] Duplicate key + same body hash → returns cached response, no re-execution
- [x] Duplicate key + different body hash → `409`
- [x] In-flight request with same key → `409`
- [x] Cache TTL = 24 h (verify via Redis `TTL` command on the key)
- [x] Covers all 9 mutating endpoint groups: `orders`, `addon_order_history`, `cpe_order_history`, `ott_order_history`, `real_ip_assignments`, `stock_transfers`, `referral_redemptions`, plus bulk-insert and bulk-update routes

---

## P-1.4 — Test Harness ✅ Done

- [x] `supremeflex_test` database exists locally and in CI
- [x] PHPUnit installed; GitHub Actions workflow runs `php artisan test` on every push
- [x] Auth + RBAC + idempotency middleware coverage ≥ 100%
- [x] Referral SP (`check_and_release_referral_reward`) coverage ≥ 90%
- [x] Services layer coverage ≥ 80%
- [x] Vitest + supertest configured for Node; at least 1 passing suite per router (dashboard, fieldExecution, stockTransfers)
- [x] GitHub Actions workflow green on push to `main`

---

## P-1.5 — Boot-time Production Guards ✅ Done

- [x] `GPSHOP_MOCK=true` + `APP_ENV=production` → PHP throws on boot
- [x] `LOCATION_CHANGE_API_MOCK=true` + production → throws
- [x] `REAL_IP_API_MOCK=true` + production → throws
- [x] `CUSTOMER_LIFECYCLE_MOCK=true` + production → throws
- [x] `APP_DEBUG=true` + production → throws
- [x] OTP dev-peek flag true + production → throws (Node `index.js` startup guard)

---

## P-1.6 — Drupal Removal

- [ ] Zero `Drupal` / `:8080` references in `README.md`
- [ ] `/drupal/` directory absent from `git ls-files`

**Status: done** (completed in planning phase per git log)

---

## P-1.7 — DB Topology + Redis + Queue

- [ ] `config/database.php` has `read` / `write` connection split; read queries hit replica hostname
- [ ] Laravel Horizon installed (`laravel/horizon` in `composer.json`); dashboard reachable at `/horizon`
- [ ] `retry_after=90` set in `config/queue.php`
- [ ] Partition maintenance job registered in `routes/console.php`
- [ ] Cache hit-rate > 80% in local smoke test
- [ ] ProxySQL routing config committed to repo

---

## End-of-Phase -1 Verification (all must pass before BLOCK A begins)

1. **Fresh DB run:** apply migrations 001–005 in sequence with no errors
2. **Prod guard:** boot with all mock flags true + `APP_ENV=production` → server refuses to start
3. **Auth flow:** OTP request → submit OTP → cookie issued → call protected route → wrong-role returns 403 → revoke token → returns 401
4. **Idempotency replay:** POST to `/api/orders` twice with the same `Idempotency-Key` → second response is byte-identical to first; confirm no second DB write via query log
5. **Test suites:** `php artisan test` + `npm test` → all suites green; all coverage thresholds met
