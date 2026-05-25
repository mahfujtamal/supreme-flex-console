# SupremeFlex — Architecture
**Platform: GPFI (Grameenphone FWA) | Version: 1.0 | Date: 2026-05-20**

---

## 0. Purpose & Scope

This document is the canonical architecture reference for SupremeFlex. It captures **both the current implementation and the post Phase -1 target topology** (see `docs/plan.md` Phase -1 and `docs/developmentPlan.md` BLOCK 0).

Where current ≠ target, both states are shown side-by-side and each gap is tagged with the Phase -1 work item that closes it (e.g., `Phase -1 / P-1.2`).

**Audience:** Engineers joining the project, infra/SRE reviewers, security reviewers, and Claude Code sessions resolving cross-cutting questions.

**Related docs:**
- `CLAUDE.md` — operational rules + absolute rules
- `docs/SupremeFlex_Consolidated_Requirements.md` — functional + non-functional requirements
- `docs/plan.md` — implementation plan
- `docs/developmentPlan.md` — execution roadmap
- `.claude/DB.md` — table schema
- `.claude/API.md` — route inventory

---

## 1. System Context

SupremeFlex is an **internal CRM**. It is not customer-facing.

```mermaid
flowchart LR
    subgraph Users["Internal users (~20k peak concurrent)"]
        CS["CS Reps<br/>Hotline staff"]
        KAM["KAM<br/>B2B account managers"]
        DHM["DH / Channel / Sub-channel<br/>Managers"]
        FA["Field Agents<br/>Mobile installers"]
        ADM["System Admins<br/>Governance"]
    end

    subgraph SF["SupremeFlex (this system)"]
        FE["Next.js Frontend"]
        PHP["PHP / Laravel API"]
        NODE["Node.js API + WS"]
        DB[("MySQL")]
        RD[("Redis")]
    end

    subgraph External["External systems"]
        GPS["GPShop API<br/>(mocked: GPSHOP_MOCK)"]
        LCH["Location Change<br/>Network API<br/>(mocked)"]
        RIP["Real IP<br/>Provisioning API<br/>(mocked)"]
        LIFE["Customer Lifecycle<br/>Status API<br/>(mocked)"]
        SMS["SMS Gateway<br/>(OTP, notifications)"]
        BI["Metabase / Superset<br/>(post-launch, P-1.6)"]
    end

    CS --> FE
    KAM --> FE
    DHM --> FE
    FA --> FE
    ADM --> FE

    FE --> PHP
    FE --> NODE
    PHP --> DB
    PHP --> RD
    NODE --> DB
    NODE --> RD

    PHP -.->|HTTPS| GPS
    PHP -.->|HTTPS| LCH
    PHP -.->|HTTPS| RIP
    PHP -.->|HTTPS| LIFE
    PHP -.->|HTTPS| SMS
    NODE -.->|internal HTTP| PHP

    BI -.->|read-replica only| DB
```

**Key constraints:**
- This CRM serves **internal GP staff only**. No public-customer surface.
- The full GP subscriber base is ~80M, but only **3–10M** of those are GPFI customers visible in this system over the 5-year horizon.
- All external integrations (GPShop, LocationChange, RealIP, CustomerLifecycle) are mocked-by-default; real-stub classes throw until env flag flipped (see `docs/SupremeFlex_Consolidated_Requirements.md` §7).

---

## 2. Container Diagram

### 2.1 Current state (pre Phase -1)

```mermaid
flowchart TB
    Browser["Browser<br/>Next.js :3000"]
    PHP["PHP / Laravel :8000<br/>auth · CRUD · campaigns · invoicing"]
    NODE["Node.js :8001<br/>field exec · stock xfers · WS dashboard"]
    DB[("MySQL :3306<br/>single instance")]

    Browser -->|"axios (JWT in localStorage)"| PHP
    Browser -->|"axios (JWT in localStorage)"| NODE
    Browser <-.->|"ws:// (unauthenticated)"| NODE
    PHP --> DB
    NODE --> DB
```

**Gaps in current state:**
- JWT in `localStorage` → XSS-vulnerable (closed by **P-1.2**)
- WebSocket has no auth check (closed by **P-1.2**)
- Single MySQL, no replicas, no cache, no queue (closed by **P-1.7**)
- No idempotency on retries (closed by **P-1.3**)
- `CHAR(36)` random UUIDv4 PKs → page splits at scale (closed by **P-1.1**)

