<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;

class KamController extends BaseApiController
{
    protected string $table        = 'kams';
    protected string $primaryKey   = 'kam_id';
    protected string $searchColumn = 'name';
    protected array  $fillable     = ['name', 'msisdn', 'hub_manager_id', 'assigned_segments', 'status'];
}
