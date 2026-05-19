<?php

namespace App\Services;

use App\Services\Contracts\GpShopServiceInterface;

class GpShopApiService implements GpShopServiceInterface
{
    public function createOrder(string $customerId, string $addonProductId, array $options = []): array
    {
        throw new \RuntimeException(
            'GpShopApiService: real HTTP integration not implemented. Set GPSHOP_MOCK=true.'
        );
    }

    public function getOrderStatus(string $gpshopOrderId): array
    {
        throw new \RuntimeException(
            'GpShopApiService: real HTTP integration not implemented. Set GPSHOP_MOCK=true.'
        );
    }

    public function cancelOrder(string $gpshopOrderId): array
    {
        throw new \RuntimeException(
            'GpShopApiService: real HTTP integration not implemented. Set GPSHOP_MOCK=true.'
        );
    }
}
