<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function gpfi()
    {
        $counts = DB::table('inventory_master')
            ->selectRaw("
                SUM(status = 'IN_GPFI_STAGING')    AS staging,
                SUM(status = 'WITH_HUB_MANAGER')   AS hub_manager,
                SUM(status = 'WITH_FIELD_STAFF')   AS field_staff,
                SUM(status = 'DELIVERED')           AS delivered
            ")
            ->first();

        return response()->json($counts);
    }

    public function hubManager()
    {
        $rows = DB::table('hub_managers as hm')
            ->leftJoin('inventory_master as im', 'im.allocated_entity_id', '=', 'hm.hub_manager_id')
            ->selectRaw("hm.hub_manager_id, hm.name,
                SUM(im.status = 'WITH_HUB_MANAGER') AS stock_count")
            ->groupBy('hm.hub_manager_id', 'hm.name')
            ->get();

        return response()->json($rows);
    }

    public function fieldExecution()
    {
        $rows = DB::table('field_agents as fa')
            ->leftJoin('inventory_master as im', 'im.allocated_agent_id', '=', 'fa.agent_id')
            ->leftJoin('orders as o', 'o.assigned_agent_id', '=', 'fa.agent_id')
            ->selectRaw("fa.agent_id, fa.agent_name,
                SUM(im.status = 'WITH_FIELD_STAFF') AS stock_count,
                SUM(o.order_status = 'OUT_FOR_DELIVERY') AS pending_deliveries")
            ->groupBy('fa.agent_id', 'fa.agent_name')
            ->get();

        return response()->json($rows);
    }
}
