<?php

namespace Database\Seeders;

use App\Support\CsvSeederHelper as H;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class GovernanceSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedRoles();
        $this->seedDhManagers();
    }

    private function seedRoles(): void
    {
        $rows = array_map(fn($r) => [
            'role_id'          => H::uuidToBin($r['role_id']),
            'role_name'        => $r['role_name'],
            'role_description' => H::nullIfEmpty($r['role_description']),
            'created_at'       => H::ts($r['created_at']),
        ], H::loadCsv('role_master'));

        $n = H::chunkInsert('role_master', $rows);
        $this->command->line("  role_master: {$n} rows");
    }

    private function seedDhManagers(): void
    {
        $hubManagerRole = DB::table('role_master')
            ->whereRaw("role_name = 'Hub Manager'")
            ->first();

        if (!$hubManagerRole) {
            $this->command->warn('  GovernanceSeeder: Hub Manager role not found, skipping DH managers');
            return;
        }

        $dhs = DB::table('distribution_houses')
            ->orderByRaw('created_at ASC')
            ->limit(10)
            ->get(['dh_id', 'dh_code', 'name']);

        $userRows  = [];
        $adminRows = [];
        $dhUpdates = [];

        foreach ($dhs as $dh) {
            $userId  = H::uuid7Bin();
            $adminId = H::uuid7Bin();
            $code    = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $dh->dh_code));
            $now     = now()->toDateTimeString();

            $userRows[] = [
                'id'             => $userId,
                'user_name'      => "Manager {$dh->dh_code}",
                'email'          => "mgr.{$code}@supremeflex.internal",
                'contact_number' => null,
                'staff_type'     => 'HUB_MANAGER',
                'created_at'     => $now,
                'updated_at'     => $now,
            ];

            $adminRows[] = [
                'admin_id'   => $adminId,
                'email'      => "mgr.{$code}@supremeflex.internal",
                'full_name'  => "Manager {$dh->name}",
                'role_id'    => $hubManagerRole->role_id,
                'is_active'  => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $dhUpdates[] = ['dh_id' => $dh->dh_id, 'manager_admin_id' => $adminId];
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('user_account')->insertOrIgnore($userRows);
        DB::table('admin_users')->insertOrIgnore($adminRows);
        foreach ($dhUpdates as $u) {
            DB::table('distribution_houses')
                ->whereRaw('dh_id = ?', [$u['dh_id']])
                ->update(['manager_admin_id' => $u['manager_admin_id']]);
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $this->command->line('  admin_users (DH managers): ' . count($adminRows) . ' rows');
    }
}
