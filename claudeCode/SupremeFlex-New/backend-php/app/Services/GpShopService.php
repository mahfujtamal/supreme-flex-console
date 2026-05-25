<?php

namespace App\Services;

use App\Services\Contracts\GpShopServiceInterface;

class GpShopService implements GpShopServiceInterface
{
    public function createOrder(string $customerId, string $addonProductId, array $options = []): array
    {
        return [
            'gpshop_order_id'         => \Ramsey\Uuid\Uuid::uuid7()->toString(),
            'status'                  => 'PENDING',
            'estimated_delivery_days' => 3,
            'message'                 => 'Order created in GPShop',
        ];
    }

    public function getOrderStatus(string $gpshopOrderId): array
    {
        return [
            'gpshop_order_id' => $gpshopOrderId,
            'status'          => 'PROCESSING',
        ];
    }

    public function cancelOrder(string $gpshopOrderId): array
    {
        return [
            'gpshop_order_id' => $gpshopOrderId,
            'success'         => true,
            'cancelled_at'    => now()->toIso8601String(),
        ];
    }
}
