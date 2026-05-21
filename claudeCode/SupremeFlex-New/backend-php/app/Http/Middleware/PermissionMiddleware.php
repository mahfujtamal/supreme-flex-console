<?php

namespace App\Http\Middleware;

use App\Helpers\Uuid;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class PermissionMiddleware
{
    public function handle(Request $request, Closure $next, string $role)
    {
        $auth = $request->auth_user;
        if (!$auth || empty($auth['sub'])) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $userId   = $auth['sub'];
        $cacheKey = "rbac:{$userId}:{$role}";

        $cached = Redis::get($cacheKey);
        if ($cached !== null) {
            $allowed = (bool) $cached;
        } else {
            DB::statement("CALL has_role(?, ?, @result)", [Uuid::toBin($userId), $role]);
            $row     = DB::selectOne("SELECT @result AS result");
            $allowed = (bool) ($row->result ?? 0);
            Redis::setex($cacheKey, 300, $allowed ? '1' : '0');
        }

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
