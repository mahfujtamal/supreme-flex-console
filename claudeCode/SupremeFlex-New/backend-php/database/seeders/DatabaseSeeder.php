<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            GeographySeeder::class,
            ProductSeeder::class,
            DistributionSeeder::class,
            FieldOpsSeeder::class,
            GovernanceSeeder::class,
            CampaignSeeder::class,
            InventorySeeder::class,
        ]);

        if (app()->environment() !== 'production') {
            $this->call(DevUserSeeder::class);
        }
    }
}
