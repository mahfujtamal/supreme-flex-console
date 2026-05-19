<?php

namespace App\Services;

use App\Services\Contracts\LocationChangeApiServiceInterface;

class LocationChangeApiRealService implements LocationChangeApiServiceInterface
{
    public function callLocationChangeApi(string $customerId, string $fromTac, string $toTac, array $options = []): array
    {
        throw new \RuntimeException(
            'LocationChangeApiRealService: real HTTP integration not implemented. Set LOCATION_CHANGE_API_MOCK=true.'
        );
    }
}
