<?php

namespace App\Http\Controllers\Api\MasterData;

use App\Http\Controllers\Api\BaseApiController;

class NetworkZoneController extends BaseApiController
{
    protected string $table        = 'network_zones';
    protected string $primaryKey   = 'network_zone_id';
    protected string $searchColumn = 'network_zone_name';
    protected array  $fillable     = ['network_zone_name', '4g_rsrp', '4g_rsrq', '4g_snr', '5g_rsrp', '5g_rsrq', '5g_snr', 'status'];
}
