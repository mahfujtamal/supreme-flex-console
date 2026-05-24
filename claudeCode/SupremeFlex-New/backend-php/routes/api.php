<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MasterData\NetworkZoneController;
use App\Http\Controllers\Api\MasterData\DistrictController;
use App\Http\Controllers\Api\MasterData\AreaController;
use App\Http\Controllers\Api\MasterData\ChannelController;
use App\Http\Controllers\Api\MasterData\SubChannelController;
use App\Http\Controllers\Api\MasterData\DistributionHouseController;
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
use App\Http\Controllers\Api\SystemConfigController;
use App\Http\Controllers\Api\InternalController;
use App\Http\Controllers\Api\AddonOrderController;
use App\Http\Controllers\Api\CpeOrderController;
use App\Http\Controllers\Api\OttOrderController;
use App\Http\Controllers\Api\LocationChangeController;
use App\Http\Controllers\Api\RealIpController;

// ── Public ──────────────────────────────────────────────────
Route::post('/auth/otp/request', [AuthController::class, 'requestOtp']);
Route::post('/auth/otp/verify',  [AuthController::class, 'verifyOtp']);
Route::post('/auth/refresh',     [AuthController::class, 'refresh']);

// Dev-only: peek at the last issued OTP (Redis-cached plaintext, 5 min TTL)
if (config('app.env') !== 'production') {
    Route::get('/auth/otp/dev-peek', [AuthController::class, 'devPeekOtp']);
}

