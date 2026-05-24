<?php

namespace App\Http\Controllers\Api;

use App\Helpers\Uuid;
use App\Http\Controllers\Controller;
use App\Services\Contracts\RealIpApiServiceInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RealIpController extends Controller
{
    public function __construct(private RealIpApiServiceInterface $realIpApi) {}

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));

        $query = DB::table('real_ip_assignments')->orderByDesc('created_at');

        if ($request->filled('customer_id')) {
            $query->where('customer_id', Uuid::toBin($request->customer_id));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get();

        return response()->json(['items' => $items, 'total' => $total]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'anchor_id'         => 'required|uuid',
            'active_service_id' => 'required|uuid',
            'customer_id'       => 'required|uuid',
            'msisdn'            => 'required|string|max:20',
        ]);

        $apiResult = $this->realIpApi->provisionIp($request->customer_id, $request->msisdn);

        $id = Uuid::make();
        DB::table('real_ip_assignments')->insert([
            'id'                => $id,
            'anchor_id'         => Uuid::toBin($request->anchor_id),
            'active_service_id' => Uuid::toBin($request->active_service_id),
            'customer_id'       => Uuid::toBin($request->customer_id),
            'ip_address'        => $apiResult['ip_address'] ?? '0.0.0.0',
            'status'            => 'ACTIVE',
            'assigned_at'       => now(),
            'notes'             => $request->notes,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return response()->json(DB::table('real_ip_assignments')->where('id', $id)->first(), 201);
    }

    public function show(string $id)
    {
        $record = DB::table('real_ip_assignments')->where('id', Uuid::toBin($id))->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);
        return response()->json($record);
    }

    public function destroy(string $id)
    {
        $binId = Uuid::toBin($id);
        $record = DB::table('real_ip_assignments')->where('id', $binId)->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);
        if ($record->status !== 'ACTIVE') {
            return response()->json(['message' => 'Assignment is not active'], 422);
        }

        $this->realIpApi->unassignIp($record->ip_address);

        DB::table('real_ip_assignments')->where('id', $binId)->update([
            'status'      => 'RELEASED',
            'released_at' => now(),
            'updated_at'  => now(),
        ]);

        return response()->json(null, 204);
    }
}
