<?php

namespace App\Http\Controllers\Api;

use App\Helpers\Uuid;
use App\Http\Controllers\Api\BaseApiController;
use App\Http\Controllers\Controller;
use App\Services\Contracts\LocationChangeApiServiceInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LocationChangeController extends Controller
{
    public function __construct(private LocationChangeApiServiceInterface $locationApi) {}

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));

        $query = DB::table('location_change_history')->orderByDesc('created_at');

        if ($request->filled('customer_id')) {
            $query->where('customer_id', Uuid::toBin($request->customer_id));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => BaseApiController::castRecord($r))->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'anchor_id'         => 'required|uuid',
            'active_service_id' => 'required|uuid',
            'customer_id'       => 'required|uuid',
            'new_area_id'       => 'required|uuid',
            'from_tac'          => 'required|string|size:8',
            'to_tac'            => 'required|string|size:8',
            'old_area_id'       => 'nullable|uuid',
            'new_dh_id'         => 'nullable|uuid',
        ]);

        $apiResult = $this->locationApi->callLocationChangeApi(
            $request->customer_id,
            $request->from_tac,
            $request->to_tac
        );

        $id = Uuid::make();
        DB::table('location_change_history')->insert([
            'id'                => $id,
            'anchor_id'         => Uuid::toBin($request->anchor_id),
            'active_service_id' => Uuid::toBin($request->active_service_id),
            'customer_id'       => Uuid::toBin($request->customer_id),
            'old_area_id'       => $request->old_area_id ? Uuid::toBin($request->old_area_id) : null,
            'new_area_id'       => Uuid::toBin($request->new_area_id),
            'new_dh_id'         => $request->new_dh_id ? Uuid::toBin($request->new_dh_id) : null,
            'status'            => 'PENDING',
            'notes'             => $request->notes ?? ($apiResult['message'] ?? null),
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return response()->json(BaseApiController::castRecord(DB::table('location_change_history')->where('id', $id)->first()), 201);
    }

    public function show(string $id)
    {
        $record = DB::table('location_change_history')->where('id', Uuid::toBin($id))->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);
        return response()->json(BaseApiController::castRecord($record));
    }

    public function update(Request $request, string $id)
    {
        $binId = Uuid::toBin($id);
        $record = DB::table('location_change_history')->where('id', $binId)->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);

        $request->validate(['status' => 'required|in:PENDING,APPROVED,REJECTED,COMPLETED']);

        DB::table('location_change_history')->where('id', $binId)->update([
            'status'       => $request->status,
            'completed_at' => $request->status === 'COMPLETED' ? now() : $record->completed_at,
            'notes'        => $request->get('notes', $record->notes),
            'updated_at'   => now(),
        ]);

        return response()->json(BaseApiController::castRecord(DB::table('location_change_history')->where('id', $binId)->first()));
    }
}
