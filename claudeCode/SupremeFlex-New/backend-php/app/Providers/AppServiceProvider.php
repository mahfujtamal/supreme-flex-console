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
