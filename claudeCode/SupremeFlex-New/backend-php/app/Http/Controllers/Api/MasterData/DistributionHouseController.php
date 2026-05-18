<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;

class DistributionHouseController extends BaseApiController
{
    protected string $table        = 'distribution_houses';
    protected string $primaryKey   = 'dh_id';
    protected string $searchColumn = 'name';
    protected array  $fillable     = ['name', 'dh_code', 'territory_id', 'phone_number', 'status'];
}
