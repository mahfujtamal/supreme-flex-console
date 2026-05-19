<?php

namespace App\Services;

use App\Services\Contracts\LocationChangeApiServiceInterface;
use Illuminate\Support\Str;

class LocationChangeApiService implements LocationChangeApiServiceInterface
{
    public function callLocationChangeApi(string $customerId, string $fromTac, string $toTac, array $options = []): array
    {
        return [
            'success'      => true,
            'reference_id' => (string) Str::uuid(),
            'message'      => 'Location change request accepted',
        ];
    }
}
