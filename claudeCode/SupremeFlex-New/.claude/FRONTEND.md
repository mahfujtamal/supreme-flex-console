# SupremeFlex — Frontend Reference

Next.js 14 App Router. TypeScript. Source: `frontend/`.

## Layout
`components/layout/AppHeader.tsx` + `AppSidebar.tsx` — wrap all pages.

## Pages (`app/`)
| Route | Page | Backend |
|---|---|---|
| `/gpfi-dashboard` | GPFI operations overview | Node WS + PHP |
| `/hub-manager-dashboard` | DH hub manager view | Node WS + PHP |
| `/customers` | Customer list + 360 detail | PHP |
| `/field-execution` | Order dispatch + installation | Node |
| `/bulk-inwarding` | Inventory receipt from GPFI staging | PHP |
| `/stock-transfers` | DH→Agent inventory movement | Node |
| `/invoicing` | Invoice + transaction ledger | PHP |
| `/assets` | CPE/SIM asset lifecycle | PHP |
| `/campaign-engine` | Campaign CRUD + targeting | PHP |
| `/product-engine` | Product catalogue | PHP |
| `/pricing-engine` | Price timeline | PHP |
| `/master-data` | Geo hierarchy + distribution network | PHP |
| `/governance` | Admin users + roles | PHP |
| `/operations` | Operational monitoring | PHP |
| `/logs` | Audit + system logs | PHP |

## API Layer (`lib/api.ts`)
Centralizes all axios calls. PHP base: `:8000/api`. Node base: `:8001/api`. Handles JWT attachment.

## Utilities
`lib/currency.ts` — BDT formatting · `lib/utils.ts` — general helpers

## Dashboard pages
Consume WebSocket from `ws://localhost:8001/ws/dashboard` for live updates. Handle both `snapshot` and `update` message types.
