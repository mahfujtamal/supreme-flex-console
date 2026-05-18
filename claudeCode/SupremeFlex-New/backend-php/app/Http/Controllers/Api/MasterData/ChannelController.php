<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;

class ChannelController extends BaseApiController
{
    protected string $table        = 'channels';
    protected string $primaryKey   = 'channel_id';
    protected string $searchColumn = 'channel_name';
    protected array  $fillable     = ['channel_name', 'is_assisted', 'is_self_delivered', 'status'];
}
