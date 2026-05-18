<?php

namespace App\Http\Controllers\Api\CampaignEngine;

use App\Http\Controllers\Api\BaseApiController;

class ProductRuleController extends BaseApiController
{
    protected string $table        = 'campaign_product_rules';
    protected string $primaryKey   = 'rule_id';
    protected string $searchColumn = 'campaign_id';
    protected array  $fillable     = ['campaign_id', 'product_id', 'rule_type', 'discount_type', 'discount_value', 'applicable_components'];
}
