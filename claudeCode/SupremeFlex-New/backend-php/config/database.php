<?php

return [
    'default' => env('DB_CONNECTION', 'mysql'),

    'connections' => [
        'mysql' => [
            'driver'    => 'mysql',
            'read'      => [
                'host' => array_filter([
                    env('DB_HOST_REPLICA_1', env('DB_HOST', '127.0.0.1')),
                    env('DB_HOST_REPLICA_2'),
                ]),
            ],
            'write'     => [
                'host' => env('DB_HOST', '127.0.0.1'),
            ],
            'sticky'    => true, // use write connection for remainder of request after any write
            'port'      => env('DB_PORT', '3306'),
            'database'  => env('DB_DATABASE', 'supremeflex'),
            'username'  => env('DB_USERNAME', 'root'),
            'password'  => env('DB_PASSWORD', ''),
            'charset'   => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix'    => '',
            'strict'    => true,
            'engine'    => null,
            'timezone'  => '+00:00',
            'options'   => extension_loaded('pdo_mysql') ? array_filter([
                Pdo\Mysql::ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        // Used by PHPUnit (see phpunit.xml)
        'sqlite' => [
            'driver'   => 'sqlite',
            'database' => env('DB_DATABASE', ':memory:'),
            'prefix'   => '',
        ],
    ],

    'migrations' => 'migrations',

    'redis' => [
        'client'  => env('REDIS_CLIENT', 'predis'),
        'options' => [
            'prefix' => env('REDIS_PREFIX', 'sf_'),
        ],
        'default' => [
            'url'      => env('REDIS_URL'),
            'host'     => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD'),
            'port'     => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
        ],
        'cache' => [
            'url'      => env('REDIS_URL'),
            'host'     => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD'),
            'port'     => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_CACHE_DB', '1'),
        ],
        'horizon' => [
            'url'      => env('REDIS_URL'),
            'host'     => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD'),
            'port'     => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_HORIZON_DB', '2'),
        ],
    ],
];
