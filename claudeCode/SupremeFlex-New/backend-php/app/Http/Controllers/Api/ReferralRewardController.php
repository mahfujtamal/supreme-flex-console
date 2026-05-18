<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReferralRewardController extends Controller
{
    public function checkReward(Request $request)
    {
        $request->validate(['ledger_id' => 'required|string']);

        $status = null;
        DB::statement('CALL check_and_release_referral_reward(?, @status)', [$request->ledger_id]);
        $result = DB::selectOne('SELECT @status AS status');

        return response()->json(['status' => $result->status]);
    }

    public function forceApprove(Request $request)
    {
        $request->validate([
            'ledger_id'  => 'required|string',
            'admin_name' => 'nullable|string',
        ]);

        DB::statement('CALL force_approve_referral_reward(?, ?)', [
            $request->ledger_id,
            $request->get('admin_name', 'Admin'),
        ]);

        return response()->json(['message' => 'Force approved']);
    }
}
