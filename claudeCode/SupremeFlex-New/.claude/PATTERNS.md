# SupremeFlex — Patterns & Conventions

## Commit Format
```
type(scope): short description

type: feat | fix | refactor | chore | docs
scope: backend-php | backend-node | frontend | db | campaign | inventory
```

## PHP Controller Pattern
- Return `response()->json(['data' => $result])` for success
- Return `response()->json(['error' => $message], $code)` for errors
- Always validate with `$request->validate([...])` at the top of store/update
- Use DB transactions for any multi-table write

## Node.js Pattern
- All DB queries via `services/db.js` — never inline `mysql2` calls in route handlers
- Route handlers are thin — business logic goes in `services/`
- WebSocket broadcast is one-way (server → client only); no client messages handled

## Price Query Pattern
Always join `product_price_versions` with `WHERE status = 'CURRENT'` to get live price.  
Never cache prices in application memory — always query.

## Geo Targeting Pattern
When resolving which campaigns apply to an order:
1. Get order's `area_id` → derive `district_id`, `network_zone_id`, `channel_id`
2. Match `campaign_targeting_rules` — null fields are wildcards
3. Sort matched campaigns by `campaign_rank` ASC → apply lowest rank first

## Audit Logging
Every admin action must insert to `audit_logs`:
```php
AuditLog::create([
    'target_table'     => 'table_name',
    'target_record_id' => $id,
    'action_type'      => 'CREATE|UPDATE|DELETE|BULK_IMPORT|STATUS_CHANGE',
    'admin_id'         => auth()->id(),
    'ip_address'       => $request->ip(),
    'previous_state'   => $before,   // JSON
    'new_state'        => $after,    // JSON
]);
```

## Soft Delete Pattern
Never `DELETE` from master tables. Always:
```sql
UPDATE table SET status = 'INACTIVE', updated_at = NOW() WHERE id = ?
```

## Frontend API Call Pattern
```typescript
// Always use lib/api.ts — never raw axios/fetch
import { phpApi, nodeApi } from '@/lib/api';

const data = await phpApi.get('/customers');         // PHP backend
const live = await nodeApi.get('/dashboard');        // Node backend
```

## Error Handling (Frontend)
Catch errors at the page level. Show toast on failure. Never swallow errors silently.
