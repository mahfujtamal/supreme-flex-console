# SupremeFlex — Next.js Frontend

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_API_PHP and NEXT_PUBLIC_API_NODE
npm run dev   # → http://localhost:3000
```

## API Routing

| Module | API Backend |
|---|---|
| Master Data, Products, Pricing, Campaigns, Customers, Invoicing, Assets, Governance | PHP/Laravel (`phpApi`) |
| Stock Transfers, Field Execution, Dashboards (real-time) | Node.js (`nodeApi`) |

## Real-time Dashboard

Connect to `NEXT_PUBLIC_WS_URL` (ws://localhost:8001/ws/dashboard) via WebSocket.
The server pushes `{ type: 'snapshot'|'update', data }` every 10 seconds.

## Adding a New Module

1. Create `app/<module>/page.tsx`
2. Use `useQuery` with `phpApi.get(...)` or `nodeApi.get(...)`
3. Use `useMutation` with `phpApi.post/put/delete(...)` for writes
4. Add nav item to `components/layout/AppSidebar.tsx`