### 2.2 Target state (post Phase -1)

```mermaid
flowchart TB
    Browser["Browser<br/>Next.js :3000"]

    subgraph App["Application tier"]
        PHP["PHP / Laravel :8000<br/>auth · CRUD · campaigns · invoicing<br/>+ PermissionMiddleware<br/>+ IdempotencyMiddleware<br/>+ Horizon queue workers"]
        NODE["Node.js :8001<br/>field exec · stock xfers · WS<br/>+ auth middleware<br/>+ idempotency middleware<br/>+ WS subprotocol auth"]
    end

    subgraph Data["Data tier"]
        PROXY["ProxySQL<br/>read/write split"]
        PRIMARY[("MySQL primary<br/>:3306")]
        R1[("Read replica 1")]
        R2[("Read replica 2")]
        REDIS[("Redis :6379<br/>sessions · idempotency<br/>JWT revocation · cache · queue")]
        BACKUP["XtraBackup + binlogs<br/>RTO 15m / RPO 5m"]
    end

    Browser -->|"axios + httpOnly cookie JWT"| PHP
    Browser -->|"axios + httpOnly cookie JWT"| NODE
    Browser <-->|"wss:// + JWT in subprotocol"| NODE

    PHP --> PROXY
    NODE --> PROXY
    PHP --> REDIS
    NODE --> REDIS

    PROXY -->|writes| PRIMARY
    PROXY -->|reads| R1
    PROXY -->|reads| R2

    PRIMARY -.->|binlog| R1
    PRIMARY -.->|binlog| R2
    PRIMARY -.->|nightly + binlog| BACKUP
```

**Tagged Phase -1 changes:**
| Change | Closes |
|---|---|
| httpOnly cookies + refresh token + revocation | P-1.2 |
| WebSocket subprotocol auth | P-1.2 |
| `PermissionMiddleware` enforcing `has_role()` | P-1.2 |
| `IdempotencyMiddleware` | P-1.3 |
| MySQL replicas + ProxySQL | P-1.7 |
| Redis (sessions, idempotency, revocation, cache, queue) | P-1.7 |
| Horizon queue workers replacing daily Artisan crons | P-1.7 |
| Backup with documented RTO/RPO | P-1.7 |
| UUIDv7 / `BINARY(16)` PKs across all 39 tables | P-1.1 |

---

## 3. Component Diagrams

### 3.1 PHP / Laravel backend

```mermaid
flowchart TB
    subgraph Routes["routes/api.php"]
        AUTH["/auth/otp/*<br/>(unprotected)"]
        REST["/{resource}/*<br/>auth.jwt + can:* (P-1.2)"]
        INTERNAL["/internal/*<br/>InternalKeyMiddleware"]
    end

    subgraph Middleware["Middleware chain"]
        MW_JWT["JwtMiddleware<br/>(verifies access token<br/>+ revocation check, P-1.2)"]
        MW_PERM["PermissionMiddleware<br/>(has_role + Redis cache, P-1.2)"]
        MW_IDEM["IdempotencyMiddleware<br/>(POST/PATCH/DELETE, P-1.3)"]
        MW_RL["RateLimiter<br/>(OTP request, P-1.2)"]
    end

    subgraph Controllers["Controllers"]
        BASE["BaseApiController<br/>CRUD + bulkStore/Update/Destroy"]
        AUTHC["AuthController<br/>requestOtp / verifyOtp / refresh / logout"]
        CUST["CustomerController<br/>view360() per-connection"]
        INV["InvoiceController<br/>summary + child rows"]
        ORD["OrderController<br/>anchor_id + active_service_id"]
        ADDON["AddonOrderController<br/>+ AutoCancel Horizon job"]
        RIP["RealIpController<br/>+ AutoUnassign Horizon job"]
        LOC["LocationChangeController"]
        STK["StockTransferController<br/>(SELECT FOR UPDATE)"]
    end

    subgraph Services["Services (DI bound via AppServiceProvider)"]
        GPS_I["GpShopServiceInterface<br/>→ Mock or RealStub"]
        LCH_I["LocationChangeApiServiceInterface"]
        RIP_I["RealIpApiServiceInterface"]
        LIFE_I["CustomerLifecycleServiceInterface"]
        SMS_S["SmsService"]
        CONF["SystemConfigController"]
    end

    subgraph Storage["Persistence"]
        EL["Eloquent models"]
        SP["Stored procedures<br/>has_role / referral SPs"]
        MYSQL[("MySQL via ProxySQL")]
        REDIS_S[("Redis")]
    end

    AUTH --> MW_RL
    REST --> MW_JWT --> MW_PERM --> MW_IDEM
    MW_IDEM --> Controllers
    Controllers --> EL --> MYSQL
    Controllers --> SP --> MYSQL
    Controllers --> Services
    Services -.-> External(("External APIs"))
    MW_IDEM <--> REDIS_S
    MW_PERM <--> REDIS_S
    AUTHC <--> REDIS_S
```

