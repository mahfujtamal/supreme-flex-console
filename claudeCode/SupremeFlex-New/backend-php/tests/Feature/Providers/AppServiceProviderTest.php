<?php

namespace Tests\Feature\Providers;

use App\Providers\AppServiceProvider;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class AppServiceProviderTest extends TestCase
{
    protected function tearDown(): void
    {
        putenv('OTP_DEV_PEEK_ENABLED=');
        parent::tearDown();
    }

    private function provider(): AppServiceProvider
    {
        return new AppServiceProvider($this->app);
    }

    private function setProduction(): void
    {
        Config::set('app.env', 'production');
        Config::set([
            'mock_services.gpshop'             => false,
            'mock_services.location_change'    => false,
            'mock_services.real_ip'            => false,
            'mock_services.customer_lifecycle' => false,
            'app.debug'                        => false,
        ]);
        putenv('OTP_DEV_PEEK_ENABLED=');
    }

    public function test_boot_skips_in_non_production(): void
    {
        // phpunit.xml sets APP_ENV=testing — boot() returns early without checking flags
        $this->provider()->boot();
        $this->assertTrue(true);
    }

    public function test_boot_passes_in_production_when_all_flags_disabled(): void
    {
        $this->setProduction();
        $this->provider()->boot();
        $this->assertTrue(true);
    }

    public function test_boot_throws_when_GPSHOP_MOCK_enabled(): void
    {
        $this->setProduction();
        Config::set('mock_services.gpshop', true);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('[FATAL] GPSHOP_MOCK');
        $this->provider()->boot();
    }

    public function test_boot_throws_when_LOCATION_CHANGE_API_MOCK_enabled(): void
    {
        $this->setProduction();
        Config::set('mock_services.location_change', true);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('[FATAL] LOCATION_CHANGE_API_MOCK');
        $this->provider()->boot();
    }

    public function test_boot_throws_when_REAL_IP_API_MOCK_enabled(): void
    {
        $this->setProduction();
        Config::set('mock_services.real_ip', true);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('[FATAL] REAL_IP_API_MOCK');
        $this->provider()->boot();
    }

    public function test_boot_throws_when_CUSTOMER_LIFECYCLE_MOCK_enabled(): void
    {
        $this->setProduction();
        Config::set('mock_services.customer_lifecycle', true);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('[FATAL] CUSTOMER_LIFECYCLE_MOCK');
        $this->provider()->boot();
    }

    public function test_boot_throws_when_APP_DEBUG_enabled(): void
    {
        $this->setProduction();
        Config::set('app.debug', true);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('[FATAL] APP_DEBUG');
        $this->provider()->boot();
    }

    public function test_boot_throws_when_OTP_DEV_PEEK_ENABLED(): void
    {
        $this->setProduction();
        putenv('OTP_DEV_PEEK_ENABLED=true');
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('[FATAL] OTP_DEV_PEEK_ENABLED');
        $this->provider()->boot();
    }

    public function test_boot_throws_on_first_violation_when_multiple_flags_enabled(): void
    {
        $this->setProduction();
        Config::set('mock_services.gpshop', true);
        Config::set('mock_services.location_change', true);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('[FATAL] GPSHOP_MOCK'); // first in $banned array
        $this->provider()->boot();
    }
}
