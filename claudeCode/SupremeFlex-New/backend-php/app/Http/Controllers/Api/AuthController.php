<?php

namespace App\Http\Controllers\Api;

use App\Helpers\Uuid;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Throwable;

class AuthController extends Controller
{
    private const OTP_LIMIT_PER_MSISDN = 5;
    private const OTP_LIMIT_PER_IP     = 20;
    private const OTP_LOCK_THRESHOLD   = 5;
    private const ACCESS_TTL           = 900;     // 15 minutes
    private const REFRESH_TTL          = 604800;  // 7 days

    // ── OTP Request ─────────────────────────────────────────────

    public function requestOtp(Request $request)
    {
        $request->validate(['contact_number' => 'required|string|max:20']);

        $msisdn = $request->contact_number;
        $ip     = $request->ip();

        // Rate limit: 5 requests per hour per msisdn
        $msisdnKey   = "otp_req:{$msisdn}";
        $msisdnCount = (int) Redis::get($msisdnKey);
        if ($msisdnCount >= self::OTP_LIMIT_PER_MSISDN) {
            return response()->json(['message' => 'Too many OTP requests. Try again later.'], 429);
        }

        // Rate limit: 20 requests per day per IP
        $ipKey   = "otp_req_ip:{$ip}";
        $ipCount = (int) Redis::get($ipKey);
        if ($ipCount >= self::OTP_LIMIT_PER_IP) {
            return response()->json(['message' => 'Too many OTP requests from this IP.'], 429);
        }

        $user = DB::table('user_account')->where('contact_number', $msisdn)->first();
        if (!$user) {
            return response()->json(['message' => 'No account found for this number'], 404);
        }

        // Invalidate prior unused OTPs
        DB::table('otp_codes')
            ->where('contact_number', $msisdn)
            ->where('used', 0)
            ->where('expires_at', '>', now())
            ->update(['used' => 1]);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $salt = bin2hex(random_bytes(32));
        $hash = hash('sha256', $code . $salt);

        DB::table('otp_codes')->insert([
            'id'             => Uuid::make(),
            'contact_number' => $msisdn,
            'code_hash'      => $hash,
            'salt'           => $salt,
            'expires_at'     => now()->addMinutes(5),
            'used'           => 0,
            'created_at'     => now(),
        ]);

        Log::info("OTP for {$msisdn}: {$code}");

        // Increment rate-limit counters
        $pipeline = Redis::pipeline();
        $pipeline->incr($msisdnKey);
        $pipeline->expireat($msisdnKey, now()->addHour()->timestamp);
        $pipeline->incr($ipKey);
        $pipeline->expireat($ipKey, now()->addDay()->timestamp);

        // Cache plaintext for dev-peek (non-production only)
        if (config('app.env') !== 'production') {
            $pipeline->setex("otp_dev:{$msisdn}", 300, $code);
        }

        $pipeline->execute();

        return response()->json(['message' => 'OTP sent']);
    }

    // ── Dev-Peek (registered non-production only) ────────────────

    public function devPeekOtp(Request $request)
    {
        $request->validate(['contact_number' => 'required|string|max:20']);

        $code = Redis::get("otp_dev:{$request->contact_number}");
        if (!$code) {
            return response()->json(['message' => 'No pending OTP'], 404);
        }

        return response()->json(['code' => $code]);
    }

