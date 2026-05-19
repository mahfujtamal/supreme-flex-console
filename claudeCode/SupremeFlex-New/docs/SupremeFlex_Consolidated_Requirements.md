# SupremeFlex — Consolidated Requirements
**Platform: GPFI (Grameenphone FWA) | Version: 2.0 | Date: 2026-05-18**

---

## 1. Platform Overview

SupremeFlex is an internal back-office (BO) CRM and operations platform for the **GPFI — Grameenphone FWA** product line. It manages the full lifecycle of FWA connections: acquisition, field delivery, customer management, invoicing, and add-on services.

- **Customer types:** B2C (individual) and B2B (business)
- **Stack:** Next.js :3000 → PHP/Laravel :8000 (auth, CRUD, campaigns, invoicing) + Node.js :8001 (field ops, stock transfers, WS dashboard) → MySQL :3306
- **Authentication:** OTP-based. Users log in with mobile number → 6-digit OTP → JWT. No email/password login.
- **CMS layer:** Drupal :8080 (configurable texts, reporting views)

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
| 2 | Sub-channel `default_delivery_mode = OWN` | Sub-channel own delivery |
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
| Bulk Insert (CSV upload) | All users |
| Bulk Update | All users |
| Bulk Delete | Dev mode only (`isDevMode = true` + `X-Dev-Mode: true` header) |

All bulk ops write to `audit_logs` (`action_type = BULK_IMPORT | BULK_UPDATE | BULK_DELETE`).

---

## 6. GPWEB-3730 Feature Set

### 6.1 Physical Add-Ons
- Orderable per connection; CPE-compatibility checked via `physical_addon_compatibility`
- **GPShop journey:** API integration — mocked (`GpShopService`, `GPSHOP_MOCK=true`)
- **DH-IT / Cockpit:** internal BO flow — real implementation
- Auto-cancel: PENDING orders past `auto_cancel_at` → `AUTO_CANCELLED` (daily Artisan command)

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
- Auto-unassign: daily Artisan command
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

---

## 8. Current Codebase State

### Done
- DB: 39 tables, 32 triggers, 3 stored procedures; `otp_codes` table (migration 004)
- PHP: 50+ routes, all controllers scaffolded, JwtMiddleware complete; OTP auth endpoints (`/auth/otp/request`, `/auth/otp/verify`)
- Node.js: 8 endpoints with real logic + transactions; WebSocket every 10s
- Frontend: AppSidebar, AppHeader (real username + logout), JWT auto-attach in api.ts; `/login` page; `AuthContext`; `(app)` route group with auth guard

### Needs Implementation
- All 16 frontend pages are JSON dump stubs — no real UI, forms, or tables
- Bulk operation endpoints and UI
- GPWEB-3730 features (5 feature sets)
- Hub Manager removal migration

### Known Bugs
| ID | Status | Bug | File |
|----|--------|-----|------|
| BUG-1 | ✅ Fixed | `allocated_entity_id` mismatch in dashboard | dashboard.js |
| BUG-2 | TODO | Race condition in StockTransferController | StockTransferController.php |
| BUG-3 | TODO | Audit attribution hardcoded | AuditLogController.php |
| BUG-4 | TODO | JWT_SECRET not validated at startup | index.js |
| BUG-5 | TODO | No try-catch on Node route handlers | fieldExecution.js etc. |

---

## 9. Absolute Rules

1. PHP owns CRUD/auth/campaigns/invoicing. Node owns field execution/stock transfers/WS. Never cross-assign.
2. All PKs: `CHAR(36) DEFAULT (UUID())`. No auto-increment.
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
14. Bulk delete is dev-mode only.

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
