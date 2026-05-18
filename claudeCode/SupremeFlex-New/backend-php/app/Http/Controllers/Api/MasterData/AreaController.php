<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;

class AreaController extends BaseApiController
{
    protected string $table        = 'areas';
    protected string $primaryKey   = 'area_id';
    protected string $searchColumn = 'area_name';
    protected array  $fillable     = ['area_name', 'district_id', 'network_zone_id', 'is_4g_area', 'is_5g_area'];
}
