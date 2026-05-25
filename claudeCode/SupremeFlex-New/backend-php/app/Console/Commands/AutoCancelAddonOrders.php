<?php

namespace App\Console\Commands;

use App\Services\Contracts\GpShopServiceInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutoCancelAddonOrders extends Command
{
    protected $signature   = 'app:auto-cancel-addon-orders';
    protected $description = 'Cancel overdue PENDING addon orders via GP Shop API';

    public function __construct(private readonly GpShopServiceInterface $gpShop)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $rows = DB::select(
            "SELECT id, gpshop_order_id FROM addon_order_history
             WHERE status = 'PENDING' AND auto_cancel_at IS NOT NULL AND auto_cancel_at <= NOW()"
        );

        foreach ($rows as $row) {
            try {
                if ($row->gpshop_order_id !== null) {
                    $this->gpShop->cancelOrder($row->gpshop_order_id);
                }

                DB::statement(
                    "UPDATE addon_order_history SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?",
                    [$row->id]
                );

                Log::info('[AutoCancelAddonOrders] cancelled', ['id' => bin2hex($row->id)]);
            } catch (\Throwable $e) {
                Log::error('[AutoCancelAddonOrders] failed', [
                    'id'    => bin2hex($row->id),
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info('Processed ' . count($rows) . ' overdue addon order(s).');
        return self::SUCCESS;
    }
}
