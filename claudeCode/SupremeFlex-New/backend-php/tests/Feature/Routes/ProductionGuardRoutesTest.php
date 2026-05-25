<?php

namespace Tests\Feature\Routes;

use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ProductionGuardRoutesTest extends TestCase
{
    private ?Router $originalRouter = null;

    protected function tearDown(): void
    {
        if ($this->originalRouter !== null) {
            $this->app->instance('router', $this->originalRouter);
            Route::setFacadeApplication($this->app);
        }
        Config::set('app.env', 'testing');
        $this->app['env'] = 'testing';
        parent::tearDown();
    }

    private function reloadRoutesAs(string $env): Router
    {
        $this->originalRouter = $this->app['router'];

        $freshRouter = new Router($this->app['events'], $this->app);
        $this->app->instance('router', $freshRouter);
        Route::setFacadeApplication($this->app);

        $this->app['env'] = $env;
        Config::set('app.env', $env);

        require base_path('routes/api.php');

        return $freshRouter;
    }

    private function hasBulkDeleteRoutes(Router $router): bool
    {
        return collect($router->getRoutes()->getRoutes())
            ->contains(fn ($r) =>
                in_array('DELETE', $r->methods()) && str_ends_with($r->uri(), '/bulk')
            );
    }

    // ── Bulk-delete routes ───────────────────────────────────────────────────

    public function test_bulk_delete_routes_registered_in_testing_env(): void
    {
        // phpunit.xml sets APP_ENV=testing — routes must be present
        $this->assertFalse(app()->environment('production'));

        $response = $this->deleteJson('/api/network-zones/bulk');
        $response->assertStatus(401); // route exists, but no JWT
    }

    public function test_bulk_delete_routes_absent_in_production(): void
    {
        $router = $this->reloadRoutesAs('production');

        $this->assertFalse($this->hasBulkDeleteRoutes($router));
    }

    // ── OTP dev-peek route ───────────────────────────────────────────────────

    public function test_otp_dev_peek_route_registered_in_testing_env(): void
    {
        $this->assertFalse(app()->environment('production'));

        $response = $this->getJson('/api/auth/otp/dev-peek');
        $response->assertStatus(422); // route exists, missing required body
    }

    public function test_otp_dev_peek_route_absent_in_production(): void
    {
        $router = $this->reloadRoutesAs('production');

        $devPeekExists = collect($router->getRoutes()->getRoutes())
            ->contains(fn ($r) => str_ends_with($r->uri(), 'otp/dev-peek'));

        $this->assertFalse($devPeekExists);
    }
}
