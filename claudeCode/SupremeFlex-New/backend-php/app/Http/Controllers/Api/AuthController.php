<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Firebase\JWT\JWT;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = DB::table('user_account')->where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $payload = [
            'iss'   => config('app.url'),
            'sub'   => $user->id,
            'email' => $user->email,
            'name'  => $user->user_name,
            'iat'   => time(),
            'exp'   => time() + (config('app.jwt_ttl', 1440) * 60),
        ];

        $token = JWT::encode($payload, config('app.jwt_secret'), 'HS256');

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'         => $user->id,
                'user_name'  => $user->user_name,
                'email'      => $user->email,
                'staff_type' => $user->staff_type,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        // Stateless JWT — client discards token
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
            'id'         => $user->id,
            'user_name'  => $user->user_name,
            'email'      => $user->email,
            'staff_type' => $user->staff_type,
        ]);
    }
}
