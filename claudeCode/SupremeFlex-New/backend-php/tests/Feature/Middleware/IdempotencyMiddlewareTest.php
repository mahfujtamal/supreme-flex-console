<?php

namespace Tests\Feature\Middleware;

use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class IdempotencyMiddlewareTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Redis::fake();

        // Register a test route protected by idempotency middleware
        Route::middleware('idempotency')
             ->post('/test-idempotency', fn() => response()->json(['ok' => true], 201));
    }

    public function test_missing_idempotency_key_returns_422(): void
    {
        $this->postJson('/test-idempotency', ['data' => 'anything'])
             ->assertStatus(422)
             ->assertJson(['message' => 'Idempotency-Key header required']);
    }

    public function test_first_request_executes_and_returns_201(): void
    {
        $this->postJson('/test-idempotency', ['data' => 'first'], [
            'Idempotency-Key' => 'unique-key-001',
        ])->assertStatus(201)
          ->assertJson(['ok' => true]);
    }

    public function test_duplicate_key_same_body_returns_cached_response(): void
    {
        $key  = 'unique-key-002';
        $body = ['data' => 'same'];

        // First request — executes
        $this->postJson('/test-idempotency', $body, ['Idempotency-Key' => $key])
             ->assertStatus(201);

        // Duplicate — must return cached response with replay header
        $second = $this->postJson('/test-idempotency', $body, ['Idempotency-Key' => $key]);
        $second->assertStatus(201)
               ->assertHeader('X-Idempotency-Replayed', 'true');
    }

    public function test_duplicate_key_different_body_returns_409(): void
    {
        $key = 'unique-key-003';

        // First request
        $this->postJson('/test-idempotency', ['data' => 'original'], ['Idempotency-Key' => $key])
             ->assertStatus(201);

        // Same key, different body
        $this->postJson('/test-idempotency', ['data' => 'changed'], ['Idempotency-Key' => $key])
             ->assertStatus(409)
             ->assertJson(['message' => 'Idempotency-Key reused with a different request body']);
    }

    public function test_in_flight_key_returns_409(): void
    {
        $key     = 'in-flight-key-004';
        $bodyHash = hash('sha256', json_encode(['data' => 'flying']));

        // Simulate an in-flight record in Redis
        Redis::set("idem:{$key}", json_encode([
            'status'    => 'in_flight',
            'body_hash' => $bodyHash,
        ]));

        $this->postJson('/test-idempotency', ['data' => 'flying'], ['Idempotency-Key' => $key])
             ->assertStatus(409)
             ->assertJson(['message' => 'Request with this Idempotency-Key is already in progress']);
    }
}
