<?php

namespace Database\Seeders;

use App\Support\CsvSeederHelper as H;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class InventorySeeder extends Seeder
{
    private const CATEGORY_TO_ITEM_TYPE = [
        'CPE'  => 'CPE',
        'SIM'  => 'SIM',
        'ADDON'=> 'ADDON',
    ];

    public function run(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('inventory_master')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        // Only physical products get stock rows (WIFI_PLAN has no inventory)
        $physicalProducts = DB::table('products')
            ->whereRaw("product_category IN ('CPE','SIM','ADDON')")
            ->whereRaw('status = 1')
            ->get(['product_id', 'product_category']);

        if ($physicalProducts->isEmpty()) {
            $this->command->warn('  InventorySeeder: no physical products found');
            return;
        }

        $dhs = DB::table('distribution_houses')
            ->whereRaw("status = 'ACTIVE'")
            ->orderByRaw('created_at ASC')
            ->limit(20)
            ->get(['dh_id']);

        $now  = now()->toDateTimeString();
        $rows = [];

        foreach ($dhs as $dh) {
            foreach ($physicalProducts as $product) {
                $itemType = self::CATEGORY_TO_ITEM_TYPE[$product->product_category];
                for ($i = 0; $i < 20; $i++) {
                    $rows[] = [
                        'inventory_id'        => H::uuid7Bin(),
                        'product_id'          => $product->product_id,
                        'item_type'           => $itemType,
                        'status'              => 'ALLOCATED_TO_DH',
                        'stock_type'          => 'SALES_STOCK',
                        'allocated_entity_id' => $dh->dh_id,
                        'created_at'          => $now,
                        'updated_at'          => $now,
                    ];
                }
            }
        }

        $n = H::chunkInsert('inventory_master', $rows);
        $this->command->line("  inventory_master: {$n} rows");
    }
}