### 3.2 Node.js backend

```mermaid
flowchart TB
    subgraph EntryNode["index.js"]
        BOOT["Startup guards<br/>JWT_SECRET + APP_ENV (P-1.5)"]
        WS["WebSocket upgrade<br/>+ subprotocol JWT verify (P-1.2)"]
    end

    subgraph RoutesNode["Routes"]
        FE_R["/field-execution/*"]
        ST_R["/stock-transfers/*"]
        DASH_R["/dashboard/*"]
    end

    subgraph MWNode["Middleware"]
        MW_AUTH["auth.js<br/>jwt.verify + Redis revocation check"]
        MW_IDEM_N["idempotency.js<br/>(P-1.3)"]
    end

    subgraph SvcNode["Services"]
        DB_S["services/db.js<br/>(only mysql2 entry point)"]
        BCAST["dashboardBroadcast.js<br/>10s push loop"]
        BRIDGE["phpBridge.js<br/>POST /api/internal/sms"]
    end

    BOOT --> WS
    WS -.->|"authenticated socket"| BCAST
    RoutesNode --> MW_AUTH --> MW_IDEM_N
    MW_IDEM_N --> RoutesNode
    RoutesNode --> DB_S
    DB_S --> MYSQLN[("MySQL via ProxySQL")]
    RoutesNode --> BRIDGE -.->|"HTTPS"| PHP_EXT["PHP /api/internal/sms"]
    BCAST --> DB_S
    BCAST -.->|"push"| Clients(("Connected dashboards"))
```

---

## 4. Key Sequence Flows

### 4.1 OTP login (target — post P-1.2)

```mermaid
sequenceDiagram
    actor U as User (CS rep, FA, etc.)
    participant FE as Next.js
    participant PHP as PHP /api/auth/otp/*
    participant RL as RateLimiter (P-1.2)
    participant DB as MySQL otp_codes
    participant SMS as SMS Gateway
    participant RD as Redis (revocation)

    U->>FE: enter mobile number
    FE->>PHP: POST /otp/request {msisdn}
    PHP->>RL: check 5/h/msisdn + 20/d/IP
    alt rate limit hit
        RL-->>PHP: 429
        PHP-->>FE: 429 Too Many Requests
    end
    PHP->>DB: INSERT otp_codes (SHA-256 + salt, exp = NOW()+5min)
    PHP->>SMS: send(msisdn, OTP code)
    Note over PHP: dev: /api/auth/otp/dev-peek<br/>(only when APP_ENV != production)
    PHP-->>FE: 200 {requestId}

    U->>FE: enter OTP code
    FE->>PHP: POST /otp/verify {requestId, code}
    PHP->>DB: SELECT otp_codes WHERE id = ? AND attempts < 5
    alt code mismatch
        PHP->>DB: UPDATE attempts = attempts + 1
        alt attempts >= 5
            PHP-->>FE: 423 Locked (15min)
        else
            PHP-->>FE: 401 Invalid
        end
    end
    PHP->>PHP: generate access JWT (15m) + refresh JWT (7d)
    PHP->>RD: SET jti:{access_jti} = active (TTL 15m)
    PHP-->>FE: 200 + Set-Cookie: sf_access=...; HttpOnly; Secure; SameSite=Strict<br/>+ Set-Cookie: sf_refresh=...; HttpOnly; Secure; SameSite=Strict
    FE->>U: redirect to /dashboard
```

### 4.2 Order creation with idempotency (post P-1.3)

