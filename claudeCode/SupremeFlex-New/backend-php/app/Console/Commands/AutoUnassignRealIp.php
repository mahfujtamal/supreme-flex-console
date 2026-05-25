<?php

namespace App\Console\Commands;

use App\Services\Contracts\RealIpApiServiceInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutoUnassignRealIp extends Command
{
    protected $signature   = 'app:auto-unassign-real-ip';
    protected $description = 'Release real-IP assignments whose service is no longer ACTIVE';

    public function __construct(private readonly RealIpApiServiceInterface $realIpApi)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $rows = DB::select(
            "SELECT r.id, r.ip_address
             FROM real_ip_assignments r
             JOIN active_services s ON s.service_id = r.active_service_id
             WHERE r.status = 'ACTIVE' AND s.service_status != 'ACTIVE'"
        );

        foreach ($rows as $row) {
            try {
                $this->realIpApi->unassignIp($row->ip_address);

                DB::statement(
                    "UPDATE real_ip_assignments
                     SET status = 'RELEASED', released_at = NOW(), updated_at = NOW()
                     WHERE id = ?",
                    [$row->id]
                );

                Log::info('[AutoUnassignRealIp] released', ['ip' => $row->ip_address]);
            } catch (\Throwable $e) {
                Log::error('[AutoUnassignRealIp] failed', [
                    'ip'    => $row->ip_address,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info('Processed ' . count($rows) . ' real-IP assignment(s).');
        return self::SUCCESS;
    }
}
