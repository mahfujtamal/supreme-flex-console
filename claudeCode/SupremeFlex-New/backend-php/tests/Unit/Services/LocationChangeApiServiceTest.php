<?php

namespace Tests\Unit\Services;

use App\Services\Contracts\LocationChangeApiServiceInterface;
use App\Services\LocationChangeApiService;
use Tests\TestCase;

class LocationChangeApiServiceTest extends TestCase
{
    private LocationChangeApiService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new LocationChangeApiService();
    }

    public function test_implements_interface(): void
    {
        $this->assertInstanceOf(LocationChangeApiServiceInterface::class, $this->svc);
    }

    public function test_call_returns_success_and_reference_id(): void
    {
        $result = $this->svc->callLocationChangeApi('cust-1', 'tac-a', 'tac-b');
        $this->assertTrue($result['success']);
        $this->assertArrayHasKey('reference_id', $result);
        $this->assertIsString($result['reference_id']);
    }
}
