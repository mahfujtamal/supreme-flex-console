<?php

namespace Database\Seeders;

use App\Support\CsvSeederHelper as H;
use Illuminate\Database\Seeder;

class GeographySeeder extends Seeder
{
    public function run(): void
    {
        $this->seedCircles();
        $this->seedNetworkZones();
        $this->seedRegions();
        $this->seedDistricts();
        $this->seedClusters();
        $this->seedTerritories();
        $this->seedAreas();
    }

    private function seedCircles(): void
    {
        $rows = array_map(fn($r) => [
            'circle_id'   => H::uuidToBin($r['circle_id']),
            'circle_name' => $r['circle_name'],
            'status'      => H::bool($r['status']),
            'created_at'  => H::ts($r['created_at']),
            'updated_at'  => H::ts($r['updated_at']),
        ], H::loadCsv('circles'));

        $n = H::chunkInsert('circles', $rows);
        $this->command->line("  circles: {$n} rows");
    }

    private function seedNetworkZones(): void
    {
        $rows = array_map(fn($r) => [
            'network_zone_id'   => H::uuidToBin($r['network_zone_id']),
            'network_zone_name' => $r['network_zone_name'],
            '4g_rsrp'           => H::nullIfEmpty($r['4g_rsrp']),
            '4g_rsrq'           => H::nullIfEmpty($r['4g_rsrq']),
            '4g_snr'            => H::nullIfEmpty($r['4g_snr']),
            '5g_rsrp'           => H::nullIfEmpty($r['5g_rsrp']),
            '5g_rsrq'           => H::nullIfEmpty($r['5g_rsrq']),
            '5g_snr'            => H::nullIfEmpty($r['5g_snr']),
            'status'            => H::bool($r['status']),
            'created_at'        => H::ts($r['created_at']),
            'updated_at'        => H::ts($r['updated_at']),
        ], H::loadCsv('network_zones'));

        $n = H::chunkInsert('network_zones', $rows);
        $this->command->line("  network_zones: {$n} rows");
    }

    private function seedRegions(): void
    {
        $rows = array_map(fn($r) => [
            'region_id'   => H::uuidToBin($r['region_id']),
            'circle_id'   => H::uuidToBin($r['circle_id']),
            'region_name' => $r['region_name'],
            'status'      => H::bool($r['status']),
            'created_at'  => H::ts($r['created_at']),
            'updated_at'  => H::ts($r['updated_at']),
        ], H::loadCsv('regions'));

        $n = H::chunkInsert('regions', $rows);
        $this->command->line("  regions: {$n} rows");
    }

    private function seedDistricts(): void
    {
        $rows = array_map(fn($r) => [
            'district_id'   => H::uuidToBin($r['district_id']),
            'district_name' => $r['district_name'],
            'status'        => H::bool($r['status']),
            'created_at'    => H::ts($r['created_at']),
            'updated_at'    => H::ts($r['updated_at']),
        ], H::loadCsv('districts'));

        $n = H::chunkInsert('districts', $rows);
        $this->command->line("  districts: {$n} rows");
    }

    private function seedClusters(): void
    {
        $rows = array_map(fn($r) => [
            'cluster_id'   => H::uuidToBin($r['cluster_id']),
            'cluster_name' => $r['cluster_name'],
            'region_id'    => H::uuidToBin($r['region_id']),
            'status'       => H::bool($r['status']),
            'created_at'   => H::ts($r['created_at']),
            'updated_at'   => H::ts($r['updated_at']),
        ], H::loadCsv('clusters'));

        $n = H::chunkInsert('clusters', $rows);
        $this->command->line("  clusters: {$n} rows");
    }

    private function seedTerritories(): void
    {
        $rows = array_map(fn($r) => [
            'territory_id'   => H::uuidToBin($r['territory_id']),
            'territory_name' => $r['territory_name'],
            'cluster_id'     => H::uuidToBin($r['cluster_id']),
            'status'         => H::bool($r['status']),
            'created_at'     => H::ts($r['created_at']),
            'updated_at'     => H::ts($r['updated_at']),
        ], H::loadCsv('territories'));

        $n = H::chunkInsert('territories', $rows);
        $this->command->line("  territories: {$n} rows");
    }

    private function seedAreas(): void
    {
        $rows = array_map(fn($r) => [
            'area_id'                => H::uuidToBin($r['area_id']),
            'area_name'              => $r['area_name'],
            'district_id'            => H::uuidToBin($r['district_id']),
            'network_zone_id'        => H::uuidToBin($r['network_zone_id']),
            'is_4g_area'             => H::bool($r['is_4g_area']),
            'is_5g_area'             => H::bool($r['is_5g_area']),
            'last_assigned_dh_index' => (int) ($r['last_assigned_dh_index'] ?? 0),
            'created_at'             => H::ts($r['created_at']),
            'updated_at'             => H::ts($r['updated_at']),
        ], H::loadCsv('areas'));

        $n = H::chunkInsert('areas', $rows);
        $this->command->line("  areas: {$n} rows");
    }
}
