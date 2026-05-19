<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MasterData\NetworkZoneController;
use App\Http\Controllers\Api\MasterData\DistrictController;
use App\Http\Controllers\Api\MasterData\AreaController;
use App\Http\Controllers\Api\MasterData\ChannelController;
use App\Http\Controllers\Api\MasterData\SubChannelController;
use App\Http\Controllers\Api\MasterData\DistributionHouseController;
use App\Http\Controllers\Api\MasterData\HubManagerController;
use App\Http\Controllers\Api\MasterData\FieldAgentController;
use App\Http\Controllers\Api\MasterData\KamController;
use App\Http\Controllers\Api\ProductEngine\ProductController;
use App\Http\Controllers\Api\ProductEngine\PriceVersionController;
use App\Http\Controllers\Api\ProductEngine\PriceComponentController;
use App\Http\Controllers\Api\ProductEngine\AddonCompatibilityController;
use App\Http\Controllers\Api\CampaignEngine\CampaignController;
use App\Http\Controllers\Api\CampaignEngine\CouponController;
use App\Http\Controllers\Api\CampaignEngine\ReferralProgramController;
use App\Http\Controllers\Api\CampaignEngine\TargetingRuleController;
use App\Http\Controllers\Api\CampaignEngine\ProductRuleController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\StockTransferController;
use App\Http\Controllers\Api\Governance\AdminUserController;
use App\Http\Controllers\Api\Governance\AdminRoleController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ReferralRewardController;

// ── Public ──────────────────────────────────────────────────
Route::post('/auth/otp/request', [AuthController::class, 'requestOtp']);
Route::post('/auth/otp/verify',  [AuthController::class, 'verifyOtp']);

// ── Protected (JWT) ─────────────────────────────────────────
Route::middleware('auth.jwt')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',      [AuthController::class, 'me']);

    // Master Data
    Route::apiResource('network-zones',        NetworkZoneController::class);
    Route::apiResource('districts',            DistrictController::class);
    Route::apiResource('areas',                AreaController::class);
    Route::apiResource('channels',             ChannelController::class);
    Route::apiResource('sub-channels',         SubChannelController::class);
    Route::apiResource('distribution-houses',  DistributionHouseController::class);
    Route::apiResource('hub-managers',         HubManagerController::class);
    Route::apiResource('field-agents',         FieldAgentController::class);
    Route::apiResource('kams',                 KamController::class);

    // Product Engine
    Route::apiResource('products',             ProductController::class);
    Route::apiResource('price-versions',       PriceVersionController::class);
    Route::apiResource('price-components',     PriceComponentController::class);
    Route::apiResource('addon-compatibility',  AddonCompatibilityController::class);

    // Pricing Engine — timeline query
    Route::get('pricing', [PriceVersionController::class, 'timeline']);

    // Campaign Engine
    Route::apiResource('campaigns',        CampaignController::class);
    Route::post('campaigns/{id}/clone',    [CampaignController::class, 'clone']);
    Route::apiResource('coupons',          CouponController::class);
    Route::apiResource('referral-programs', ReferralProgramController::class);
    Route::apiResource('targeting-rules',  TargetingRuleController::class);
    Route::apiResource('product-rules',    ProductRuleController::class);

    // Customers
    Route::get('customers',          [CustomerController::class, 'index']);
    Route::get('customers/{id}',     [CustomerController::class, 'show']);
    Route::get('customers/{id}/360', [CustomerController::class, 'view360']);

    // Invoicing
    Route::get('invoices',              [InvoiceController::class, 'index']);
    Route::post('invoices',             [InvoiceController::class, 'store']);
    Route::get('transaction-ledger',    [InvoiceController::class, 'ledger']);

    // Asset Lifecycle
    Route::apiResource('assets',                AssetController::class);
    Route::post('assets/{id}/replace',          [AssetController::class, 'replace']);

    // Inventory
    Route::get('inventory',                     [InventoryController::class, 'index']);
    Route::post('inventory',                    [InventoryController::class, 'store']);
    Route::post('inventory/bulk-inward',        [InventoryController::class, 'bulkInward']);

    // Stock Transfers
    Route::apiResource('stock-transfers',           StockTransferController::class);
    Route::patch('stock-transfers/{id}/respond',    [StockTransferController::class, 'respond']);

    // Governance
    Route::apiResource('admin-users',   AdminUserController::class);
    Route::apiResource('admin-roles',   AdminRoleController::class);

    // Audit Logs
    Route::get('audit-logs',        [AuditLogController::class, 'index']);
    Route::post('audit-logs',       [AuditLogController::class, 'store']);
    Route::get('system-audit-logs', [AuditLogController::class, 'system']);

    // Dashboards
    Route::get('dashboard/gpfi',            [DashboardController::class, 'gpfi']);
    Route::get('dashboard/hub-manager',     [DashboardController::class, 'hubManager']);
    Route::get('dashboard/field-execution', [DashboardController::class, 'fieldExecution']);

    // Referral RPCs
    Route::post('referrals/check-reward',   [ReferralRewardController::class, 'checkReward']);
    Route::post('referrals/force-approve',  [ReferralRewardController::class, 'forceApprove']);
});
