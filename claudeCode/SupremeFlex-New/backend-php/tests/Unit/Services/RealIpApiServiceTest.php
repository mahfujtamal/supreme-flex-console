<?php

namespace Tests\Unit\Services;

use App\Services\Contracts\RealIpApiServiceInterface;
use App\Services\RealIpApiService;
use Tests\TestCase;

class RealIpApiServiceTest extends TestCase
{
    private RealIpApiService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new RealIpApiService();
    }

    public function test_implements_interface(): void
    {
        $this->assertInstanceOf(RealIpApiServiceInterface::class, $this->svc);
    }

    public function test_provision_ip_returns_address_and_status(): void
    {
        $result = $this->svc->provisionIp('cust-1', '01700000001');
        $this->assertArrayHasKey('ip_address', $result);
        $this->assertSame('ACTIVE', $result['status']);
        $this->assertArrayHasKey('provisioned_at', $result);
    }

    public function test_unassign_ip_returns_success_and_timestamp(): void
    {
        $result = $this->svc->unassignIp('203.0.113.55');
        $this->assertTrue($result['success']);
        $this->assertArrayHasKey('unassigned_at', $result);
    }
}
