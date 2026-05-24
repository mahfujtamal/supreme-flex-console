<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $search = trim($request->get('search', ''));
        $status = $request->get('status', 'ALL');
        $page   = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));

        $query = DB::table('customers as c')
            ->selectRaw('c.*,
                (SELECT COUNT(*) FROM anchors a WHERE a.customer_id = c.customer_id) AS anchor_count,
                (SELECT COUNT(*) FROM active_services s WHERE s.customer_id = c.customer_id) AS service_count')
            ->orderByDesc('c.created_at');

        if ($status !== 'ALL') {
            $query->where('c.account_status', $status);
        }

        if ($search) {
            // Check gpfi_msisdn match
            $gpfiIds = DB::table('active_services')
                ->where('gpfi_msisdn', 'LIKE', "%{$search}%")
                ->pluck('customer_id')
                ->toArray();

            $query->where(function ($q) use ($search, $gpfiIds) {
                $q->where('c.full_name', 'LIKE', "%{$search}%")
                  ->orWhere('c.primary_contact_number', 'LIKE', "%{$search}%");
                if (!empty($gpfiIds)) {
                    $q->orWhereIn('c.customer_id', $gpfiIds);
                }
            });
        }

        $total   = $query->count();
        $records = $query->offset($page * $perPage)->limit($perPage)->get();

        return response()->json(['items' => $records, 'total' => $total]);
    }

    public function show(string $id)
    {
        $customer = DB::table('customers')->where('customer_id', $id)->first();
        if (!$customer) return response()->json(['message' => 'Not found'], 404);
        return response()->json($customer);
    }

    public function view360(string $id)
    {
        $customer = DB::table('customers')->where('customer_id', $id)->first();
        if (!$customer) return response()->json(['message' => 'Not found'], 404);

        $services = DB::table('active_services')->where('customer_id', $id)->get();
        $anchors  = DB::table('anchors')->where('customer_id', $id)->orderByDesc('created_at')->get();
        $assets   = DB::table('customer_assets as ca')
            ->join('products as p', 'p.product_id', '=', 'ca.product_id')
            ->select('ca.*', 'p.product_name', 'p.warranty_value', 'p.warranty_unit')
            ->where('ca.customer_id', $id)
            ->get();
        $invoices        = DB::table('onetime_invoices')->where('customer_id', $id)->orderByDesc('created_at')->get();
        $addonOrders     = DB::table('addon_order_history')->where('customer_id', $id)->orderByDesc('created_at')->get();
        $cpeOrders       = DB::table('cpe_order_history')->where('customer_id', $id)->orderByDesc('created_at')->get();
        $ottOrders       = DB::table('ott_order_history')->where('customer_id', $id)->orderByDesc('created_at')->get();
        $locationChanges = DB::table('location_change_history')->where('customer_id', $id)->orderByDesc('created_at')->get();
        $realIps         = DB::table('real_ip_assignments')->where('customer_id', $id)->orderByDesc('created_at')->get();

        return response()->json(compact(
            'customer', 'services', 'anchors', 'assets', 'invoices',
            'addonOrders', 'cpeOrders', 'ottOrders', 'locationChanges', 'realIps'
        ));
    }
}
