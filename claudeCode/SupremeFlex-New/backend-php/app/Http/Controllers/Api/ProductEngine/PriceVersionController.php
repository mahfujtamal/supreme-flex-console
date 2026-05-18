<?php

namespace App\Http\Controllers\Api\ProductEngine;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PriceVersionController extends BaseApiController
{
    protected string $table        = 'product_price_versions';
    protected string $primaryKey   = 'price_version_id';
    protected string $searchColumn = 'product_id';
    protected array  $fillable     = ['product_id', 'base_price_bdt', 'start_date', 'end_date', 'status'];

    /** GET /api/pricing?product_id=&status= — timeline view */
    public function timeline(Request $request)
    {
        $query = DB::table('product_price_versions as ppv')
            ->join('products as p', 'p.product_id', '=', 'ppv.product_id')
            ->select('ppv.*', 'p.product_name')
            ->orderBy('ppv.start_date');

        if ($request->product_id) {
            $query->where('ppv.product_id', $request->product_id);
        }
        if ($request->status) {
            $query->where('ppv.status', $request->status);
        }

        return response()->json($query->get());
    }
}
