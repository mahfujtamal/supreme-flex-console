<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsService
{
    public function send(string $msisdn, string $message): bool
    {
        if (config('sms.mock')) {
            Log::info("[SMS mock] To: {$msisdn} | {$message}");
            return true;
        }

        try {
            $response = Http::withHeaders(['Authorization' => 'Bearer ' . config('sms.api_key')])
                ->post(config('sms.base_url') . '/send', [
                    'sender'  => config('sms.sender'),
                    'to'      => $msisdn,
                    'message' => $message,
                ]);
            return $response->successful();
        } catch (\Throwable $e) {
            Log::error("[SMS] Failed to send to {$msisdn}: " . $e->getMessage());
            return false;
        }
    }
}
