<?php

namespace App\Services\Contracts;

interface GpShopServiceInterface
{
    public function createOrder(string $customerId, string $addonProductId, array $options = []): array;
    public function getOrderStatus(string $gpshopOrderId): array;
    public function cancelOrder(string $gpshopOrderId): array;
}
