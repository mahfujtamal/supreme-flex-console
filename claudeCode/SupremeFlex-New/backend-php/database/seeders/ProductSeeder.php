<?php

namespace Database\Seeders;

use App\Support\CsvSeederHelper as H;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedProducts();
        $this->seedPriceVersions();
        $this->seedPriceComponents();
        $this->seedAddonCompatibility();
    }

    private function seedProducts(): void
    {
        $rows = array_map(fn($r) => [
            'product_id'         => H::uuidToBin($r['product_id']),
            'product_name'       => $r['product_name'],
            'product_category'   => $r['product_category'],
            'addon_type'         => H::nullIfEmpty($r['addon_type']),
            'billing_type'       => $r['billing_type'],
            'network_capability' => $r['network_capability'],
            'is_exclusive'       => H::bool($r['is_exclusive']),
            'serial_required'    => H::bool($r['serial_required']),
            'warranty_value'     => H::nullIfEmpty($r['warranty_value']),
            'warranty_unit'      => H::nullIfEmpty($r['warranty_unit']),
            'status'             => H::bool($r['status']),
            'created_at'         => H::ts($r['created_at']),
            'updated_at'         => H::ts($r['updated_at']),
        ], H::loadCsv('products'));

        $n = H::chunkInsert('products', $rows);
        $this->command->line("  products: {$n} rows");
    }

    private function seedPriceVersions(): void
    {
        $rows = array_map(fn($r) => [
            'price_version_id' => H::uuidToBin($r['price_version_id']),
            'product_id'       => H::uuidToBin($r['product_id']),
            'base_price_bdt'   => $r['base_price_bdt'],
            'start_date'       => H::ts($r['start_date']),
            'end_date'         => H::ts($r['end_date']),
            // CSV true = active (CURRENT), false = replaced (EXPIRED)
            'status'           => H::bool($r['status']) ? 'CURRENT' : 'EXPIRED',
            'created_at'       => H::ts($r['created_at']),
            'updated_at'       => H::ts($r['updated_at']),
        ], H::loadCsv('product_price_versions'));

        $n = H::chunkInsert('product_price_versions', $rows);
        $this->command->line("  product_price_versions: {$n} rows");
    }

    private function seedPriceComponents(): void
    {
        $rows = array_map(fn($r) => [
            'component_id'     => H::uuidToBin($r['component_id']),
            'price_version_id' => H::uuidToBin($r['price_version_id']),
            'component_name'   => $r['component_name'],
            'component_type'   => $r['component_type'],
            'amount_bdt'       => $r['amount_bdt'],
            'sort_order'       => (int) $r['sort_order'],
            'created_at'       => H::ts($r['created_at']),
        ], H::loadCsv('price_components'));

        $n = H::chunkInsert('price_components', $rows);
        $this->command->line("  price_components: {$n} rows");
    }

    private function seedAddonCompatibility(): void
    {
        $rows = array_map(fn($r) => [
            'compatibility_id' => H::uuidToBin($r['compatibility_id']),
            'addon_product_id' => H::uuidToBin($r['addon_product_id']),
            'cpe_product_id'   => H::uuidToBin($r['cpe_product_id']),
            'created_at'       => H::ts($r['created_at']),
        ], H::loadCsv('physical_addon_compatibility'));

        $n = H::chunkInsert('physical_addon_compatibility', $rows);
        $this->command->line("  physical_addon_compatibility: {$n} rows");
    }
}
