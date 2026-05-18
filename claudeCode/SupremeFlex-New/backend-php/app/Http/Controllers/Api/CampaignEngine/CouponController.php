<?php

namespace App\Http\Controllers\Api\CampaignEngine;

use App\Http\Controllers\Api\BaseApiController;

class CouponController extends BaseApiController
{
    protected string $table        = 'coupons';
    protected string $primaryKey   = 'coupon_id';
    protected string $searchColumn = 'coupon_code';
    protected array  $fillable     = ['coupon_code', 'campaign_id', 'global_usage_limit', 'max_uses_per_customer', 'status'];
}