    // ── OTP Verify ───────────────────────────────────────────────

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'contact_number' => 'required|string|max:20',
            'code'           => 'required|string|size:6',
        ]);

        $msisdn  = $request->contact_number;
        $lockKey = "otp_lock:{$msisdn}";

        // Lockout: 5 failed attempts within 15 minutes
        if ((int) Redis::get($lockKey) >= self::OTP_LOCK_THRESHOLD) {
            return response()->json(['message' => 'Account locked. Try again in 15 minutes.'], 423);
        }

        $otp = DB::table('otp_codes')
            ->where('contact_number', $msisdn)
            ->where('used', 0)
            ->where('expires_at', '>', now())
            ->orderByDesc('created_at')
            ->first();

        if (!$otp || hash('sha256', $request->code . $otp->salt) !== $otp->code_hash) {
            $count = Redis::incr($lockKey);
            if ($count === 1) {
                Redis::expireat($lockKey, now()->addMinutes(15)->timestamp);
            }
            return response()->json(['message' => 'Invalid or expired OTP'], 401);
        }

        DB::table('otp_codes')->where('id', $otp->id)->update(['used' => 1]);
        Redis::del($lockKey);

        $user = DB::table('user_account')->where('contact_number', $msisdn)->first();
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $userIdStr = Uuid::fromBin($user->id);
        [$accessToken, $accessJti, $refreshToken, $refreshJti] = $this->issueTokens($userIdStr, $user);

        return $this->respondWithTokens($accessToken, $accessJti, $refreshToken, $refreshJti, [
            'id'             => $userIdStr,
            'user_name'      => $user->user_name,
            'contact_number' => $user->contact_number,
            'staff_type'     => $user->staff_type,
        ]);
    }

    // ── Refresh ──────────────────────────────────────────────────

    public function refresh(Request $request)
    {
        $refreshToken = $request->cookie('sf_refresh_token');
        if (!$refreshToken) {
            return response()->json(['message' => 'Refresh token missing'], 401);
        }

        try {
            $decoded = JWT::decode($refreshToken, new Key(config('app.jwt_secret'), 'HS256'));
        } catch (Throwable) {
            return response()->json(['message' => 'Refresh token invalid or expired'], 401);
        }

        if (($decoded->type ?? '') !== 'refresh') {
            return response()->json(['message' => 'Invalid token type'], 401);
        }

        if (Redis::exists("jwt_rev:{$decoded->jti}")) {
            return response()->json(['message' => 'Token revoked'], 401);
        }

        $user = DB::table('user_account')->where('id', Uuid::toBin($decoded->sub))->first();
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        // Revoke old refresh token
        $remaining = $decoded->exp - time();
        if ($remaining > 0) {
            Redis::setex("jwt_rev:{$decoded->jti}", $remaining, '1');
        }

        $userIdStr = Uuid::fromBin($user->id);
        [$accessToken, $accessJti, $newRefreshToken, $newRefreshJti] = $this->issueTokens($userIdStr, $user);

        return $this->respondWithTokens($accessToken, $accessJti, $newRefreshToken, $newRefreshJti, null);
    }

    // ── Logout ───────────────────────────────────────────────────

    public function logout(Request $request)
    {
        foreach (['sf_access_token', 'sf_refresh_token'] as $cookieName) {
            $token = $request->cookie($cookieName);
            if (!$token) {
                continue;
            }
            try {
                $decoded   = JWT::decode($token, new Key(config('app.jwt_secret'), 'HS256'));
                $remaining = ($decoded->exp ?? 0) - time();
                if ($remaining > 0 && !empty($decoded->jti)) {
                    Redis::setex("jwt_rev:{$decoded->jti}", $remaining, '1');
                }
            } catch (Throwable) {
                // Token already invalid — nothing to revoke
            }
        }

        return response()->json(['message' => 'Logged out'])
            ->withoutCookie('sf_access_token')
            ->withoutCookie('sf_refresh_token');
    }

    // ── Me ───────────────────────────────────────────────────────

    public function me(Request $request)
    {
        $auth = $request->auth_user;
        $user = DB::table('user_account')->where('id', Uuid::toBin($auth['sub']))->first();

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        return response()->json([
            'id'             => Uuid::fromBin($user->id),
            'user_name'      => $user->user_name,
            'contact_number' => $user->contact_number,
            'staff_type'     => $user->staff_type,
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────

    private function issueTokens(string $userIdStr, object $user): array
    {
        $now        = time();
        $accessJti  = bin2hex(random_bytes(16));
        $refreshJti = bin2hex(random_bytes(16));

        $accessPayload = [
            'iss'        => config('app.url'),
            'sub'        => $userIdStr,
            'jti'        => $accessJti,
            'staff_type' => $user->staff_type,
            'name'       => $user->user_name,
            'iat'        => $now,
            'exp'        => $now + self::ACCESS_TTL,
        ];

        $refreshPayload = [
            'iss'  => config('app.url'),
            'sub'  => $userIdStr,
            'jti'  => $refreshJti,
            'type' => 'refresh',
            'iat'  => $now,
            'exp'  => $now + self::REFRESH_TTL,
        ];

        $secret       = config('app.jwt_secret');
        $accessToken  = JWT::encode($accessPayload, $secret, 'HS256');
        $refreshToken = JWT::encode($refreshPayload, $secret, 'HS256');

        return [$accessToken, $accessJti, $refreshToken, $refreshJti];
    }

    private function respondWithTokens(
        string  $accessToken,
        string  $accessJti,
        string  $refreshToken,
        string  $refreshJti,
        ?array  $user
    ) {
        $isSecure = config('app.env') === 'production';

        $accessCookie = cookie(
            'sf_access_token',
            $accessToken,
            self::ACCESS_TTL / 60,
            '/',
            null,
            $isSecure,
            true,   // httpOnly
            false,
            'Strict'
        );

        $refreshCookie = cookie(
            'sf_refresh_token',
            $refreshToken,
            self::REFRESH_TTL / 60,
            '/api/auth/refresh',
            null,
            $isSecure,
            true,   // httpOnly
            false,
            'Strict'
        );

        $body = ['access_token' => $accessToken];
        if ($user !== null) {
            $body['user'] = $user;
        }

        return response()->json($body)
            ->withCookie($accessCookie)
            ->withCookie($refreshCookie);
    }
}
