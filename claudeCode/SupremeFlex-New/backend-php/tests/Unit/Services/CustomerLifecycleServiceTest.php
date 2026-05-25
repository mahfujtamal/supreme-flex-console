<?php

namespace Tests\Unit\Services;

use App\Services\Contracts\CustomerLifecycleServiceInterface;
use App\Services\CustomerLifecycleService;
use Tests\TestCase;

class CustomerLifecycleServiceTest extends TestCase
{
    private CustomerLifecycleService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new CustomerLifecycleService();
    }

    public function test_implements_interface(): void
    {
        $this->assertInstanceOf(CustomerLifecycleServiceInterface::class, $this->svc);
    }

    public function test_get_status_returns_non_empty_string(): void
    {
        $result = $this->svc->getStatus('cust-1', 'anch-1');
        $this->assertIsString($result);
        $this->assertNotEmpty($result);
    }
}
