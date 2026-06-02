<?php

namespace App\Http\Controllers\Api\ProductEngine;

use App\Http\Controllers\Api\BaseApiController;
use App\Helpers\Uuid;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PriceVersionController extends BaseApiController
{
    protected string $table        = 'product_price_versions';
    protected string $primaryKey   = 'price_version_id';
    protected string $searchColumn = 'product_id';
    protected array  $fillable     = ['product_id', 'base_price_bdt', 'start_date', 'end_date', 'status'];

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));

        $query = DB::table('product_price_versions as ppv')
            ->join('products as p', 'p.product_id', '=', 'ppv.product_id')
            ->select(
                'ppv.price_version_id',
                'ppv.product_id', 'p.product_name',
                'ppv.base_price_bdt',
                'ppv.start_date', 'ppv.end_date',
                'ppv.status'
            )
            ->orderBy('p.product_name')->orderByDesc('ppv.start_date');

        if ($request->product_id) {
            $query->where('ppv.product_id', Uuid::toBin($request->product_id));
        }
        if ($request->status) {
            $query->where('ppv.status', $request->status);
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => $this->castRecord($r))->values();

        if ($items->isNotEmpty()) {
            $binIds = $items->map(fn($r) => Uuid::toBin($r->price_version_id))->toArray();
            $grouped = DB::table('price_components')
                ->whereIn('price_version_id', $binIds)
                ->orderBy('sort_order')
                ->get()
                ->groupBy(fn($c) => Uuid::fromBin($c->price_version_id));

            $items = $items->map(function ($r) use ($grouped) {
                $r->components = collect($grouped->get($r->price_version_id, []))
                    ->map(fn($c) => [
                        'name'   => $c->component_name,
                        'type'   => $c->component_type,
                        'amount' => (float) $c->amount_bdt,
                    ])->values()->toArray();
                return $r;
            });
        }

        return response()->json(['items' => $items, 'total' => $total]);
    }

    public function store(Request $request)
    {
        $productBin = Uuid::toBin($request->product_id);
        $startDate  = $request->start_date; // expected: YYYY-MM-DD

        // Find the latest version for this product
        $latest = DB::table('product_price_versions')
            ->where('product_id', $productBin)
            ->orderByDesc('start_date')
            ->first();

        if ($latest && $startDate <= substr($latest->start_date, 0, 10)) {
            return response()->json([
                'message' => 'Start date must be after the current version start date (' . substr($latest->start_date, 0, 10) . ').',
                'field'   => 'start_date',
            ], 422);
        }

        // Close the previous version: end_date = new start_date − 1 day, status = EXPIRED
        if ($latest) {
            $endDate = date('Y-m-d', strtotime($startDate . ' -1 day'));
            DB::table('product_price_versions')
                ->where('price_version_id', $latest->price_version_id)
                ->update(['end_date' => $endDate, 'status' => 'EXPIRED', 'updated_at' => now()]);
        }

        $components = collect($request->input('components', []))
            ->filter(fn($c) => isset($c['name'], $c['amount']) && (float)$c['amount'] > 0)
            ->values();

        // base_price_bdt = sum of components if provided, else fall back to explicit field
        $basePriceBdt = $components->isNotEmpty()
            ? $components->sum(fn($c) => (float) $c['amount'])
            : (float) $request->base_price_bdt;

        $status = strtotime($startDate) <= time() ? 'CURRENT' : 'UPCOMING';
        $newId  = Uuid::make();
        DB::table('product_price_versions')->insert([
            'price_version_id' => $newId,
            'product_id'       => $productBin,
            'base_price_bdt'   => $basePriceBdt,
            'start_date'       => $startDate,
            'end_date'         => null,
            'status'           => $status,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        foreach ($components as $i => $c) {
            DB::table('price_components')->insert([
                'component_id'     => Uuid::make(),
                'price_version_id' => $newId,
                'component_name'   => $c['name'],
                'component_type'   => $c['type'] ?? 'MANDATORY',
                'amount_bdt'       => (float) $c['amount'],
                'sort_order'       => $i,
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);
        }

        $record = DB::table('product_price_versions')->where('price_version_id', $newId)->first();
        return response()->json($this->castRecord($record), 201);
    }

    /** GET /api/pricing?product_id=&status= — timeline view */
    public function timeline(Request $request)
    {
        $query = DB::table('product_price_versions as ppv')
            ->join('products as p', 'p.product_id', '=', 'ppv.product_id')
            ->select('ppv.*', 'p.product_name')
            ->orderBy('ppv.start_date');

        if ($request->product_id) {
            $query->where('ppv.product_id', $request->product_id);
        }
        if ($request->status) {
            $query->where('ppv.status', $request->status);
        }

        return response()->json($query->get());
    }
}
