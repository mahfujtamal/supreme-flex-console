<?php

return [
    'mock'     => env('SMS_MOCK', true),
    'base_url' => env('SMS_BASE_URL', 'https://sms.example.com/api'),
    'api_key'  => env('SMS_API_KEY', ''),
    'sender'   => env('SMS_SENDER_ID', 'GPFI'),
];
