<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SystemConfigController extends Controller
{
    public function index()
    {
        $rows = DB::table('system_config')->orderBy('config_key')->get();
        return response()->json($rows);
    }

    public function show(string $key)
    {
        $row = DB::table('system_config')->where('config_key', $key)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);
        return response()->json($row);
    }

    public function upsert(Request $request, string $key)
    {
        $request->validate([
            'config_value' => 'required|string',
            'description'  => 'nullable|string|max:255',
        ]);

        DB::table('system_config')->upsert(
            [
                'config_key'   => $key,
                'config_value' => $request->config_value,
                'description'  => $request->description,
            ],
            ['config_key'],
            ['config_value', 'description']
        );

        return response()->json(DB::table('system_config')->where('config_key', $key)->first());
    }

    public function destroy(string $key)
    {
        $deleted = DB::table('system_config')->where('config_key', $key)->delete();
        if (!$deleted) return response()->json(['message' => 'Not found'], 404);
        return response()->json(null, 204);
    }
}
