<?php

namespace App\Http\Controllers\Api\CampaignEngine;

use App\Http\Controllers\Api\BaseApiController;

class ReferralProgramController extends BaseApiController
{
    protected string $table        = 'referral_programs';
    protected string $primaryKey   = 'program_id';
    protected string $searchColumn = 'referral_code_prefix';
    protected array  $fillable     = [
        'campaign_id', 'start_date', 'end_date', 'max_referrals_per_customer',
        'is_locked', 'reward_on_signup', 'referrer_product_id',
        'referrer_reward_type', 'referrer_reward_value', 'referrer_reward_unit',
        'referral_code_prefix', 'referee_config_matrix', 'status',
    ];
}
