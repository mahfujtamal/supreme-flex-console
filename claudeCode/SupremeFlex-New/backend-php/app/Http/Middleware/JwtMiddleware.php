<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Throwable;

class JwtMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        // Cookie first; fall back to Bearer header for Node API cross-origin calls
        $token = $request->cookie('sf_access_token')
            ?? $this->bearerToken($request);

        if (!$token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        try {
            $decoded = JWT::decode($token, new Key(config('app.jwt_secret'), 'HS256'));
        } catch (Throwable) {
            return response()->json(['message' => 'Token invalid or expired'], 401);
        }

        // Reject revoked tokens
        if (!empty($decoded->jti) && Redis::exists("jwt_rev:{$decoded->jti}")) {
            return response()->json(['message' => 'Token has been revoked'], 401);
        }

        $request->merge(['auth_user' => (array) $decoded]);

        return $next($request);
    }

    private function bearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization', '');
        if (str_starts_with($header, 'Bearer ')) {
            return substr($header, 7);
        }
        return null;
    }
}
