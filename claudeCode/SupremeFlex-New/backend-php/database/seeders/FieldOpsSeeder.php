<?php

namespace Database\Seeders;

use App\Support\CsvSeederHelper as H;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class FieldOpsSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedKams();
        $this->seedFieldAgents();
    }

    private function seedKams(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('kam_segment_assignments')->truncate();
        DB::table('kams')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        // name → segments mapping (CSV KAM_1 → Prime; synthetics cover the other two)
        $segmentMap = [
            'KAM_1_Name' => ['Prime'],
            'KAM_2_Name' => ['Large Account'],
            'KAM_3_Name' => ['SME'],
        ];

        $csvRows = H::loadCsv('kams');
        $rows    = [];
        $kamIds  = []; // name → binary id

        foreach ($csvRows as $r) {
            $id = H::uuid7Bin();
            $kamIds[$r['name']] = $id;
            $rows[] = [
                'kam_id'              => $id,
                'name'                => $r['name'],
                'msisdn'              => H::nullIfEmpty($r['msisdn']),
                'status'              => H::bool($r['status']),
                'inventory_pull_mode' => 'PUSH',
                'created_at'          => H::ts($r['created_at']),
                'updated_at'          => H::ts($r['updated_at']),
            ];
        }

        // Two additional KAMs for broader UAT coverage
        foreach ([
            ['KAM_2_Name', '01711234567'],
            ['KAM_3_Name', '01711345678'],
        ] as [$name, $msisdn]) {
            $id = H::uuid7Bin();
            $kamIds[$name] = $id;
            $rows[] = [
                'kam_id'              => $id,
                'name'                => $name,
                'msisdn'              => $msisdn,
                'status'              => 1,
                'inventory_pull_mode' => 'PUSH',
                'created_at'          => now()->toDateTimeString(),
                'updated_at'          => now()->toDateTimeString(),
            ];
        }

        H::chunkInsert('kams', $rows);
        $this->command->line('  kams: ' . count($rows) . ' rows');

        // Seed segment assignments
        $segments = DB::table('kam_segments')
            ->get(['segment_id', 'segment_name'])
            ->keyBy('segment_name');

        $assignmentRows = [];
        $now = now()->toDateTimeString();
        foreach ($kamIds as $kamName => $kamId) {
            foreach ($segmentMap[$kamName] ?? [] as $segName) {
                if ($seg = $segments[$segName] ?? null) {
                    $assignmentRows[] = [
                        'kam_id'         => $kamId,
                        'segment_id'     => $seg->segment_id,
                        'effective_from' => '2026-01-01',
                        'effective_until'=> null,
                        'created_at'     => $now,
                    ];
                }
            }
        }

        H::chunkInsert('kam_segment_assignments', $assignmentRows);
        $this->command->line('  kam_segment_assignments: ' . count($assignmentRows) . ' rows');
    }

    private function seedFieldAgents(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('field_agents')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $rows = array_map(fn($r) => [
            'agent_id'   => H::uuid7Bin(), // CSV agent_id is a string code; DB is BINARY(16)
            'agent_name' => $r['agent_name'],
            'dh_id'      => H::nullIfEmpty($r['dh_id']) ? H::uuidToBin($r['dh_id']) : null,
            'msisdn'     => H::nullIfEmpty($r['msisdn']),
            'status'     => $r['status'],
            'created_at' => H::ts($r['created_at']),
            'updated_at' => H::ts($r['updated_at']),
        ], H::loadCsv('field_agents'));

        $n = H::chunkInsert('field_agents', $rows);
        $this->command->line("  field_agents: {$n} rows");
    }
}
