<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Helpers\Uuid;
use Illuminate\Support\Facades\DB;

/**
 * Shared CRUD helpers used by every resource controller.
 * Each controller sets $table, $primaryKey, $searchColumn, and $fillable.
 */
abstract class BaseApiController extends Controller
{
    protected string $table;
    protected string $primaryKey = 'id';
    protected string $searchColumn = 'name';
    protected array  $fillable = [];
    protected bool   $pkIsBinary = true;

    public function index(Request $request)
    {
        $page    = max(0, (int) $request->get('page', 0));
        $perPage = min(100, max(1, (int) $request->get('per_page', 20)));
        $search  = trim($request->get('search', ''));

        $query = DB::table($this->table)->orderByDesc('created_at');

        if ($search && $this->searchColumn) {
            $query->where($this->searchColumn, 'LIKE', "%{$search}%");
        }

        $total = $query->count();
        $items = $query->offset($page * $perPage)->limit($perPage)->get()
            ->map(fn($r) => $this->castRecord($r))->values();

        return response()->json(['items' => $items, 'total' => $total]);
    }

    public function store(Request $request)
    {
        $data = $request->only($this->fillable);
        $data[$this->primaryKey] = Uuid::make();
        $data['created_at'] = now();
        $data['updated_at'] = now();

        DB::table($this->table)->insert($data);

        $record = DB::table($this->table)->where($this->primaryKey, $data[$this->primaryKey])->first();
        return response()->json($this->castRecord($record), 201);
    }

    public function show(string $id)
    {
        $record = DB::table($this->table)->where($this->primaryKey, $this->parseBinId($id))->first();
        if (!$record) return response()->json(['message' => 'Not found'], 404);
        return response()->json($this->castRecord($record));
    }

    public function update(Request $request, string $id)
    {
        $binId = $this->parseBinId($id);
        $exists = DB::table($this->table)->where($this->primaryKey, $binId)->exists();
        if (!$exists) return response()->json(['message' => 'Not found'], 404);

        $data = $request->only($this->fillable);
        $data['updated_at'] = now();
        DB::table($this->table)->where($this->primaryKey, $binId)->update($data);

        return response()->json($this->castRecord(DB::table($this->table)->where($this->primaryKey, $binId)->first()));
    }

    // Soft-delete: set status = INACTIVE. Hard deletes are never permitted on master data.
    public function destroy(string $id)
    {
        $binId = $this->parseBinId($id);
        $exists = DB::table($this->table)->where($this->primaryKey, $binId)->exists();
        if (!$exists) return response()->json(['message' => 'Not found'], 404);

        DB::table($this->table)
            ->where($this->primaryKey, $binId)
            ->update(['status' => 'INACTIVE', 'updated_at' => now()]);

        return response()->json(null, 204);
    }

    // ── Bulk operations ──────────────────────────────────────────────────────

    public function bulkStore(Request $request)
    {
        $request->validate(['items' => 'required|array|min:1|max:100']);

        $pk   = $this->primaryKey;
        $rows = collect($request->items)->map(function ($item) use ($pk) {
            $data               = collect($item)->only($this->fillable)->all();
            $data[$pk]          = Uuid::make();
            $data['created_at'] = now();
            $data['updated_at'] = now();
            return $data;
        })->all();

        DB::transaction(function () use ($rows, $request) {
            DB::table($this->table)->insert($rows);
            $this->writeAuditLog('BULK_IMPORT', count($rows), null, $request);
        });

        return response()->json(['inserted' => count($rows)], 201);
    }

    public function bulkUpdate(Request $request)
    {
        $pk = $this->primaryKey;
        $request->validate([
            'items'        => 'required|array|min:1|max:100',
            "items.*.$pk"  => 'required|uuid',
        ]);

        DB::transaction(function () use ($request, $pk) {
            foreach ($request->items as $item) {
                $data               = collect($item)->only($this->fillable)->all();
                $data['updated_at'] = now();
                DB::table($this->table)->where($pk, Uuid::toBin($item[$pk]))->update($data);
            }
            $this->writeAuditLog('BULK_UPDATE', count($request->items), null, $request);
        });

        return response()->json(['updated' => count($request->items)]);
    }

    // Bulk delete is dev-mode only — caller must send X-Dev-Mode: true header.
    public function bulkDestroy(Request $request)
    {
        if ($request->header('X-Dev-Mode') !== 'true') {
            return response()->json(['message' => 'Bulk delete requires X-Dev-Mode: true header'], 403);
        }

        $request->validate([
            'ids'   => 'required|array|min:1|max:100',
            'ids.*' => 'required|uuid',
        ]);

        DB::transaction(function () use ($request) {
            DB::table($this->table)
                ->whereIn($this->primaryKey, array_map([Uuid::class, 'toBin'], $request->ids))
                ->update(['status' => 'INACTIVE', 'updated_at' => now()]);
            $this->writeAuditLog('BULK_DELETE', count($request->ids), $request->ids, $request);
        });

        return response()->json(['deactivated' => count($request->ids)]);
    }

    public static function castRecord(?object $record): ?object
    {
        if (!$record) return null;
        $r = (array) $record;
        foreach ($r as $key => $value) {
            if (is_string($value) && strlen($value) === 16) {
                $r[$key] = Uuid::fromBin($value);
            }
        }
        return (object) $r;
    }

    private function parseBinId(string $id): string
    {
        try {
            return Uuid::toBin($id);
        } catch (\InvalidArgumentException) {
            abort(422, 'Invalid UUID format');
        }
    }

    private function writeAuditLog(string $actionType, int $count, ?array $ids, Request $request): void
    {
        $authUser = $request->get('auth_user');
        DB::table('audit_logs')->insert([
            'log_id'           => Uuid::make(),
            'target_table'     => $this->table,
            'target_record_id' => null,
            'action_type'      => $actionType,
            'admin_id'         => isset($authUser['sub']) ? Uuid::toBin($authUser['sub']) : null,
            'ip_address'       => $request->ip(),
            'previous_state'   => null,
            'new_state'        => json_encode(['count' => $count, 'ids' => $ids]),
            'created_at'       => now(),
        ]);
    }
}
