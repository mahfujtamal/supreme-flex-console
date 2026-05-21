<?php

namespace App\Services;

use App\Services\Contracts\LocationChangeApiServiceInterface;

class LocationChangeApiService implements LocationChangeApiServiceInterface
{
    public function callLocationChangeApi(string $customerId, string $fromTac, string $toTac, array $options = []): array
    {
        return [
            'success'      => true,
            'reference_id' => \Ramsey\Uuid\Uuid::uuid7()->toString(),
            'message'      => 'Location change request accepted',
        ];
    }
}
