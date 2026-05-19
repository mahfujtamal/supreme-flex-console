<?php

namespace App\Services\Contracts;

interface CustomerLifecycleServiceInterface
{
    /** @return 'Active'|'Expired' */
    public function getStatus(string $customerId, string $anchorId): string;
}
