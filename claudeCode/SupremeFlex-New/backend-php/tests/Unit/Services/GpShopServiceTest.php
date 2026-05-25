<?php

namespace Tests\Unit\Services;

use App\Services\Contracts\GpShopServiceInterface;
use App\Services\GpShopService;
use Tests\TestCase;

class GpShopServiceTest extends TestCase
{
    private GpShopService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new GpShopService();
    }

    public function test_implements_interface(): void
    {
        $this->assertInstanceOf(GpShopServiceInterface::class, $this->svc);
    }

    public function test_create_order_returns_required_keys(): void
    {
        $result = $this->svc->createOrder('cust-1', 'prod-1');
        $this->assertArrayHasKey('gpshop_order_id', $result);
        $this->assertArrayHasKey('status', $result);
        $this->assertArrayHasKey('estimated_delivery_days', $result);
        $this->assertSame('PENDING', $result['status']);
        $this->assertIsString($result['gpshop_order_id']);
    }

    public function test_get_order_status_echoes_id_and_has_status(): void
    {
        $result = $this->svc->getOrderStatus('order-abc');
        $this->assertSame('order-abc', $result['gpshop_order_id']);
        $this->assertArrayHasKey('status', $result);
    }

    public function test_cancel_order_returns_success_and_timestamp(): void
    {
        $result = $this->svc->cancelOrder('order-abc');
        $this->assertSame('order-abc', $result['gpshop_order_id']);
        $this->assertTrue($result['success']);
        $this->assertArrayHasKey('cancelled_at', $result);
    }
}
