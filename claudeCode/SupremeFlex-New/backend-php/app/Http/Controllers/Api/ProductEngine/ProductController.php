<?php

namespace App\Http\Controllers\Api\ProductEngine;

use App\Http\Controllers\Api\BaseApiController;

class ProductController extends BaseApiController
{
    protected string $table        = 'products';
    protected string $primaryKey   = 'product_id';
    protected string $searchColumn = 'product_name';
    protected array  $fillable     = ['product_name', 'product_category', 'addon_type', 'billing_type', 'network_capability', 'is_exclusive', 'serial_required', 'warranty_value', 'warranty_unit', 'status'];
}
