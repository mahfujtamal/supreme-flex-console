<?php

namespace App\Services;

use App\Services\Contracts\RealIpApiServiceInterface;

class RealIpApiService implements RealIpApiServiceInterface
{
    public function provisionIp(string $customerId, string $msisdn): array
    {
        return [
            'ip_address'     => '203.0.113.55',
            'status'         => 'ACTIVE',
            'provisioned_at' => now()->toIso8601String(),
        ];
    }

    public function unassignIp(string $ipAddress): array
    {
        return [
            'success'       => true,
            'unassigned_at' => now()->toIso8601String(),
        ];
    }
}
