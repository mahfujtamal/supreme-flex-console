<?php

namespace App\Http\Controllers\Api;

use App\Helpers\Uuid;
use App\Http\Controllers\Api\BaseApiController;
use App\Http\Controllers\Controller;
use App\Services\Contracts\GpShopServiceInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AddonOrderController extends Controller
{
    public function __construct(private GpShopServiceInterface $gpShop) {}

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));

        $query = DB::table('addon_order_history')->orderByDesc('created_at');

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
            'addon_product_id'  => 'required|uuid',
        ]);

        $gpResult = $this->gpShop->createOrder(
            $request->customer_id,
            $request->addon_product_id
        );

        $id = Uuid::make();
        DB::table('addon_order_history')->insert([
            'id'                => $id,
            'anchor_id'         => Uuid::toBin($request->anchor_id),
            'active_service_id' => Uuid::toBin($request->active_service_id),
            'customer_id'       => Uuid::toBin($request->customer_id),
            'addon_product_id'  => Uuid::toBin($request->addon_product_id),
            'gpshop_order_id'   => $gpResult['gpshop_order_id'] ?? null,
            'status'            => 'PENDING',
            'notes'             => $request->notes,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $record = DB::table('addon_order_history')->where('id', $id)->first();
        return response()->json(BaseApiController::castRecord($record), 201);
    }

    public function show(string $id)
    {
        $record = DB::table('addon_order_history')->where('id', Uuid::toBin($id))->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);
        return response()->json(BaseApiController::castRecord($record));
    }

    public function update(Request $request, string $id)
    {
        $binId = Uuid::toBin($id);
        $record = DB::table('addon_order_history')->where('id', $binId)->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);

        $request->validate(['status' => 'required|in:PENDING,ACTIVE,CANCELLED,FAILED']);

        DB::table('addon_order_history')->where('id', $binId)->update([
            'status'       => $request->status,
            'activated_at' => $request->status === 'ACTIVE' ? now() : $record->activated_at,
            'notes'        => $request->get('notes', $record->notes),
            'updated_at'   => now(),
        ]);

        return response()->json(BaseApiController::castRecord(DB::table('addon_order_history')->where('id', $binId)->first()));
    }
}
