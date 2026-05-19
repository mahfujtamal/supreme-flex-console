<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Firebase\JWT\JWT;

class AuthController extends Controller
{
    public function requestOtp(Request $request)
    {
        $request->validate([
            'contact_number' => 'required|string|max:20',
        ]);

        $user = DB::table('user_account')
            ->where('contact_number', $request->contact_number)
            ->first();

        if (!$user) {
            return response()->json(['message' => 'No account found for this number'], 404);
        }

        // Invalidate any unused, unexpired OTPs for this number
        DB::table('otp_codes')
            ->where('contact_number', $request->contact_number)
            ->where('used', 0)
            ->where('expires_at', '>', now())
            ->update(['used' => 1]);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table('otp_codes')->insert([
            'id'             => (string) \Illuminate\Support\Str::uuid(),
            'contact_number' => $request->contact_number,
            'code'           => $code,
            'expires_at'     => now()->addMinutes(5),
            'used'           => 0,
            'created_at'     => now(),
        ]);

        Log::info("OTP for {$request->contact_number}: {$code}");

        $response = ['message' => 'OTP sent'];

        // Return code in response only in local dev — never in production
        if (config('app.env') === 'local') {
            $response['otp'] = $code;
        }

        return response()->json($response);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'contact_number' => 'required|string|max:20',
            'code'           => 'required|string|size:6',
        ]);

        $otp = DB::table('otp_codes')
            ->where('contact_number', $request->contact_number)
            ->where('code', $request->code)
            ->where('used', 0)
            ->where('expires_at', '>', now())
            ->first();

        if (!$otp) {
            return response()->json(['message' => 'Invalid or expired OTP'], 401);
        }

        DB::table('otp_codes')->where('id', $otp->id)->update(['used' => 1]);

        $user = DB::table('user_account')
            ->where('contact_number', $request->contact_number)
            ->first();

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $payload = [
            'iss'            => config('app.url'),
            'sub'            => $user->id,
            'contact_number' => $user->contact_number,
            'name'           => $user->user_name,
            'iat'            => time(),
            'exp'            => time() + (config('app.jwt_ttl', 1440) * 60),
        ];

        $token = JWT::encode($payload, config('app.jwt_secret'), 'HS256');

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'             => $user->id,
                'user_name'      => $user->user_name,
                'contact_number' => $user->contact_number,
                'staff_type'     => $user->staff_type,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        $auth = $request->auth_user;
        $user = DB::table('user_account')->where('id', $auth['sub'])->first();

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        return response()->json([
            'id'             => $user->id,
            'user_name'      => $user->user_name,
            'contact_number' => $user->contact_number,
            'staff_type'     => $user->staff_type,
        ]);
    }
}
