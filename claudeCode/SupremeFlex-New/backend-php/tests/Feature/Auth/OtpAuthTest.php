<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class OtpAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Redis::flushdb();

        // Create the tables needed for auth (SQLite in-memory)
        DB::statement('CREATE TABLE IF NOT EXISTS user_account (
            id         BLOB NOT NULL PRIMARY KEY,
            user_name  TEXT NOT NULL,
            contact_number TEXT NOT NULL UNIQUE,
            staff_type TEXT NOT NULL DEFAULT "CS"
        )');

        DB::statement('CREATE TABLE IF NOT EXISTS otp_codes (
            id             BLOB NOT NULL PRIMARY KEY,
            contact_number TEXT NOT NULL,
            code_hash      TEXT NOT NULL,
            salt           TEXT NOT NULL,
            expires_at     DATETIME NOT NULL,
            used           INTEGER NOT NULL DEFAULT 0,
            created_at     DATETIME NOT NULL
        )');
    }

    private function seedUser(string $msisdn = '01700000001'): string
    {
        $id = \App\Helpers\Uuid::make();
        DB::table('user_account')->insert([
            'id'             => $id,
            'user_name'      => 'Test User',
            'contact_number' => $msisdn,
            'staff_type'     => 'CS',
        ]);
        return $id;
    }

    // ── OTP Request ──────────────────────────────────────────────

    public function test_otp_request_returns_200_when_user_exists(): void
    {
        $this->seedUser('01700000001');

        $response = $this->postJson('/api/auth/otp/request', [
            'contact_number' => '01700000001',
        ]);

        $response->assertStatus(200)
                 ->assertJson(['message' => 'OTP sent']);
    }

    public function test_otp_request_returns_404_when_user_not_found(): void
    {
        $response = $this->postJson('/api/auth/otp/request', [
            'contact_number' => '01999999999',
        ]);

        $response->assertStatus(404)
                 ->assertJson(['message' => 'No account found for this number']);
    }

    public function test_otp_request_rate_limits_after_five_requests(): void
    {
        $msisdn = '01700000002';
        $this->seedUser($msisdn);

        // Simulate 5 prior requests by setting Redis counter
        Redis::set("otp_req:{$msisdn}", 5);

        $response = $this->postJson('/api/auth/otp/request', [
            'contact_number' => $msisdn,
        ]);

        $response->assertStatus(429);
    }

    // ── OTP Verify ───────────────────────────────────────────────

    public function test_verify_returns_401_on_wrong_code(): void
    {
        $msisdn = '01700000003';
        $this->seedUser($msisdn);

        // Insert a valid OTP row with a known hash
        $salt = bin2hex(random_bytes(16));
        $hash = hash('sha256', '123456' . $salt);
        DB::table('otp_codes')->insert([
            'id'             => \App\Helpers\Uuid::make(),
            'contact_number' => $msisdn,
            'code_hash'      => $hash,
            'salt'           => $salt,
            'expires_at'     => now()->addMinutes(5),
            'used'           => 0,
            'created_at'     => now(),
        ]);

        $response = $this->postJson('/api/auth/otp/verify', [
            'contact_number' => $msisdn,
            'code'           => '000000', // wrong
        ]);

        $response->assertStatus(401);
    }

    public function test_verify_lockout_after_five_failed_attempts(): void
    {
        $msisdn = '01700000004';
        $this->seedUser($msisdn);

        // Simulate lockout counter at threshold
        Redis::set("otp_lock:{$msisdn}", 5);

        $response = $this->postJson('/api/auth/otp/verify', [
            'contact_number' => $msisdn,
            'code'           => '000000',
        ]);

        $response->assertStatus(423);
    }

    public function test_verify_returns_200_with_access_token_on_success(): void
    {
        $msisdn = '01700000005';
        $this->seedUser($msisdn);

        $code = '654321';
        $salt = bin2hex(random_bytes(16));
        $hash = hash('sha256', $code . $salt);

        DB::table('otp_codes')->insert([
            'id'             => \App\Helpers\Uuid::make(),
            'contact_number' => $msisdn,
            'code_hash'      => $hash,
            'salt'           => $salt,
            'expires_at'     => now()->addMinutes(5),
            'used'           => 0,
            'created_at'     => now(),
        ]);

        $response = $this->postJson('/api/auth/otp/verify', [
            'contact_number' => $msisdn,
            'code'           => $code,
        ]);

        $response->assertStatus(200)
                 ->assertJsonStructure(['access_token', 'user']);

        // Cookies set
        $this->assertNotNull($response->headers->getCookies());
    }
}
