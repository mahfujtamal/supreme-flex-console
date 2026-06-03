<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FieldAgentController extends BaseApiController
{
    protected string $table        = 'field_agents';
    protected string $primaryKey   = 'agent_id';
    protected string $searchColumn = 'agent_name';
    protected array  $fillable     = ['agent_name', 'dh_id', 'channel_id', 'sub_channel_id', 'msisdn', 'agent_category', 'status'];

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));
        $search  = trim($request->get('search', ''));

        $query = DB::table('field_agents as fa')
            ->leftJoin('distribution_houses as dh', 'fa.dh_id', '=', 'dh.dh_id')
            ->leftJoin('channels as ch', 'fa.channel_id', '=', 'ch.channel_id')
            ->leftJoin('sub_channels as sc', 'fa.sub_channel_id', '=', 'sc.sub_channel_id')
            ->select(
                'fa.agent_id', 'fa.agent_name', 'fa.msisdn', 'fa.agent_category', 'fa.status',
                'fa.dh_id',          'dh.name as dh_name',
                'fa.channel_id',     'ch.channel_name',
                'fa.sub_channel_id', 'sc.sub_channel_name',
                'fa.created_at',     'fa.updated_at'
            )
            ->orderBy('fa.agent_name');

        if ($search) {
            $query->where('fa.agent_name', 'LIKE', "%{$search}%");
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(function ($r) {
                $record = $this->castRecord($r);
                $record->parent_name = $record->dh_name
                    ?? $record->channel_name
                    ?? $record->sub_channel_name
                    ?? '—';
                $record->parent_type = $record->dh_id        ? 'DH'
                    : ($record->channel_id     ? 'Channel'
                    : ($record->sub_channel_id ? 'Sub-Channel'
                    : '—'));
                return $record;
            })->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }
}
