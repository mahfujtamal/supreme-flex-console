<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SmsService;
use Illuminate\Http\Request;

class InternalController extends Controller
{
    public function __construct(private SmsService $sms) {}

    public function sendSms(Request $request)
    {
        $request->validate([
            'msisdn'  => 'required|string|max:20',
            'message' => 'required|string|max:480',
        ]);

        $ok = $this->sms->send($request->msisdn, $request->message);

        return response()->json(['success' => $ok], $ok ? 200 : 502);
    }
}
