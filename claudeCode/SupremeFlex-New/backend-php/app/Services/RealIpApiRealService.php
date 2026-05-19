<?php

namespace App\Services;

use App\Services\Contracts\RealIpApiServiceInterface;

class RealIpApiRealService implements RealIpApiServiceInterface
{
    public function provisionIp(string $customerId, string $msisdn): array
    {
        throw new \RuntimeException(
            'RealIpApiRealService: real HTTP integration not implemented. Set REAL_IP_API_MOCK=true.'
        );
    }

    public function unassignIp(string $ipAddress): array
    {
        throw new \RuntimeException(
            'RealIpApiRealService: real HTTP integration not implemented. Set REAL_IP_API_MOCK=true.'
        );
    }
}
