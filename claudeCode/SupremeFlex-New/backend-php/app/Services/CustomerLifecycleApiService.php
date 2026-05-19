<?php

namespace App\Services;

use App\Services\Contracts\CustomerLifecycleServiceInterface;

class CustomerLifecycleApiService implements CustomerLifecycleServiceInterface
{
    public function getStatus(string $customerId, string $anchorId): string
    {
        throw new \RuntimeException(
            'CustomerLifecycleApiService: real HTTP integration not implemented. Set CUSTOMER_LIFECYCLE_MOCK=true.'
        );
    }
}
