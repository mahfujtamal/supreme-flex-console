# SupremeFlex — Laravel Backend

## Setup

```bash
composer create-project laravel/laravel .
composer require firebase/php-jwt

cp .env.example .env
php artisan key:generate
# Add JWT_SECRET to .env
```

## Register Middleware

In `bootstrap/app.php` (Laravel 11+):
```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias(['auth.jwt' => \App\Http\Middleware\JwtMiddleware::class]);
})
```

## Run

```bash
php artisan serve --port=8000
```

## API Base URL

`http://localhost:8000/api`

## Auth Flow

1. `POST /api/auth/login` with `{ email, password }` → returns JWT token
2. Pass token as `Authorization: Bearer <token>` on all subsequent requests
