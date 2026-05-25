<?php

namespace App\Http\Controllers\Api\ProductEngine;

use App\Http\Controllers\Api\BaseApiController;
use App\Helpers\Uuid;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AddonCompatibilityController extends BaseApiController
{
    protected string $table        = 'physical_addon_compatibility';
    protected string $primaryKey   = 'compatibility_id';
    protected string $searchColumn = 'addon_product_id';
    protected array  $fillable     = ['addon_product_id', 'cpe_product_id', 'area_id', 'dh_id', 'notes'];

    public function store(Request $request)
    {
        $data = $request->only($this->fillable);

        foreach (['addon_product_id', 'cpe_product_id', 'area_id', 'dh_id'] as $col) {
            if (!empty($data[$col])) {
                $data[$col] = Uuid::toBin($data[$col]);
            }
        }

        $data[$this->primaryKey] = Uuid::make();
        $data['created_at'] = now();
        $data['updated_at'] = now();

        DB::table($this->table)->insert($data);

        $record = DB::table($this->table)->where($this->primaryKey, $data[$this->primaryKey])->first();
        return response()->json($this->castRecord($record), 201);
    }

    public function update(Request $request, string $id)
    {
        $binId = Uuid::toBin($id);
        $exists = DB::table($this->table)->where($this->primaryKey, $binId)->exists();
        if (!$exists) return response()->json(['message' => 'Not found'], 404);

        $data = $request->only($this->fillable);
        foreach (['addon_product_id', 'cpe_product_id', 'area_id', 'dh_id'] as $col) {
            if (!empty($data[$col])) {
                $data[$col] = Uuid::toBin($data[$col]);
            }
        }
        $data['updated_at'] = now();

        DB::table($this->table)->where($this->primaryKey, $binId)->update($data);
        return response()->json($this->castRecord(DB::table($this->table)->where($this->primaryKey, $binId)->first()));
    }
}
