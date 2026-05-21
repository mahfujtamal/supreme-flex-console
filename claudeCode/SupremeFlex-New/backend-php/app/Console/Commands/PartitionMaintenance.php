<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PartitionMaintenance extends Command
{
    protected $signature   = 'db:partition-maintenance {--dry-run : Print SQL without executing}';
    protected $description = 'Add next-month partitions to audit_logs, transaction_ledger, and otp_codes';

    public function handle(): int
    {
        $nextMonth = now()->addMonth()->startOfMonth();
        $partName  = 'p' . $nextMonth->format('Ym');        // e.g. p202507
        $cutoff    = $nextMonth->addMonth()->format('Y-m-d'); // exclusive upper bound

        $tables = ['audit_logs', 'transaction_ledger', 'otp_codes'];

        foreach ($tables as $table) {
            $sql = "ALTER TABLE `{$table}` ADD PARTITION "
                 . "(PARTITION `{$partName}` VALUES LESS THAN (TO_DAYS('{$cutoff}')))";

            if ($this->option('dry-run')) {
                $this->line($sql);
                continue;
            }

            try {
                DB::statement($sql);
                Log::info("[PartitionMaintenance] Added {$partName} to {$table}");
                $this->info("+ {$table}: {$partName} added");
            } catch (\Throwable $e) {
                if (str_contains($e->getMessage(), 'Duplicate partition')) {
                    $this->line("  {$table}: {$partName} already exists — skipped");
                } else {
                    Log::error("[PartitionMaintenance] {$table}: {$e->getMessage()}");
                    $this->error("! {$table}: {$e->getMessage()}");
                }
            }
        }

        return self::SUCCESS;
    }
}