```mermaid
sequenceDiagram
    actor U as Field Agent (mobile)
    participant FE as Next.js
    participant PHP as PHP /api/orders
    participant MW as IdempotencyMiddleware
    participant RD as Redis
    participant DB as MySQL
    participant GPS as GPShop API (or mock)

    U->>FE: tap "Place Order"
    FE->>FE: generate UUIDv7 idempotency key
    FE->>PHP: POST /orders<br/>Idempotency-Key: 018f7a..<br/>{anchor_id, active_service_id, items[]}

    PHP->>MW: extract key + hash(body)
    MW->>RD: GET idem:{key}
    alt cache hit (retry from flaky network)
        RD-->>MW: cached response
        MW-->>FE: 200 (cached) — no DB write
    else cache miss
        MW->>PHP: continue
        PHP->>DB: BEGIN TRANSACTION
        PHP->>DB: SELECT FOR UPDATE inventory_master
        PHP->>DB: INSERT orders (id = UUIDv7 BINARY(16))
        PHP->>DB: INSERT order_items
        PHP->>DB: UPDATE inventory_master (WITH_AGENT)
        PHP->>DB: INSERT audit_logs
        PHP->>GPS: createOrder() (if GPShop journey)
        GPS-->>PHP: ack
        PHP->>DB: COMMIT
        PHP->>RD: SET idem:{key} = response (TTL 24h)
        PHP-->>FE: 201 Created
    end
```

### 4.3 WebSocket dashboard (post P-1.2)

```mermaid
sequenceDiagram
    actor M as Manager (DH/Channel/Sub-channel)
    participant FE as Next.js
    participant WS as Node WS upgrade
    participant RD as Redis
    participant BC as dashboardBroadcast
    participant DB as MySQL replica

    M->>FE: open /manager-dashboard
    FE->>WS: wss:// upgrade<br/>Sec-WebSocket-Protocol: jwt.{access_token}
    WS->>WS: jwt.verify(access_token)
    WS->>RD: GET jti:{access_jti}
    alt revoked or missing
        WS-->>FE: 401 close
    end
    WS->>WS: attach socket, scope by staff_type + manager_admin_id
    loop every 10s
        BC->>DB: SELECT current state (scoped)
        DB-->>BC: rows
        BC->>WS: push frame to all matching sockets
        WS-->>FE: frame
        FE-->>M: live update
    end
```

---

## 5. Data Architecture

### 5.1 Domain map

```mermaid
flowchart LR
    subgraph Identity
        UA["user_account"]
        ROLE["role_master + role_permission"]
        OTP["otp_codes (hashed, P-1.2)"]
    end

    subgraph Geo
        CIR["circles → regions → clusters → territories"]
        DST["districts → areas"]
        NZ["network_zones"]
    end

    subgraph Distribution
        CH["channels → sub_channels"]
        DH["distribution_houses"]
        FA["field_agents"]
        KM["kams"]
    end

    subgraph Product
        PROD["products"]
        PV["product_price_versions (versioned, never mutated)"]
        PADC["physical_addon_compatibility"]
    end

    subgraph CustomerCore
        CUST["customers (B2C/B2B)"]
        ANC["anchors (installation location)"]
        AS["active_services"]
        CA["customer_assets"]
    end

    subgraph Orders
        ORD["orders (anchor_id + active_service_id NOT NULL)"]
        OI["order_items → inventory_master"]
        STX["stock_transfers"]
    end

    subgraph Money
        INV["onetime_invoices (parent_summary + children)"]
        LED["transaction_ledger"]
        RR["referral_reward_ledger (SP-owned)"]
    end

    subgraph Audit
        AL["audit_logs (partitioned monthly, P-1.7)"]
        SAL["system_audit_logs"]
    end

    CUST --> ANC --> AS
    ANC --> CA
    ORD --> ANC
    ORD --> AS
    ORD --> OI
    INV --> ANC
    INV --> AS
    LED --> ORD
    LED --> INV
    DH --> FA
    CH --> CHS["sub_channels"]
    UA --> DH
    UA --> CH
    UA --> CHS
    PROD --> PV
```

### 5.2 PK strategy (Phase -1 / P-1.1)

| Aspect | Current | Target |
|---|---|---|
| Type | `CHAR(36)` | `BINARY(16)` |
| Generation | `DEFAULT (UUID())` (random v4) | `Ramsey\Uuid::uuid7()` / `uuidv7` npm (time-ordered v7) |
| Size on disk | 36 bytes | 16 bytes |
| Index bloat (relative) | 4–5× | baseline |
| InnoDB page-split rate | High (random insertion) | <2% (time-ordered) |
| Storage in code | string | string at API boundary, `BINARY(16)` in queries |

