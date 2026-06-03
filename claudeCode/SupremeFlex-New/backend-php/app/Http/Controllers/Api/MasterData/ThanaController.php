<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ThanaController extends BaseApiController
{
    protected string $table        = 'thanas';
    protected string $primaryKey   = 'thana_id';
    protected string $searchColumn = 'thana_name';
    protected array  $fillable     = ['thana_name', 'district_id', 'status'];

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));
        $search  = trim($request->get('search', ''));

        $query = DB::table('thanas as t')
            ->leftJoin('districts as d', 't.district_id', '=', 'd.district_id')
            ->select(
                't.thana_id', 't.thana_name', 't.status',
                't.district_id', 'd.district_name',
                't.created_at', 't.updated_at'
            )
            ->orderBy('t.thana_name');

        if ($search) {
            $query->where('t.thana_name', 'LIKE', "%{$search}%");
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => $this->castRecord($r))->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }
}
