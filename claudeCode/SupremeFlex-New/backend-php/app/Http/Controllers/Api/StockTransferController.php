<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockTransferController extends BaseApiController
{
    protected string $table        = 'stock_transfers';
    protected string $primaryKey   = 'transfer_id';
    protected string $searchColumn = 'from_entity_id';
    protected array  $fillable     = [
        'inventory_id', 'from_entity_id', 'from_entity_type',
        'to_entity_id', 'to_entity_type', 'notes',
    ];

    public function respond(Request $request, string $id)
    {
        $request->validate(['action' => 'required|in:ACCEPTED,REJECTED']);

        DB::transaction(function () use ($request, $id) {
            $transfer = DB::table('stock_transfers')
                ->where('transfer_id', $id)
                ->lockForUpdate()
                ->first();

            if (!$transfer) {
                abort(404, 'Not found');
            }
            if ($transfer->transfer_status !== 'PENDING') {
                abort(409, 'Transfer already ' . strtolower($transfer->transfer_status));
            }

            DB::table('stock_transfers')->where('transfer_id', $id)->update([
                'transfer_status' => $request->action,
                'responded_at'    => now(),
                'updated_at'      => now(),
            ]);

            if ($request->action === 'ACCEPTED') {
                // Map entity type to inventory status
                $statusMap = [
                    'HUB_MANAGER'  => 'WITH_HUB_MANAGER',
                    'FIELD_STAFF'  => 'WITH_FIELD_STAFF',
                    'DH'           => 'ALLOCATED_TO_DH',
                    'KAM'          => 'ALLOCATED_TO_KAM',
                ];
                $newStatus = $statusMap[$transfer->to_entity_type] ?? 'ALLOCATED_TO_DH';

                DB::table('inventory_master')
                    ->where('inventory_id', $transfer->inventory_id)
                    ->update([
                        'status'              => $newStatus,
                        'allocated_entity_id' => $transfer->to_entity_id,
                        'updated_at'          => now(),
                    ]);
            }
        });

        return response()->json(['message' => 'Transfer ' . strtolower($request->action)]);
    }
}
