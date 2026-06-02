<?php

namespace App\Http\Controllers\Api\ProductEngine;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Support\Facades\DB;

class PriceComponentController extends BaseApiController
{
    protected string $table        = 'price_components';
    protected string $primaryKey   = 'component_id';
    protected string $searchColumn = 'component_name';
    protected array  $fillable     = ['component_name', 'price_version_id', 'component_type', 'amount_bdt', 'sort_order'];

    /** GET /api/price-components/templates — distinct component names+types across all products */
    public function templates()
    {
        $rows = DB::table('price_components')
            ->select('component_name', 'component_type')
            ->groupBy('component_name', 'component_type')
            ->orderByRaw("FIELD(component_type,'MANDATORY','CUSTOM')")
            ->orderBy('component_name')
            ->get()
            ->map(fn($r) => ['name' => $r->component_name, 'type' => $r->component_type]);

        return response()->json($rows);
    }
}
