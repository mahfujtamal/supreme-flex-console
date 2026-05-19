# SupremeFlex — API Reference

## PHP/Laravel (:8000) — JWT protected except login

### Auth
`POST /api/auth/otp/request` (public) · `POST /api/auth/otp/verify` (public) · `POST /api/auth/logout` · `GET /api/auth/me`

### Master Data (all apiResource: index/show/store/update/destroy)
`/api/network-zones` · `/api/districts` · `/api/areas` · `/api/channels` · `/api/sub-channels` · `/api/distribution-houses` · `/api/hub-managers` · `/api/field-agents` · `/api/kams`

### Product Engine
`/api/products` · `/api/price-versions` · `/api/price-components` · `/api/addon-compatibility`  
`GET /api/pricing` — price timeline query (`PriceVersionController::timeline`)

### Campaign Engine
`/api/campaigns` (+ `POST /api/campaigns/{id}/clone`) · `/api/coupons` · `/api/referral-programs` · `/api/targeting-rules` · `/api/product-rules`

### Customers (read-only)
`GET /api/customers` · `GET /api/customers/{id}` · `GET /api/customers/{id}/360`

### Invoicing
`GET /api/invoices` · `POST /api/invoices` · `GET /api/transaction-ledger`

### Assets
`/api/assets` (CRUD) · `POST /api/assets/{id}/replace`

### Inventory
`GET /api/inventory` · `POST /api/inventory` · `POST /api/inventory/bulk-inward`

### Stock Transfers
`/api/stock-transfers` (CRUD) · `PATCH /api/stock-transfers/{id}/respond`

### Governance
`/api/admin-users` · `/api/admin-roles`

### Audit
`GET /api/audit-logs` · `POST /api/audit-logs` · `GET /api/system-audit-logs`

### Dashboards
`GET /api/dashboard/gpfi` · `GET /api/dashboard/hub-manager` · `GET /api/dashboard/field-execution`

### Referral RPCs
`POST /api/referrals/check-reward` · `POST /api/referrals/force-approve`

---

## Node.js (:8001)

### REST
`/api/field-execution` · `/api/stock-transfers` · `/api/dashboard` · `GET /health`

### WebSocket — `ws://host:8001/ws/dashboard`
- On connect: sends `{ type: 'snapshot', data }` immediately
- Every 10s: pushes `{ type: 'update', data }` to all open connections
- Data: `broadcastDashboard()` queries MySQL

---

## Controller Locations (`backend-php/app/Http/Controllers/Api/`)
MasterData/ · ProductEngine/ · CampaignEngine/ · Governance/ — all others at Api/ root
