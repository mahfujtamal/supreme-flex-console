<?php

namespace App\Services\Contracts;

interface RealIpApiServiceInterface
{
    public function provisionIp(string $customerId, string $msisdn): array;
    public function unassignIp(string $ipAddress): array;
}