### 5.3 Read/write routing (Phase -1 / P-1.7)

| Workload | Route to |
|---|---|
| Order writes, stock transfers, invoice writes | **Primary** |
| Customer 360 reads, dashboards, reports | **Read replica** |
| Audit log writes | Primary |
| Audit log reads | Replica |
| OTP `otp_codes` writes/reads | Primary (low latency required) |

ProxySQL rule: `SELECT` → replica unless `FOR UPDATE` / `INSERT` / `UPDATE` / `DELETE` / explicit `/* primary */` hint.

### 5.4 Partitioning (Phase -1 / P-1.7)

| Table | Strategy | Retention |
|---|---|---|
| `audit_logs` | RANGE by month on `created_at` | 24 months online; archive to cold storage |
| `system_audit_logs` | RANGE by month on `created_at` | 12 months |
| `transaction_ledger` | RANGE by quarter on `transaction_date` | indefinite; archive after 5 years |
| `otp_codes` | RANGE by week on `created_at` | 7 days; pruned weekly |

---

## 6. Security Architecture

### 6.1 Trust boundaries

```mermaid
flowchart LR
    subgraph Untrusted["Untrusted zone"]
        Browser["Browser (any internal staff device)"]
    end

    subgraph Edge["Edge / TLS termination"]
        WAF["WAF / reverse proxy<br/>TLS 1.3"]
    end

    subgraph App["Application zone (private subnet)"]
        PHP_T["PHP :8000"]
        NODE_T["Node :8001"]
    end

    subgraph Data["Data zone (private subnet, no public route)"]
        DB_T[("MySQL")]
        RD_T[("Redis")]
    end

    Browser <-->|"HTTPS only<br/>httpOnly cookies<br/>HSTS + CSP"| WAF
    WAF <-->|"mTLS internal"| PHP_T
    WAF <-->|"mTLS internal"| NODE_T
    PHP_T <-->|"private only"| DB_T
    PHP_T <-->|"private only"| RD_T
    NODE_T <-->|"private only"| DB_T
    NODE_T <-->|"private only"| RD_T
```

### 6.2 Auth & RBAC chain (Phase -1 / P-1.2)

Every protected request passes through:

1. **TLS termination** at WAF
2. **JwtMiddleware** — verifies signature + expiry, checks Redis revocation by `jti`
3. **PermissionMiddleware** — calls `has_role(user.id, required_role)` SP, caches result in Redis 300s
4. **IdempotencyMiddleware** — for mutating verbs, dedupes by `Idempotency-Key`
5. Controller / route handler

If any step fails: 401 / 403 / 423 / 429 as appropriate — never silent fall-through.

### 6.3 Secret management

| Secret | Storage | Rotation |
|---|---|---|
| JWT signing key | KMS / Vault (target) | Every 90 days |
| Redis password | KMS / Vault | Every 90 days |
| MySQL credentials | KMS / Vault per role (RW vs RO) | Every 90 days |
| SMS gateway API key | KMS / Vault | Provider policy |
| External API keys (GPShop, LocationChange, RealIP) | KMS / Vault | Provider policy |

`.env` files are dev-only. Production secrets injected at process start.

### 6.4 PII handling

- **In transit:** TLS 1.3 everywhere; mTLS between internal services
- **At rest:** MySQL transparent data encryption on backups (XtraBackup `--encrypt`); Redis with TLS + auth
- **In logs:** OTP, JWT, NID, and full MSISDN must be redacted before write (regex middleware on log writer)
- **PII columns:** `customers.nid`, `customers.contact_number`, `user_account.contact_number` — column-level access controls; only specific roles can SELECT raw values via stored procedures
- **Right-to-erasure:** documented as post-launch compliance work; out of Phase -1 scope

---

## 7. Scale & Performance

### 7.1 Target capacity

| Dimension | 5-year target |
|---|---|
| GPFI customer records | 3–10M |
| `active_services` rows | 5–20M (some customers have multiple) |
| `orders` rows | 50M+ |
| `transaction_ledger` rows | low hundreds of millions |
| `audit_logs` rows | low billions (mitigated by partition + archive) |
| Concurrent internal users | 20k peak |
| Orders/day peak | ~50k |
| WS dashboard concurrent | up to 2k managers |

### 7.2 Hot paths and mitigations

