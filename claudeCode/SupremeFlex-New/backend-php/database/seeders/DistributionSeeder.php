<?php

namespace Database\Seeders;

use App\Support\CsvSeederHelper as H;
use Illuminate\Database\Seeder;

class DistributionSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedChannels();
        $this->seedDistributionHouses();
        $this->seedDhAreaAssignments();
    }

    private function seedChannels(): void
    {
        $rows = array_map(fn($r) => [
            'channel_id'        => H::uuidToBin($r['channel_id']),
            'channel_name'      => $r['channel_name'],
            'is_assisted'       => H::bool($r['is_assisted']),
            'is_self_delivered' => H::bool($r['is_self_delivered']),
            'status'            => H::bool($r['status']),
            'created_at'        => H::ts($r['created_at']),
            'updated_at'        => H::ts($r['updated_at']),
        ], H::loadCsv('channels'));

        $n = H::chunkInsert('channels', $rows);
        $this->command->line("  channels: {$n} rows");
    }

    private function seedDistributionHouses(): void
    {
        $rows = array_map(fn($r) => [
            'dh_id'               => H::uuidToBin($r['dh_id']),
            'dh_code'             => $r['dh_code'],
            'name'                => $r['name'],
            'territory_id'        => H::nullIfEmpty($r['territory_id'])
                                        ? H::uuidToBin($r['territory_id']) : null,
            'manager_admin_id'    => null, // linked by GovernanceSeeder
            'inventory_pull_mode' => 'PUSH',
            'phone_number'        => H::nullIfEmpty($r['phone_number']),
            'onboarded_at'        => date('Y-m-d', rand(strtotime('2025-09-15'), strtotime('2025-10-31'))),
            'last_assigned_at'    => H::ts($r['last_assigned_at']),
            'status'              => $r['status'],
            'created_at'          => H::ts($r['created_at']),
            'updated_at'          => H::ts($r['updated_at']),
        ], H::loadCsv('distribution_houses'));

        $n = H::chunkInsert('distribution_houses', $rows);
        $this->command->line("  distribution_houses: {$n} rows");
    }

    private function seedDhAreaAssignments(): void
    {
        // CSV has an extra `id` column not in the DB (composite PK is dh_id + area_id)
        $rows = array_map(fn($r) => [
            'dh_id'      => H::uuidToBin($r['dh_id']),
            'area_id'    => H::uuidToBin($r['area_id']),
            'created_at' => H::ts($r['created_at']),
        ], H::loadCsv('dh_area_assignments'));

        $n = H::chunkInsert('dh_area_assignments', $rows);
        $this->command->line("  dh_area_assignments: {$n} rows");
    }
}
