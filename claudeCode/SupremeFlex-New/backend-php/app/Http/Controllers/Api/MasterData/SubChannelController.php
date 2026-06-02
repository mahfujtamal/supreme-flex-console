<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubChannelController extends BaseApiController
{
    protected string $table        = 'sub_channels';
    protected string $primaryKey   = 'sub_channel_id';
    protected string $searchColumn = 'sub_channel_name';
    protected array  $fillable     = ['sub_channel_name', 'channel_id', 'delivery_ownership', 'is_direct_delivery', 'status'];

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));
        $search  = trim($request->get('search', ''));

        $query = DB::table('sub_channels as sc')
            ->leftJoin('channels as c', 'sc.channel_id', '=', 'c.channel_id')
            ->select(
                'sc.sub_channel_id', 'sc.sub_channel_name',
                'sc.channel_id', 'c.channel_name',
                'sc.delivery_ownership', 'sc.inventory_pull_mode',
                'sc.is_direct_delivery', 'sc.status',
                'sc.created_at', 'sc.updated_at'
            )
            ->orderBy('sc.sub_channel_name');

        if ($search) {
            $query->where('sc.sub_channel_name', 'LIKE', "%{$search}%");
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => $this->castRecord($r))->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }
}
