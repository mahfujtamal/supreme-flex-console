<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Helpers\Uuid;

class InventoryController extends BaseApiController
{
    protected string $table        = 'inventory_master';
    protected string $primaryKey   = 'inventory_id';
    protected string $searchColumn = 'serial_number';
    protected array  $fillable     = [
        'product_id', 'item_type', 'status', 'stock_type',
        'allocated_agent_id', 'allocated_entity_id',
        'serial_number', 'imei', 'msisdn',
    ];

    public function bulkInward(Request $request)
    {
        $request->validate([
            'items'            => 'required|array|min:1',
            'items.*.product_id'  => 'required|string',
            'items.*.item_type'   => 'required|in:CPE,SIM,ADDON',
            'items.*.serial_number' => 'nullable|string',
            'items.*.imei'        => 'nullable|string',
            'items.*.msisdn'      => 'nullable|string',
        ]);

        $rows = [];
        $now  = now();
        foreach ($request->items as $item) {
            $rows[] = array_merge($item, [
                'inventory_id' => Uuid::make(),
                'status'       => 'IN_GPFI_STAGING',
                'stock_type'   => 'GPFI_STAGING',
                'created_at'   => $now,
                'updated_at'   => $now,
            ]);
        }

        DB::table('inventory_master')->insert($rows);

        return response()->json(['inserted' => count($rows)], 201);
    }
}
