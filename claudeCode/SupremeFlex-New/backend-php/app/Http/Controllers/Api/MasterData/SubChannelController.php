<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;

class SubChannelController extends BaseApiController
{
    protected string $table        = 'sub_channels';
    protected string $primaryKey   = 'sub_channel_id';
    protected string $searchColumn = 'sub_channel_name';
    protected array  $fillable     = ['sub_channel_name', 'channel_id', 'delivery_ownership', 'is_direct_delivery', 'status'];
}
