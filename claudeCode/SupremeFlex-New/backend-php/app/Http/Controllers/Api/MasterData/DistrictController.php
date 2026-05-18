<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;

class DistrictController extends BaseApiController
{
    protected string $table        = 'districts';
    protected string $primaryKey   = 'district_id';
    protected string $searchColumn = 'district_name';
    protected array  $fillable     = ['district_name', 'status'];
}
