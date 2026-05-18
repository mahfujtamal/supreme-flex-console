<?php

namespace App\Http\Controllers\Api\ProductEngine;

use App\Http\Controllers\Api\BaseApiController;

class AddonCompatibilityController extends BaseApiController
{
    protected string $table        = 'physical_addon_compatibility';
    protected string $primaryKey   = 'compatibility_id';
    protected string $searchColumn = 'addon_product_id';
    protected array  $fillable     = ['addon_product_id', 'cpe_product_id'];
}
