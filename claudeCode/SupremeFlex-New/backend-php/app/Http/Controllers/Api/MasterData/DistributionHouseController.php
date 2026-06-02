<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DistributionHouseController extends BaseApiController
{
    protected string $table        = 'distribution_houses';
    protected string $primaryKey   = 'dh_id';
    protected string $searchColumn = 'name';
    protected array  $fillable     = ['name', 'dh_code', 'territory_id', 'phone_number', 'status'];

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));
        $search  = trim($request->get('search', ''));

        $query = DB::table('distribution_houses as dh')
            ->leftJoin('territories as t',  'dh.territory_id', '=', 't.territory_id')
            ->leftJoin('clusters as cl',    't.cluster_id',    '=', 'cl.cluster_id')
            ->leftJoin('regions as r',      'cl.region_id',    '=', 'r.region_id')
            ->leftJoin('circles as ci',     'r.circle_id',     '=', 'ci.circle_id')
            ->select(
                'dh.dh_id', 'dh.dh_code', 'dh.name',
                'dh.territory_id', 't.territory_name',
                'cl.cluster_name', 'r.region_name', 'ci.circle_name',
                'dh.phone_number', 'dh.status',
                'dh.created_at', 'dh.updated_at'
            )
            ->orderBy('dh.name');

        if ($search) {
            $query->where('dh.name', 'LIKE', "%{$search}%");
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => $this->castRecord($r))->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }
}
