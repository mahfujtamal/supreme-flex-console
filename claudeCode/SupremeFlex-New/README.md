# SupremeFlex — Migrated Stack

## Architecture

```
Browser (Next.js :3000)
    │  axios
    ├──► PHP/Laravel API (:8000)  — CRUD, auth, campaigns, customers
    └──► Node.js API (:8001)      — Field ops, stock transfers, WS dashboard
              │
              ▼
         MySQL Database
              │
              ▼
         Drupal CMS/BO  — configurable texts, reporting views
```

## Quick Start

### 1. MySQL
```bash
mysql -u root -p supremeflex < database/migrations/001_create_all_tables.sql
mysql -u root -p supremeflex < database/migrations/002_create_triggers.sql
mysql -u root -p supremeflex < database/migrations/003_create_stored_procedures.sql
```

### 2. PHP/Laravel Backend
```bash
cd backend-php
composer create-project laravel/laravel .
composer require firebase/php-jwt
cp .env.example .env && php artisan key:generate
# Copy app/ and routes/ from this scaffold into the Laravel project
php artisan serve --port=8000
```

### 3. Node.js Backend
```bash
cd backend-node
npm install
cp .env.example .env
npm run dev   # port 8001
```

### 4. Next.js Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev   # port 3000
```

## Ports

| Service | Port |
|---|---|
| Next.js frontend | 3000 |
| PHP/Laravel API | 8000 |
| Node.js API + WebSocket | 8001 |
| MySQL | 3306 |
| Drupal | 8080 (or separate) |
