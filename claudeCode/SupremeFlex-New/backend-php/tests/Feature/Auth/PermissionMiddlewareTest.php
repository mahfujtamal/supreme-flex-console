<?php

namespace Tests\Feature\Auth;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class PermissionMiddlewareTest extends TestCase
{
    protected string $userId = '01900000-0000-7000-8000-000000000099';

    protected function setUp(): void
    {
        parent::setUp();
        Redis::fake();

        // Register test routes that mirror the real admin-users route
        Route::middleware(['auth.jwt', 'permission:admin'])
             ->get('/test-admin-only', fn() => response()->json(['ok' => true]));
    }

    private function makeToken(string $sub): string
    {
        return JWT::encode([
            'sub' => $sub,
            'jti' => 'perm-test-jti',
            'iat' => time(),
            'exp' => time() + 900,
        ], config('app.jwt_secret'), 'HS256');
    }

    public function test_user_without_admin_role_receives_403(): void
    {
        // Cache a "not allowed" result for this user+role
        Redis::set("rbac:{$this->userId}:admin", '0');

        $this->withToken($this->makeToken($this->userId))
             ->getJson('/test-admin-only')
             ->assertStatus(403)
             ->assertJson(['message' => 'Forbidden']);
    }

    public function test_user_with_admin_role_receives_200(): void
    {
        // Cache an "allowed" result — bypasses the DB stored-procedure call
        Redis::set("rbac:{$this->userId}:admin", '1');

        $this->withToken($this->makeToken($this->userId))
             ->getJson('/test-admin-only')
             ->assertStatus(200)
             ->assertJson(['ok' => true]);
    }

    public function test_permission_result_is_read_from_redis_cache(): void
    {
        // Seed allowed in Redis — DB::statement should NOT be called
        Redis::set("rbac:{$this->userId}:admin", '1');

        DB::shouldReceive('statement')->never();

        $this->withToken($this->makeToken($this->userId))
             ->getJson('/test-admin-only')
             ->assertStatus(200);
    }

    public function test_permission_cached_in_redis_on_db_hit(): void
    {
        // No Redis cache — middleware will call DB then write to Redis
        // Seed a fake result via Redis after DB call by mocking DB
        DB::shouldReceive('statement')
          ->once()
          ->with('CALL has_role(?, ?, @result)', \Mockery::any());

        DB::shouldReceive('selectOne')
          ->once()
          ->andReturn((object) ['result' => 1]);

        $this->withToken($this->makeToken($this->userId))
             ->getJson('/test-admin-only')
             ->assertStatus(200);

        // Cache should now be written with 300s TTL
        $this->assertEquals('1', Redis::get("rbac:{$this->userId}:admin"));
    }
}
