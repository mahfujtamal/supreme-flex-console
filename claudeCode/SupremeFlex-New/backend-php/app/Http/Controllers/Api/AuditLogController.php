<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('audit_logs')->orderByDesc('created_at');
        if ($request->table_name) $query->where('target_table', $request->table_name);
        if ($request->record_id)  $query->where('target_record_id', $request->record_id);
        return response()->json($query->limit(200)->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'table_name' => 'required|string',
            'record_id'  => 'nullable|string',
            'old_value'  => 'nullable|array',
            'new_value'  => 'nullable|array',
            'changed_by' => 'nullable|string',
        ]);

        $id = (string) Str::uuid();
        DB::table('system_audit_logs')->insert([
            'log_id'     => $id,
            'table_name' => $request->table_name,
            'record_id'  => $request->record_id,
            'changed_by' => $request->get('changed_by', 'GPFI Sales Manager'),
            'changed_at' => now(),
            'old_value'  => $request->old_value ? json_encode($request->old_value) : null,
            'new_value'  => $request->new_value ? json_encode($request->new_value) : null,
        ]);

        return response()->json(['log_id' => $id], 201);
    }

    public function system(Request $request)
    {
        $query = DB::table('system_audit_logs')->orderByDesc('changed_at');
        if ($request->table_name) $query->where('table_name', $request->table_name);
        if ($request->record_id)  $query->where('record_id', $request->record_id);
        return response()->json($query->limit(200)->get());
    }
}
