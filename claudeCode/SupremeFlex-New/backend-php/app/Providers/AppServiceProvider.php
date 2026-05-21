<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\Contracts\GpShopServiceInterface;
use App\Services\Contracts\LocationChangeApiServiceInterface;
use App\Services\Contracts\RealIpApiServiceInterface;
use App\Services\Contracts\CustomerLifecycleServiceInterface;
use App\Services\GpShopService;
use App\Services\GpShopApiService;
use App\Services\LocationChangeApiService;
use App\Services\LocationChangeApiRealService;
use App\Services\RealIpApiService;
use App\Services\RealIpApiRealService;
use App\Services\CustomerLifecycleService;
use App\Services\CustomerLifecycleApiService;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if (config('app.env') !== 'production') {
            return;
        }

        $banned = [
            'GPSHOP_MOCK'              => config('mock_services.gpshop'),
            'LOCATION_CHANGE_API_MOCK' => config('mock_services.location_change'),
            'REAL_IP_API_MOCK'         => config('mock_services.real_ip'),
            'CUSTOMER_LIFECYCLE_MOCK'  => config('mock_services.customer_lifecycle'),
            'APP_DEBUG'                => config('app.debug'),
        ];

        foreach ($banned as $name => $value) {
            if ($value) {
                throw new \RuntimeException(
                    "[FATAL] {$name} must not be enabled in production. Fix your .env and redeploy."
                );
            }
        }
    }

    public function register(): void
    {
        $this->app->bind(GpShopServiceInterface::class, fn () =>
            config('mock_services.gpshop')
                ? new GpShopService()
                : new GpShopApiService()
        );

        $this->app->bind(LocationChangeApiServiceInterface::class, fn () =>
            config('mock_services.location_change')
                ? new LocationChangeApiService()
                : new LocationChangeApiRealService()
        );

        $this->app->bind(RealIpApiServiceInterface::class, fn () =>
            config('mock_services.real_ip')
                ? new RealIpApiService()
                : new RealIpApiRealService()
        );

        $this->app->bind(CustomerLifecycleServiceInterface::class, fn () =>
            config('mock_services.customer_lifecycle')
                ? new CustomerLifecycleService()
                : new CustomerLifecycleApiService()
        );
    }
}
