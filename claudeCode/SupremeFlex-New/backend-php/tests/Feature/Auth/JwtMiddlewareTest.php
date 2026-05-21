<?php

namespace Tests\Feature\Auth;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class JwtMiddlewareTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Redis::fake();

        // Register a protected test route
        Route::middleware('auth.jwt')
             ->get('/test-jwt-protected', fn() => response()->json(['ok' => true]));
    }

    private function makeToken(array $overrides = []): string
    {
        $payload = array_merge([
            'sub' => '01900000-0000-7000-8000-000000000001',
            'jti' => 'test-jti-abc123',
            'iat' => time(),
            'exp' => time() + 900,
        ], $overrides);

        return JWT::encode($payload, config('app.jwt_secret'), 'HS256');
    }

    public function test_request_without_token_returns_401(): void
    {
        $this->getJson('/test-jwt-protected')
             ->assertStatus(401);
    }

    public function test_request_with_valid_token_passes_through(): void
    {
        $token = $this->makeToken();

        $this->withToken($token)
             ->getJson('/test-jwt-protected')
             ->assertStatus(200)
             ->assertJson(['ok' => true]);
    }

    public function test_revoked_jti_returns_401(): void
    {
        $jti   = 'revoked-jti-xyz';
        $token = $this->makeToken(['jti' => $jti]);

        // Mark jti as revoked in fake Redis
        Redis::set("jwt_rev:{$jti}", '1');

        $this->withToken($token)
             ->getJson('/test-jwt-protected')
             ->assertStatus(401)
             ->assertJson(['message' => 'Token has been revoked']);
    }

    public function test_expired_token_returns_401(): void
    {
        $token = $this->makeToken([
            'iat' => time() - 1000,
            'exp' => time() - 100, // expired
        ]);

        $this->withToken($token)
             ->getJson('/test-jwt-protected')
             ->assertStatus(401);
    }
}
