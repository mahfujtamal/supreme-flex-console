<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Symfony\Component\HttpFoundation\Response;

class IdempotencyMiddleware
{
    /**
     * Handle an incoming request.
     *
     * Only enforced on mutating HTTP methods (POST, PATCH, PUT).
     * GET and DELETE pass through without any idempotency check.
     *
     * Redis key schema: idem:{idempotency_key}
     * TTL: 86400 s (24 h)
     *
     * Stored payload shapes:
     *   In-flight: {"status":"in_flight","body_hash":"<sha256>"}
     *   Done:      {"status":"done","body_hash":"<sha256>","status_code":<int>,"body":"<json-string>"}
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Pass through non-mutating methods
        if (! in_array($request->method(), ['POST', 'PATCH', 'PUT'], true)) {
            return $next($request);
        }

        $idempotencyKey = $request->header('Idempotency-Key');

        if (empty($idempotencyKey)) {
            return response()->json(['message' => 'Idempotency-Key header required'], 422);
        }

        $redisKey  = 'idem:' . $idempotencyKey;
        $bodyHash  = hash('sha256', $request->getContent());
        $ttl       = 86400; // 24 hours

        // Attempt atomic in-flight marker — only succeeds when key does NOT exist (NX)
        $inFlightJson = json_encode([
            'status'    => 'in_flight',
            'body_hash' => $bodyHash,
        ]);

        $setResult = Redis::set($redisKey, $inFlightJson, 'EX', $ttl, 'NX');

        if ($setResult === null) {
            // Key already exists — inspect the stored state
            $raw = Redis::get($redisKey);

            if ($raw === null) {
                // Race: key evicted between SET NX and GET — treat as new request
                Redis::set($redisKey, $inFlightJson, 'EX', $ttl);
            } else {
                $stored = json_decode($raw, true);

                if (($stored['status'] ?? '') === 'in_flight') {
                    // Another request with this key is currently executing
                    return response()->json(['message' => 'Request with this Idempotency-Key is already in progress'], 409);
                }

                if (($stored['status'] ?? '') === 'done') {
                    if (($stored['body_hash'] ?? '') !== $bodyHash) {
                        // Same key, different request body — conflict
                        return response()->json(['message' => 'Idempotency-Key reused with a different request body'], 409);
                    }

                    // Duplicate request with matching body — return cached response
                    $cachedBody       = $stored['body'] ?? '{}';
                    $cachedStatusCode = (int) ($stored['status_code'] ?? 200);

                    return response($cachedBody, $cachedStatusCode)
                        ->header('Content-Type', 'application/json')
                        ->header('X-Idempotency-Replayed', 'true');
                }
            }
        }

        // Execute the actual request
        /** @var Response $response */
        $response = $next($request);

        // Persist the completed response so future duplicates are replayed
        $donePayload = json_encode([
            'status'      => 'done',
            'body_hash'   => $bodyHash,
            'status_code' => $response->getStatusCode(),
            'body'        => $response->getContent(),
        ]);

        Redis::set($redisKey, $donePayload, 'EX', $ttl);

        return $response;
    }
}
