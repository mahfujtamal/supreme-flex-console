<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends BaseApiController
{
    protected string $table        = 'onetime_invoices';
    protected string $primaryKey   = 'invoice_id';
    protected string $searchColumn = 'customer_id';
    protected array  $fillable     = [
        'customer_id', 'parent_summary_invoice_id', 'payment_status',
        'trigger_type', 'charged_amount_bdt', 'refund_amount_bdt',
        'refund_reason', 'refunded_at',
    ];

    public function ledger(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));

        $query = DB::table('transaction_ledger')->orderByDesc('created_at');
        if ($request->customer_id) $query->where('customer_id', $request->customer_id);

        $total   = $query->count();
        $records = $query->offset($page * $perPage)->limit($perPage)->get();

        return response()->json(['items' => $records, 'total' => $total]);
    }
}
