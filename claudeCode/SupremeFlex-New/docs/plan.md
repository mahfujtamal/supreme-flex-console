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

**Migration D0:**
- DROP `hub_managers`
- ALTER `field_agents` DROP `hub_manager_id`
- ALTER `kams` DROP `hub_manager_id`
- ALTER `channels`, `sub_channels`, `distribution_houses` ADD `manager_admin_id CHAR(36) NULL FK → admin_users`
- MODIFY `inventory_master.status` ENUM: remove `WITH_HUB_MANAGER`
- MODIFY `stock_transfers.to_entity_type` ENUM: remove `HUB_MANAGER`

### Multi-Connection Per Customer
- One customer → many anchors → many active_services
- All order tables carry `anchor_id` + `active_service_id`
- Customer 360 organises tabs per connection

### B2C/B2B Delivery Routing
B2C resolution order (sub-channel override → sub-channel default → channel override → channel default → DH).

**Migration D4 adds:**
- `channels`: `default_delivery_mode ENUM('DH','OWN') DEFAULT 'DH'`, `inventory_pull_mode ENUM('CREDIT','UPFRONT') DEFAULT 'UPFRONT'`
- `sub_channels`: same two columns
- `distribution_houses`: `inventory_pull_mode ENUM('CREDIT','UPFRONT') DEFAULT 'UPFRONT'`
- `kams`: `inventory_pull_mode ENUM('CREDIT','UPFRONT') DEFAULT 'CREDIT'`
- NEW: `order_delivery_overrides (override_id PK, order_id FK, entity_type, entity_id, reason, created_by)`

### Bulk Operations
`BaseApiController` adds `bulkStore()`, `bulkUpdate()`, `bulkDestroy()` (destroy: `X-Dev-Mode: true` required). All bulk ops audit-logged.

### Mock API Strategy
| Service | Class | Env Flag |
|---------|-------|----------|
| GPShop | `GpShopService` | `GPSHOP_MOCK` |
| Location Change | `LocationChangeApiService` | `LOCATION_CHANGE_API_MOCK` |
| Real IP | `RealIpApiService` | `REAL_IP_API_MOCK` |
| Customer Lifecycle | `CustomerLifecycleService` | `CUSTOMER_LIFECYCLE_MOCK` |

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
✅ Done  (OTP Auth — migration 004, login page, AuthContext, auth guard)
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
