<?php

namespace App\Http\Controllers\Api\ProductEngine;

use App\Http\Controllers\Api\BaseApiController;

class PriceComponentController extends BaseApiController
{
    protected string $table        = 'price_components';
    protected string $primaryKey   = 'component_id';
    protected string $searchColumn = 'component_name';
    protected array  $fillable     = ['component_name', 'price_version_id', 'component_type', 'amount_bdt', 'sort_order'];
}
