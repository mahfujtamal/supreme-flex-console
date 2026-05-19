<?php

namespace App\Services\Contracts;

interface LocationChangeApiServiceInterface
{
    public function callLocationChangeApi(string $customerId, string $fromTac, string $toTac, array $options = []): array;
}
