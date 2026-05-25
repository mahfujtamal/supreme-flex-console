<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Helpers\Uuid;

class AssetController extends BaseApiController
{
    protected string $table        = 'customer_assets';
    protected string $primaryKey   = 'asset_id';
    protected string $searchColumn = 'serial_number';
    protected array  $fillable     = [
        'customer_id', 'anchor_id', 'product_id', 'asset_type',
        'asset_status', 'serial_number', 'imei',
        'installation_date', 'warranty_start_date', 'warranty_end_date',
    ];

    public function replace(Request $request, string $id)
    {
        $request->validate([
            'new_asset_id'    => 'required|string',
            'reason'          => 'required|in:WARRANTY,PAID,UPGRADE',
            'charge_amount_bdt' => 'nullable|numeric',
            'notes'           => 'nullable|string',
            'anchor_id'       => 'required|string',
        ]);

        DB::transaction(function () use ($request, $id) {
            $binId = Uuid::toBin($id);
            DB::table('customer_assets')
                ->where('asset_id', $binId)
                ->update(['asset_status' => 'REPLACED', 'updated_at' => now()]);

            DB::table('asset_replacement_history')->insert([
                'replacement_id'   => Uuid::make(),
                'anchor_id'        => $request->anchor_id,
                'old_asset_id'     => $binId,
                'new_asset_id'     => Uuid::toBin($request->new_asset_id),
                'reason'           => $request->reason,
                'charge_amount_bdt' => $request->charge_amount_bdt,
                'notes'            => $request->notes,
                'replaced_at'      => now(),
            ]);
        });

        return response()->json(['message' => 'Asset replaced']);
    }
}
