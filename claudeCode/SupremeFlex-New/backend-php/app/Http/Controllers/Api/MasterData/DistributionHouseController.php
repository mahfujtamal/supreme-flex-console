<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;
use App\Helpers\Uuid;
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
            $query->where(function ($q) use ($search) {
                $q->where('dh.dh_code',       'LIKE', "%{$search}%")
                  ->orWhere('dh.name',         'LIKE', "%{$search}%")
                  ->orWhere('dh.phone_number', 'LIKE', "%{$search}%")
                  ->orWhere('t.territory_name','LIKE', "%{$search}%")
                  ->orWhere('cl.cluster_name', 'LIKE', "%{$search}%")
                  ->orWhere('r.region_name',   'LIKE', "%{$search}%")
                  ->orWhere('ci.circle_name',  'LIKE', "%{$search}%")
                  ->orWhereExists(function ($sub) use ($search) {
                      $sub->select(DB::raw(1))
                          ->from('dh_area_assignments as daa')
                          ->join('areas as a', 'daa.area_id', '=', 'a.area_id')
                          ->whereColumn('daa.dh_id', 'dh.dh_id')
                          ->where('a.area_name', 'LIKE', "%{$search}%");
                  });
            });
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => $this->castRecord($r))->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }

    public function areas(Request $request, string $id)
    {
        $dhId = Uuid::toBin($id);
        $rows = DB::table('dh_area_assignments as daa')
            ->join('areas as a', 'daa.area_id', '=', 'a.area_id')
            ->leftJoin('thanas as t', 'a.thana_id', '=', 't.thana_id')
            ->leftJoin('districts as d', 'a.district_id', '=', 'd.district_id')
            ->where('daa.dh_id', $dhId)
            ->select('a.area_id', 'a.area_name', 't.thana_name', 'd.district_name')
            ->orderBy('a.area_name')
            ->get()
            ->map(fn($r) => self::castRow($r, 'area_id'));
        return response()->json($rows);
    }

    public function reassignArea(Request $request, string $areaId)
    {
        $request->validate(['new_dh_id' => 'required|string']);
        $areaBin  = Uuid::toBin($areaId);
        $newDhBin = Uuid::toBin($request->new_dh_id);

        DB::table('dh_area_assignments')->where('area_id', $areaBin)->delete();
        DB::table('dh_area_assignments')->insert([
            'dh_id'      => $newDhBin,
            'area_id'    => $areaBin,
            'created_at' => now(),
        ]);
        DB::table('distribution_houses')
            ->where('dh_id', $newDhBin)
            ->update(['last_assigned_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
