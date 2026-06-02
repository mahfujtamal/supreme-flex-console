<?php

namespace App\Http\Controllers\Api;

use App\Helpers\Uuid;
use App\Http\Controllers\Api\BaseApiController;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CpeOrderController extends Controller
{
    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));

        $query = DB::table('cpe_order_history')->orderByDesc('created_at');

        if ($request->filled('customer_id')) {
            $query->where('customer_id', Uuid::toBin($request->customer_id));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => BaseApiController::castRow($r))->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'anchor_id'         => 'required|uuid',
            'active_service_id' => 'required|uuid',
            'customer_id'       => 'required|uuid',
            'old_cpe_serial'    => 'nullable|string|max:100',
            'new_cpe_serial'    => 'nullable|string|max:100',
        ]);

        $id = Uuid::make();
        DB::table('cpe_order_history')->insert([
            'id'                => $id,
            'anchor_id'         => Uuid::toBin($request->anchor_id),
            'active_service_id' => Uuid::toBin($request->active_service_id),
            'customer_id'       => Uuid::toBin($request->customer_id),
            'old_cpe_serial'    => $request->old_cpe_serial,
            'new_cpe_serial'    => $request->new_cpe_serial,
            'status'            => 'PENDING',
            'notes'             => $request->notes,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return response()->json(BaseApiController::castRow(DB::table('cpe_order_history')->where('id', $id)->first()), 201);
    }

    public function show(string $id)
    {
        $record = DB::table('cpe_order_history')->where('id', Uuid::toBin($id))->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);
        return response()->json(BaseApiController::castRow($record));
    }

    public function update(Request $request, string $id)
    {
        $binId = Uuid::toBin($id);
        $record = DB::table('cpe_order_history')->where('id', $binId)->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);

        $request->validate(['status' => 'required|in:PENDING,COMPLETED,FAILED']);

        DB::table('cpe_order_history')->where('id', $binId)->update([
            'status'         => $request->status,
            'completed_at'   => $request->status === 'COMPLETED' ? now() : $record->completed_at,
            'new_cpe_serial' => $request->get('new_cpe_serial', $record->new_cpe_serial),
            'notes'          => $request->get('notes', $record->notes),
            'updated_at'     => now(),
        ]);

        return response()->json(BaseApiController::castRow(DB::table('cpe_order_history')->where('id', $binId)->first()));
    }
}
