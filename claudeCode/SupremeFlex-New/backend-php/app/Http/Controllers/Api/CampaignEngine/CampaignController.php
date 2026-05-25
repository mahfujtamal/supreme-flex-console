<?php

namespace App\Http\Controllers\Api\CampaignEngine;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Helpers\Uuid;

class CampaignController extends BaseApiController
{
    protected string $table        = 'campaign_master';
    protected string $primaryKey   = 'campaign_id';
    protected string $searchColumn = 'campaign_name';
    protected array  $fillable     = [
        'campaign_name', 'description', 'start_date', 'end_date',
        'scope', 'campaign_trigger_type', 'campaign_rank',
        'allow_cod_payment', 'allow_online_payment',
        'on_ownership_transfer_behavior', 'status',
    ];

    /** POST /api/campaigns/{id}/clone — deep clone with related rules */
    public function clone(string $id)
    {
        $campaign = DB::table('campaign_master')->where('campaign_id', Uuid::toBin($id))->first();
        if (!$campaign) return response()->json(['message' => 'Not found'], 404);

        $newId = Uuid::make();
        $now   = now();

        DB::transaction(function () use ($campaign, $newId, $now) {
            // Clone campaign
            $data = (array) $campaign;
            $data['campaign_id']   = $newId;
            $data['campaign_name'] = $data['campaign_name'] . ' (Copy)';
            $data['status']        = 0;
            $data['created_at']    = $now;
            $data['updated_at']    = $now;
            DB::table('campaign_master')->insert($data);

            // Clone targeting rules
            $rules = DB::table('campaign_targeting_rules')->where('campaign_id', $campaign->campaign_id)->get();
            foreach ($rules as $rule) {
                $r = (array) $rule;
                $r['rule_id']    = Uuid::make();
                $r['campaign_id'] = $newId;
                $r['created_at'] = $now;
                $r['updated_at'] = $now;
                DB::table('campaign_targeting_rules')->insert($r);
            }

            // Clone product rules + discount mappings
            $productRules = DB::table('campaign_product_rules')->where('campaign_id', $campaign->campaign_id)->get();
            foreach ($productRules as $pr) {
                $oldRuleId  = $pr->rule_id;
                $newRuleId  = Uuid::make();
                $prd = (array) $pr;
                $prd['rule_id']    = $newRuleId;
                $prd['campaign_id'] = $newId;
                $prd['created_at'] = $now;
                $prd['updated_at'] = $now;
                DB::table('campaign_product_rules')->insert($prd);

                $mappings = DB::table('campaign_discount_mappings')->where('rule_id', $oldRuleId)->get();
                foreach ($mappings as $m) {
                    $md = (array) $m;
                    $md['mapping_id'] = Uuid::make();
                    $md['rule_id']    = $newRuleId;
                    $md['created_at'] = $now;
                    DB::table('campaign_discount_mappings')->insert($md);
                }
            }
        });

        return response()->json($this->castRecord(DB::table('campaign_master')->where('campaign_id', $newId)->first()), 201);
    }
}
