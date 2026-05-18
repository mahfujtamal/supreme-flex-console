<?php

namespace App\Http\Controllers\Api\CampaignEngine;

use App\Http\Controllers\Api\BaseApiController;

class TargetingRuleController extends BaseApiController
{
    protected string $table        = 'campaign_targeting_rules';
    protected string $primaryKey   = 'rule_id';
    protected string $searchColumn = 'block_id';
    protected array  $fillable     = ['campaign_id', 'network_zone_id', 'district_id', 'area_id', 'channel_id', 'sub_channel_id', 'network_type', 'min_network_age_days', 'max_network_age_days', 'block_id'];
}