| Path | Hot data | Mitigation |
|---|---|---|
| Customer 360 lookup | Customer + anchors + active_services + addons + cpe + ott + loc history + real IP | Redis read-through cache 60s TTL; replica read |
| Product catalog read | products + price_versions (CURRENT) | Redis cache, invalidate on price version add |
| RBAC check | `has_role()` result | Redis per-user 300s |
| Geography hierarchy | circles → … → areas | Redis cache 24h, invalidate on master-data update |
| Dashboard WS push | scoped state per manager | Replica read; broadcast every 10s only when delta detected |

### 7.3 Queue (Phase -1 / P-1.7)

```mermaid
flowchart LR
    subgraph Producers
        AUTOCANCEL["addon auto-cancel scheduler"]
        AUTOUNASSIGN["real-IP auto-unassign scheduler"]
        SMS_R["SMS retry"]
        WEBHOOK["external webhook handler"]
    end

    subgraph Queue["Laravel Horizon (Redis-backed)"]
        Q1["queue:default"]
        Q2["queue:sms"]
        Q3["queue:external-api"]
        DLQ["DLQ (failed jobs)"]
    end

    subgraph Workers
        W["Horizon workers<br/>auto-scaled"]
    end

    AUTOCANCEL --> Q1
    AUTOUNASSIGN --> Q1
    SMS_R --> Q2
    WEBHOOK --> Q3
    Q1 --> W
    Q2 --> W
    Q3 --> W
    W -.->|"on N failures"| DLQ
```

Replaces the daily Artisan crons referenced in `docs/plan.md` Phase 2.

---

## 8. External Integrations

| System | Direction | Protocol | Service class | Env flag | Default |
|---|---|---|---|---|---|
| GPShop | PHP → external | HTTPS REST | `GpShopService` (mock) / `GpShopApiService` (real stub) | `GPSHOP_MOCK` | mock |
| Location Change | PHP → external | HTTPS REST | `LocationChangeApiService` / `LocationChangeApiRealService` | `LOCATION_CHANGE_API_MOCK` | mock |
| Real IP provisioning | PHP → external | HTTPS REST | `RealIpApiService` / `RealIpApiRealService` | `REAL_IP_API_MOCK` | mock |
| Customer Lifecycle | PHP → external | HTTPS REST | `CustomerLifecycleService` / `CustomerLifecycleApiService` | `CUSTOMER_LIFECYCLE_MOCK` | mock |
| SMS gateway | PHP → external | HTTPS REST | `SmsService` | (gateway URL in env) | n/a |
| Node ↔ PHP | Node → PHP internal | HTTPS REST | `phpBridge.js` → `InternalController` (guarded by `InternalKeyMiddleware`) | n/a | always real |
| Reporting (Metabase) | external read-only | MySQL replica | n/a | n/a | post-launch |

**Resilience pattern (target):** every external call wrapped in a circuit breaker; failures emit to queue with retry budget; status visible in Horizon dashboard.

---

## 9. Observability (target)

| Concern | Tool |
|---|---|
| Metrics | Prometheus + Grafana |
| Logs | Loki (or ELK) — structured JSON with trace_id, redacted PII |
| Tracing | OpenTelemetry → Jaeger or Tempo |
| Alerting | Alertmanager → on-call rotation (PagerDuty / OpsGenie) |
| Queue health | Laravel Horizon dashboard |
| Slow queries | MySQL slow log + pt-query-digest weekly |
| RBAC / auth audit | `audit_logs` table + log shipping |

**SLOs (target, draft):**
- API p95 latency: 300 ms
- API error rate: < 0.1 %
- WS message delivery: < 2 s
- Order write success: ≥ 99.9 %

---

## 10. Deployment Topology

```mermaid
flowchart TB
    subgraph DC["GP datacenter (Bangladesh — data residency)"]
        subgraph LB_Z["Edge zone"]
            WAF["WAF + TLS termination<br/>HSTS + CSP + rate limit"]
        end

        subgraph App_Z["App zone (private subnet)"]
            PHP_A["PHP nodes (N=3, auto-scaled)"]
            NODE_A["Node nodes (N=2, sticky-session LB)"]
            HORIZON["Horizon worker pool"]
        end

        subgraph Data_Z["Data zone (private subnet)"]
            PRIMARY[("MySQL primary")]
            R1[("MySQL replica 1")]
            R2[("MySQL replica 2")]
            REDIS_C[("Redis cluster")]
            VAULT["Secrets manager"]
        end

        subgraph Obs["Observability"]
            PROM["Prometheus"]
            GRAF["Grafana"]
            LOKI["Loki"]
            OTEL["OTel collector"]
        end
    end

    Internet((Internet)) -->|"corporate VPN<br/>or SSO"| WAF
    WAF --> PHP_A
    WAF --> NODE_A
    PHP_A --> Data_Z
    NODE_A --> Data_Z
    HORIZON --> Data_Z
    PHP_A -.-> OBS_E["telemetry"]
    NODE_A -.-> OBS_E
    HORIZON -.-> OBS_E
    OBS_E --> Obs
```

