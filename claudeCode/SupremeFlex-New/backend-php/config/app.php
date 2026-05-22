<?php

return [
    'name'       => env('APP_NAME', 'SupremeFlex'),
    'env'        => env('APP_ENV', 'production'),
    'debug'      => (bool) env('APP_DEBUG', false),
    'url'        => env('APP_URL', 'http://localhost'),
    'timezone'   => env('APP_TIMEZONE', 'UTC'),
    'locale'     => env('APP_LOCALE', 'en'),
    'key'        => env('APP_KEY'),
    'cipher'     => 'AES-256-CBC',
    'jwt_secret' => env('JWT_SECRET'),
];
