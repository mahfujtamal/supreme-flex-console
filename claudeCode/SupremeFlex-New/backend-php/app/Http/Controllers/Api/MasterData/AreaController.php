<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AreaController extends BaseApiController
{
    protected string $table        = 'areas';
    protected string $primaryKey   = 'area_id';
    protected string $searchColumn = 'area_name';
    protected array  $fillable     = ['area_name', 'district_id', 'thana_id', 'network_zone_id', 'is_4g_area', 'is_5g_area'];

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));
        $search  = trim($request->get('search', ''));

        $query = DB::table('areas as a')
            ->leftJoin('districts as d', 'a.district_id', '=', 'd.district_id')
            ->leftJoin('thanas as t', 'a.thana_id', '=', 't.thana_id')
            ->leftJoin('network_zones as nz', 'a.network_zone_id', '=', 'nz.network_zone_id')
            ->select(
                'a.area_id', 'a.area_name',
                'a.district_id', 'd.district_name',
                'a.thana_id', 't.thana_name',
                'a.network_zone_id', 'nz.network_zone_name',
                'a.is_4g_area', 'a.is_5g_area',
                'a.created_at', 'a.updated_at'
            )
            ->orderBy('a.area_name');

        if ($search) {
            $query->where('a.area_name', 'LIKE', "%{$search}%");
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => $this->castRecord($r))->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }
}
