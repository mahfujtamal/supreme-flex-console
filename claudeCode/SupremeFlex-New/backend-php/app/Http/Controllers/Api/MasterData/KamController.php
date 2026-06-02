<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class KamController extends BaseApiController
{
    protected string $table        = 'kams';
    protected string $primaryKey   = 'kam_id';
    protected string $searchColumn = 'name';
    protected array  $fillable     = ['name', 'msisdn', 'status', 'inventory_pull_mode'];

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));
        $search  = trim($request->get('search', ''));

        $query = DB::table('kams as k')
            ->leftJoin('kam_segment_assignments as ksa', function ($join) {
                $join->on('k.kam_id', '=', 'ksa.kam_id')
                     ->whereNull('ksa.effective_until'); // active segment only
            })
            ->leftJoin('kam_segments as ks', 'ksa.segment_id', '=', 'ks.segment_id')
            ->select(
                'k.kam_id', 'k.name', 'k.msisdn',
                'k.inventory_pull_mode', 'k.status',
                'k.created_at', 'k.updated_at',
                DB::raw("GROUP_CONCAT(ks.segment_name ORDER BY ks.segment_name SEPARATOR ', ') as segments")
            )
            ->groupBy('k.kam_id', 'k.name', 'k.msisdn', 'k.inventory_pull_mode', 'k.status', 'k.created_at', 'k.updated_at')
            ->orderBy('k.name');

        if ($search) {
            $query->where('k.name', 'LIKE', "%{$search}%");
        }

        $total = DB::table('kams')->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => $this->castRecord($r))->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }
}