**Notes:**
- Data residency in Bangladesh per BTRC expectations (subject to legal review — see `docs/SupremeFlex_Consolidated_Requirements.md` §11.6)
- Sticky sessions on Node LB required for WS dashboard until Redis pub/sub fan-out is added (phase 2 of P-1.7)
- Horizon worker pool sized independently from API pool

---

## 11. Architecture Decision Log

| # | Decision | Rationale | Phase |
|---|---|---|---|
| ADR-001 | Two-backend split (PHP CRUD vs Node field/WS) | PHP team familiarity; Node for WS/streaming; clear domain boundaries | Existing |
| ADR-002 | Single MySQL for both backends | Simplicity at current scale; revisit if Node domains diverge | Existing — to revisit post Phase -1 |
| ADR-003 | UUIDv7 / `BINARY(16)` PKs replace `CHAR(36) UUID()` | Time-ordered insertion → no page splits; 4–5× smaller indexes; better joins | Phase -1 / P-1.1 |
| ADR-004 | JWT in httpOnly cookies, not localStorage | localStorage is XSS-stealable; cookie with SameSite=Strict + CSRF is industry standard | Phase -1 / P-1.2 |
| ADR-005 | Access (15m) + refresh (7d) + revocation list | Short access tokens contain blast radius; revocation enables immediate de-provision | Phase -1 / P-1.2 |
| ADR-006 | `Idempotency-Key` header required on mutating endpoints | Mobile retries must not duplicate orders / IP assignments / stock transfers | Phase -1 / P-1.3 |
| ADR-007 | Drupal removed from architecture | `/drupal/` is empty; CVE / patch cost not justified for "configurable texts" | Phase -1 / P-1.6 |
| ADR-008 | Reporting via Metabase post-launch (not Drupal) | Read-only BI behind SSO + read replica; minimal new attack surface | Post-launch |
| ADR-009 | Laravel Horizon (Redis queue) replaces daily Artisan crons | Daily crons saturate at scale; queue enables retry/DLQ/observability | Phase -1 / P-1.7 |
| ADR-010 | Monthly RANGE partitioning on `audit_logs`, `transaction_ledger`, `otp_codes` | Bounded table scan; trivial archival; predictable backup size | Phase -1 / P-1.7 |
| ADR-011 | `has_role()` SP remains DB-side; result cached 300s in Redis | Keeps RBAC source-of-truth in DB; cache absorbs the latency cost | Phase -1 / P-1.2 |
| ADR-012 | WebSocket auth via JWT in subprotocol (not query string) | Query strings get logged; subprotocol is the standards-conformant location | Phase -1 / P-1.2 |
| ADR-013 | All four external APIs ship as mock + real-stub behind interface | Toggleable via env; production guard prevents accidental mock | Existing (P0 / E0) — hardened by P-1.5 |

---

## 12. Open Architecture Questions

These need decisions before BLOCK A begins:

1. **WAF choice** — Cloudflare, AWS WAF, on-prem (modsecurity)? Affects edge security posture.
2. **Reporting DB user permissions** — Read-only on which schemas / which tables? Affects Metabase rollout.
3. **Horizon vs Sidekiq-style alternatives** — Confirm Horizon meets ops needs; alternative is a separate Node-based queue.
4. **MySQL flavor** — Vanilla MySQL 8.0, Percona, or MariaDB? Affects backup tooling and ProxySQL behavior.
5. **mTLS internally** — Required from day 1, or first deploy without and add later?
6. **Multi-region** — Post-launch; do we plan for Bangladesh-only or BD + DR region?

Each question deserves an ADR before Phase -1 deployment work begins.

---

**Maintenance:** Update this document whenever architecture changes (component added/removed, topology revised, ADR added). Treat as code: PR review required for changes to §1–§10. §11 (ADRs) is append-only.
