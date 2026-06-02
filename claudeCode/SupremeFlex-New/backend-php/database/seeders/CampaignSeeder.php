<?php

namespace Database\Seeders;

use App\Support\CsvSeederHelper as H;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class CampaignSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedCampaigns();
        $this->seedReferralPrograms();
        $this->seedTargetingRules();
        $this->seedProductRules();
        $this->seedCoupons();
    }

    private function seedCampaigns(): void
    {
        $rows = array_map(fn($r) => [
            'campaign_id'                    => H::uuidToBin($r['campaign_id']),
            'campaign_name'                  => $r['campaign_name'],
            'description'                    => H::nullIfEmpty($r['description']),
            'start_date'                     => H::ts($r['start_date']),
            'end_date'                       => H::ts($r['end_date']),
            'scope'                          => $r['scope'],
            'campaign_trigger_type'          => $r['campaign_trigger_type'],
            'campaign_rank'                  => (int) $r['campaign_rank'],
            'allow_cod_payment'              => H::bool($r['allow_cod_payment']),
            'allow_online_payment'           => H::bool($r['allow_online_payment']),
            'on_ownership_transfer_behavior' => $r['on_ownership_transfer_behavior'],
            'status'                         => H::bool($r['status']),
            'created_at'                     => H::ts($r['created_at']),
            'updated_at'                     => H::ts($r['updated_at']),
        ], H::loadCsv('campaign_master'));

        $n = H::chunkInsert('campaign_master', $rows);
        $this->command->line("  campaign_master: {$n} rows");
    }

    private function seedReferralPrograms(): void
    {
        $rows = array_map(fn($r) => [
            'program_id'                 => H::uuidToBin($r['program_id']),
            'campaign_id'                => H::uuidToBin($r['campaign_id']),
            'start_date'                 => H::ts($r['start_date']),
            'end_date'                   => H::ts($r['end_date']),
            'max_referrals_per_customer' => (int) $r['max_referrals_per_customer'],
            'referrer_product_id'        => H::nullIfEmpty($r['referrer_product_id'])
                                               ? H::uuidToBin($r['referrer_product_id']) : null,
            'referrer_reward_type'       => H::nullIfEmpty($r['referrer_reward_type']),
            'referrer_reward_value'      => H::nullIfEmpty($r['referrer_reward_value']),
            'referrer_reward_unit'       => H::nullIfEmpty($r['referrer_reward_unit']),
            'referee_config_matrix'      => H::nullIfEmpty($r['referee_config_matrix']),
            'referral_code_prefix'       => H::nullIfEmpty($r['referral_code_prefix']),
            'is_locked'                  => H::bool($r['is_locked']),
            'reward_on_signup'           => H::bool($r['reward_on_signup']),
            'status'                     => H::bool($r['status']),
            'created_at'                 => H::ts($r['created_at']),
            'updated_at'                 => H::ts($r['updated_at']),
        ], H::loadCsv('referral_programs'));

        $n = H::chunkInsert('referral_programs', $rows);
        $this->command->line("  referral_programs: {$n} rows");
    }

    private function seedTargetingRules(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('campaign_targeting_rules')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        $campaigns = DB::table('campaign_master')
            ->get(['campaign_id', 'campaign_name'])
            ->keyBy(fn($c) => $c->campaign_name);

        $now  = now()->toDateTimeString();
        $rows = [];

        // Summer Promo 2026 — target Metro + Urban network zones
        if ($campaign = $campaigns['Summer Promo 2026'] ?? null) {
            foreach (['Metro', 'Urban'] as $zoneName) {
                $zone = DB::table('network_zones')
                    ->whereRaw('network_zone_name = ?', [$zoneName])
                    ->first();
                if ($zone) {
                    $rows[] = [
                        'rule_id'         => H::uuid7Bin(),
                        'campaign_id'     => $campaign->campaign_id,
                        'network_zone_id' => $zone->network_zone_id,
                        'network_type'    => 'ANY',
                        'created_at'      => $now,
                        'updated_at'      => $now,
                    ];
                }
            }
        }

        // Referral Program Apr 2026 — no geographic restriction
        if ($campaign = $campaigns['Referral Program Apr 2026'] ?? null) {
            $rows[] = [
                'rule_id'         => H::uuid7Bin(),
                'campaign_id'     => $campaign->campaign_id,
                'network_zone_id' => null,
                'network_type'    => 'ANY',
                'created_at'      => $now,
                'updated_at'      => $now,
            ];
        }

        $n = H::chunkInsert('campaign_targeting_rules', $rows);
        $this->command->line("  campaign_targeting_rules: {$n} rows");
    }

    private function seedProductRules(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('campaign_product_rules')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $campaigns = DB::table('campaign_master')
            ->get(['campaign_id', 'campaign_name'])
            ->keyBy(fn($c) => $c->campaign_name);

        $now  = now()->toDateTimeString();
        $rows = [];

        // Summer Promo 2026 — 20% discount on all CPE products
        if ($campaign = $campaigns['Summer Promo 2026'] ?? null) {
            $cpeProducts = DB::table('products')
                ->whereRaw("product_category = 'CPE'")
                ->get(['product_id']);
            foreach ($cpeProducts as $p) {
                $rows[] = [
                    'rule_id'               => H::uuid7Bin(),
                    'campaign_id'           => $campaign->campaign_id,
                    'product_id'            => $p->product_id,
                    'rule_type'             => 'DISCOUNT',
                    'discount_type'         => 'PERCENT',
                    'discount_value'        => 20.00,
                    'applicable_components' => '["BASE"]',
                    'created_at'            => $now,
                    'updated_at'            => $now,
                ];
            }
        }

        // Referral Program Apr 2026 — flat BDT 100 off gpfi1000
        if ($campaign = $campaigns['Referral Program Apr 2026'] ?? null) {
            $product = DB::table('products')
                ->whereRaw("product_name = 'gpfi1000'")
                ->first();
            if ($product) {
                $rows[] = [
                    'rule_id'               => H::uuid7Bin(),
                    'campaign_id'           => $campaign->campaign_id,
                    'product_id'            => $product->product_id,
                    'rule_type'             => 'DISCOUNT',
                    'discount_type'         => 'FLAT',
                    'discount_value'        => 100.00,
                    'applicable_components' => '["BASE"]',
                    'created_at'            => $now,
                    'updated_at'            => $now,
                ];
            }
        }

        $n = H::chunkInsert('campaign_product_rules', $rows);
        $this->command->line("  campaign_product_rules: {$n} rows");
    }

    private function seedCoupons(): void
    {
        $couponCampaign = DB::table('campaign_master')
            ->whereRaw("campaign_name = 'Coupon Mania'")
            ->first();

        if (!$couponCampaign) {
            $this->command->warn('  CampaignSeeder: Coupon Mania campaign not found, skipping coupons');
            return;
        }

        $now  = now()->toDateTimeString();
        $rows = [];
        for ($i = 1; $i <= 10; $i++) {
            $rows[] = [
                'coupon_id'             => H::uuid7Bin(),
                'campaign_id'           => $couponCampaign->campaign_id,
                'coupon_code'           => sprintf('COUP%03d', $i),
                'global_usage_limit'    => 1,
                'current_global_uses'   => 0,
                'max_uses_per_customer' => 1,
                'status'                => 1,
                'created_at'            => $now,
                'updated_at'            => $now,
            ];
        }

        $n = H::chunkInsert('coupons', $rows);
        $this->command->line("  coupons: {$n} rows");
    }
}
