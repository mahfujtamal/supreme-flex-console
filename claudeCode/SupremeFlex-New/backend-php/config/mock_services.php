<?php

return [
    'gpshop'             => (bool) env('GPSHOP_MOCK', true),
    'location_change'    => (bool) env('LOCATION_CHANGE_API_MOCK', true),
    'real_ip'            => (bool) env('REAL_IP_API_MOCK', true),
    'customer_lifecycle' => (bool) env('CUSTOMER_LIFECYCLE_MOCK', true),
];
