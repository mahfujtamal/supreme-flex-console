<?php

namespace App\Services;

use App\Services\Contracts\CustomerLifecycleServiceInterface;

class CustomerLifecycleService implements CustomerLifecycleServiceInterface
{
    public function getStatus(string $customerId, string $anchorId): string
    {
        return 'Active';
    }
}
