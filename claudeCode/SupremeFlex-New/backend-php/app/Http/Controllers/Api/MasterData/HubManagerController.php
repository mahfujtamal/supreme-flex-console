<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;

class HubManagerController extends BaseApiController
{
    protected string $table        = 'hub_managers';
    protected string $primaryKey   = 'hub_manager_id';
    protected string $searchColumn = 'name';
    protected array  $fillable     = ['name', 'email', 'msisdn', 'dh_id', 'channel_id', 'sub_channel_id', 'status'];
}