// ── Internal (Node → PHP, key-protected, no JWT) ────────────
Route::middleware('internal.key')->group(function () {
    Route::post('/internal/sms', [InternalController::class, 'sendSms']);
});

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

    // TODO(p-1.3): add idempotency middleware when AddonOrderController routes are registered (group 2: addon_order_history)
    // TODO(p-1.3): add idempotency middleware when CpeOrderController routes are registered (group 3: cpe_order_history)
    // TODO(p-1.3): add idempotency middleware when OttOrderController routes are registered (group 4: ott_order_history)
    // TODO(p-1.3): add idempotency middleware when RealIpAssignmentController routes are registered (group 5: real_ip_assignments)

    // System Config
    Route::get('system-config',          [SystemConfigController::class, 'index']);
    Route::get('system-config/{key}',    [SystemConfigController::class, 'show']);
    Route::put('system-config/{key}',    [SystemConfigController::class, 'upsert']);
    Route::delete('system-config/{key}', [SystemConfigController::class, 'destroy']);

    // GPWEB-3730 — order histories + location + real IP
    Route::get('addon-orders',          [AddonOrderController::class, 'index']);
    Route::post('addon-orders',         [AddonOrderController::class, 'store']);
    Route::get('addon-orders/{id}',     [AddonOrderController::class, 'show']);
    Route::patch('addon-orders/{id}',   [AddonOrderController::class, 'update']);

    Route::get('cpe-orders',            [CpeOrderController::class, 'index']);
    Route::post('cpe-orders',           [CpeOrderController::class, 'store']);
    Route::get('cpe-orders/{id}',       [CpeOrderController::class, 'show']);
    Route::patch('cpe-orders/{id}',     [CpeOrderController::class, 'update']);

    Route::get('ott-orders',            [OttOrderController::class, 'index']);
    Route::post('ott-orders',           [OttOrderController::class, 'store']);
    Route::get('ott-orders/{id}',       [OttOrderController::class, 'show']);
    Route::patch('ott-orders/{id}',     [OttOrderController::class, 'update']);

    Route::get('location-changes',      [LocationChangeController::class, 'index']);
    Route::post('location-changes',     [LocationChangeController::class, 'store']);
    Route::get('location-changes/{id}', [LocationChangeController::class, 'show']);
    Route::patch('location-changes/{id}', [LocationChangeController::class, 'update']);

    Route::get('real-ip',               [RealIpController::class, 'index']);
    Route::post('real-ip',              [RealIpController::class, 'store']);
    Route::get('real-ip/{id}',          [RealIpController::class, 'show']);
    Route::delete('real-ip/{id}',       [RealIpController::class, 'destroy']);

    // Asset Lifecycle
    Route::apiResource('assets',                AssetController::class);
    Route::post('assets/{id}/replace',          [AssetController::class, 'replace']);

    // Inventory
    Route::get('inventory',                     [InventoryController::class, 'index']);
    Route::post('inventory',                    [InventoryController::class, 'store']);
    Route::post('inventory/bulk-inward',        [InventoryController::class, 'bulkInward']);

    // Stock Transfers — group 6: idempotency required on all mutating routes
    Route::middleware('idempotency')->group(function () {
        Route::apiResource('stock-transfers',           StockTransferController::class);
        Route::patch('stock-transfers/{id}/respond',    [StockTransferController::class, 'respond']);
    });

    // Governance (admin role required)
    Route::middleware('permission:admin')->group(function () {
        Route::apiResource('admin-users', AdminUserController::class);
        Route::apiResource('admin-roles', AdminRoleController::class);
    });

    // Audit Logs
    Route::get('audit-logs',        [AuditLogController::class, 'index']);
    Route::post('audit-logs',       [AuditLogController::class, 'store']);
    Route::get('system-audit-logs', [AuditLogController::class, 'system']);

    // Dashboards
    Route::get('dashboard/gpfi',            [DashboardController::class, 'gpfi']);
    Route::get('dashboard/hub-manager',     [DashboardController::class, 'hubManager']);
    Route::get('dashboard/field-execution', [DashboardController::class, 'fieldExecution']);

    // Referral RPCs — group 7: referral-programs / referral_redemptions
    Route::middleware('idempotency')->group(function () {
        Route::post('referrals/check-reward',   [ReferralRewardController::class, 'checkReward']);
        Route::post('referrals/force-approve',  [ReferralRewardController::class, 'forceApprove']);
    });

    // Bulk Operations — POST /{resource}/bulk · PATCH /{resource}/bulk · DELETE /{resource}/bulk (dev-only)
    // Excluded: customers/invoices (B2C flows), inventory (has bulkInward), stock-transfers (custom flow), audit-logs, dashboards
    // Groups 8 & 9: bulk-insert (POST /bulk) and bulk-update (PATCH /bulk) require idempotency.
    // Bulk-delete is dev-only and excluded from idempotency enforcement.
    $bulkResources = [
        'network-zones'       => NetworkZoneController::class,
        'districts'           => DistrictController::class,
        'areas'               => AreaController::class,
        'channels'            => ChannelController::class,
        'sub-channels'        => SubChannelController::class,
        'distribution-houses' => DistributionHouseController::class,
        'field-agents'        => FieldAgentController::class,
        'kams'                => KamController::class,
        'products'            => ProductController::class,
        'price-versions'      => PriceVersionController::class,
        'price-components'    => PriceComponentController::class,
        'addon-compatibility' => AddonCompatibilityController::class,
        'campaigns'           => CampaignController::class,
        'coupons'             => CouponController::class,
        'referral-programs'   => ReferralProgramController::class,
        'targeting-rules'     => TargetingRuleController::class,
        'product-rules'       => ProductRuleController::class,
        'assets'              => AssetController::class,
        'admin-users'         => AdminUserController::class,
        'admin-roles'         => AdminRoleController::class,
    ];

    // Group 8: Bulk-insert routes — POST /{resource}/bulk
    Route::middleware('idempotency')->group(function () use ($bulkResources) {
        foreach ($bulkResources as $resource => $controller) {
            Route::post("{$resource}/bulk", [$controller, 'bulkStore']);
        }
    });

    // Group 9: Bulk-update routes — PATCH /{resource}/bulk
    Route::middleware('idempotency')->group(function () use ($bulkResources) {
        foreach ($bulkResources as $resource => $controller) {
            Route::patch("{$resource}/bulk", [$controller, 'bulkUpdate']);
        }
    });

    // Bulk-delete — dev-only, no idempotency (destructive ops are not replayed)
    foreach ($bulkResources as $resource => $controller) {
        Route::delete("{$resource}/bulk", [$controller, 'bulkDestroy']);
    }
});
