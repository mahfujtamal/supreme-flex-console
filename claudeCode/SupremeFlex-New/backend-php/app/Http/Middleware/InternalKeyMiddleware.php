<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class InternalKeyMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $expected = config('app.internal_api_key');
        $provided = $request->header('X-Internal-Key');

        if (!$expected || $provided !== $expected) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
